import { createHmac } from "node:crypto";
import { loadConfig } from "@cmsv01/shared/config";
import { signJwt } from "@cmsv01/shared/crypto";
import { getDatabasePool } from "@cmsv01/shared/db";
import type { DomainEventEnvelope } from "@cmsv01/shared/events";
import { createKafkaClient } from "@cmsv01/shared/kafka";
import {
  listPendingOutboxEvents,
  markOutboxEventFailed,
  markOutboxEventPublished
} from "@cmsv01/shared/outbox";

const config = loadConfig();
const db = getDatabasePool(config);
const kafka = createKafkaClient(config);
const producer = kafka.producer();
const consumer = kafka.consumer({
  groupId: `${config.kafkaClientId}-projection-worker`
});
const apiBaseUrl =
  process.env.API_URL ||
  process.env.WORKER_API_URL ||
  (process.env.NODE_ENV === "development"
    ? `http://127.0.0.1:${config.port}`
    : null);

if (!apiBaseUrl) {
  throw new Error(
    "Worker API base URL is not configured. Set API_URL for deployed worker callbacks."
  );
}

let producerConnected = false;
let consumerConnected = false;
const processingSentToBank = new Set<string>();
const processingApproved = new Set<string>();

type ProjectionBatchRow = {
  batch_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  primary_beneficiary_id: string | null;
  primary_beneficiary_name: string | null;
  created_by_user_id: string;
  created_by_role: string | null;
  title: string;
  tag: string | null;
  remark: string | null;
  state: string;
  total_amount: string;
  approval_comment: string | null;
  bank_reference: string | null;
  created_at: Date | null;
  submitted_at: Date | null;
  submitted_by_user_id: string | null;
  submitted_by_role: string | null;
  approved_at: Date | null;
  approved_by_user_id: string | null;
  approved_by_role: string | null;
  rejected_at: Date | null;
  rejected_by_user_id: string | null;
  rejected_by_role: string | null;
  dispatched_at: Date | null;
  completed_at: Date | null;
  failure_reason: string | null;
  approval_levels_required?: number | null;
  current_approval_level?: number | null;
  roles_by_level?: Array<{ level: number; roles: string[] }> | null;
  matched_matrix_ids?: string[] | null;
};

type ApprovalContextRow = {
  batch_id: string;
  corporate_tenant_id: string;
  current_approval_level: number;
  approval_levels_required: number;
  roles_by_level: Array<{ level: number; roles: string[] }> | null;
  status: string;
};

type ApprovalActionRow = {
  approval_level: number;
  action: "approve" | "reject";
  actor_user_id: string;
  actor_role: string;
  created_at: Date | null;
};

async function ensureProducerConnected() {
  if (producerConnected) {
    return;
  }

  await producer.connect();
  producerConnected = true;
}

async function ensureConsumerConnected() {
  if (consumerConnected) {
    return;
  }

  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafkaOutboxTopic,
    fromBeginning: true
  });
  consumerConnected = true;
}

async function publishPendingOutboxEvents() {
  const pendingEvents = await listPendingOutboxEvents(config, {
    limit: 50
  });

  if (pendingEvents.length === 0) {
    return;
  }

  await ensureProducerConnected();

  for (const event of pendingEvents) {
    try {
      await producer.send({
        topic: config.kafkaOutboxTopic,
        messages: [
          {
            key: event.event_key,
            value: JSON.stringify({
              eventId: event.event_id,
              aggregateType: event.aggregate_type,
              aggregateId: event.aggregate_id,
              eventType: event.event_type,
              eventKey: event.event_key,
              version: event.version,
              occurredAt: event.occurred_at?.toISOString() ?? new Date().toISOString(),
              payload: event.payload_json
            })
          }
        ]
      });

      await markOutboxEventPublished(config, event.event_id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown outbox publish failure";
      await markOutboxEventFailed(config, event.event_id, message);
      console.error(
        JSON.stringify({
          service: "worker",
          status: "outbox_publish_failed",
          eventId: event.event_id,
          eventType: event.event_type,
          message
        })
      );
    }
  }
}

async function syncTransactionProjection(batchId: string) {
  const result = await db.query<ProjectionBatchRow>(
    `select pb.batch_id, pb.bank_tenant_id, pb.corporate_tenant_id, pb.corporate_id,
            first_item.beneficiary_id as primary_beneficiary_id,
            first_item.beneficiary_name as primary_beneficiary_name,
            pb.created_by_user_id, pb.created_by_role, pb.title, pb.tag, pb.remark,
            pb.state, pb.total_amount, pb.approval_comment, pb.bank_reference,
            pb.created_at, pb.submitted_at, pb.submitted_by_user_id, pb.submitted_by_role,
            pb.approved_at, pb.approved_by_user_id, pb.approved_by_role, pb.rejected_at,
            pb.rejected_by_user_id, pb.rejected_by_role, pb.dispatched_at, pb.completed_at,
            pb.failure_reason, pac.approval_levels_required, pac.current_approval_level,
            pac.roles_by_level, pac.matched_matrix_ids
     from payout_batches pb
     left join payout_batch_approval_contexts pac on pac.batch_id = pb.batch_id
     left join lateral (
       select pi.beneficiary_id, b.name as beneficiary_name
       from payout_items pi
       left join beneficiaries b on b.beneficiary_id = pi.beneficiary_id
       where pi.batch_id = pb.batch_id
       order by pi.item_id
       limit 1
     ) first_item on true
     where pb.batch_id = $1`,
    [batchId]
  );

  const row = result.rows[0];
  if (!row) {
    await db.query(`delete from transaction_list_projection where batch_id = $1`, [batchId]);
    await db.query(`delete from approval_queue_projection where batch_id = $1`, [batchId]);
    return;
  }

  await db.query(
    `insert into transaction_list_projection (
       batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
       primary_beneficiary_id, primary_beneficiary_name, created_by_user_id, created_by_role,
       title, tag, remark, state, total_amount, approval_comment, bank_reference,
       dispatched_at, completed_at, failure_reason, approval_levels_required,
       current_approval_level, roles_by_level, matched_matrix_ids, created_at,
       submitted_at, approved_at, rejected_at, submitted_by_user_id, submitted_by_role,
       approved_by_user_id, approved_by_role, rejected_by_user_id, rejected_by_role, updated_at
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21::jsonb, $22, $23, $24, $25, $26, $27, $28, $29,
       $30, $31, $32, now()
     )
     on conflict (batch_id) do update
     set bank_tenant_id = excluded.bank_tenant_id,
         corporate_tenant_id = excluded.corporate_tenant_id,
         corporate_id = excluded.corporate_id,
         primary_beneficiary_id = excluded.primary_beneficiary_id,
         primary_beneficiary_name = excluded.primary_beneficiary_name,
         created_by_user_id = excluded.created_by_user_id,
         created_by_role = excluded.created_by_role,
         title = excluded.title,
         tag = excluded.tag,
         remark = excluded.remark,
         state = excluded.state,
         total_amount = excluded.total_amount,
         approval_comment = excluded.approval_comment,
         bank_reference = excluded.bank_reference,
         dispatched_at = excluded.dispatched_at,
         completed_at = excluded.completed_at,
         failure_reason = excluded.failure_reason,
         approval_levels_required = excluded.approval_levels_required,
         current_approval_level = excluded.current_approval_level,
         roles_by_level = excluded.roles_by_level,
         matched_matrix_ids = excluded.matched_matrix_ids,
         created_at = excluded.created_at,
         submitted_at = excluded.submitted_at,
         approved_at = excluded.approved_at,
         rejected_at = excluded.rejected_at,
         submitted_by_user_id = excluded.submitted_by_user_id,
         submitted_by_role = excluded.submitted_by_role,
         approved_by_user_id = excluded.approved_by_user_id,
         approved_by_role = excluded.approved_by_role,
         rejected_by_user_id = excluded.rejected_by_user_id,
         rejected_by_role = excluded.rejected_by_role,
         updated_at = now()`,
    [
      row.batch_id,
      row.bank_tenant_id,
      row.corporate_tenant_id,
      row.corporate_id,
      row.primary_beneficiary_id,
      row.primary_beneficiary_name,
      row.created_by_user_id,
      row.created_by_role,
      row.title,
      row.tag,
      row.remark,
      row.state,
      row.total_amount,
      row.approval_comment,
      row.bank_reference,
      row.dispatched_at,
      row.completed_at,
      row.failure_reason,
      row.approval_levels_required ?? null,
      row.current_approval_level ?? null,
      JSON.stringify(row.roles_by_level ?? []),
      row.matched_matrix_ids ?? [],
      row.created_at,
      row.submitted_at,
      row.approved_at,
      row.rejected_at,
      row.submitted_by_user_id,
      row.submitted_by_role,
      row.approved_by_user_id,
      row.approved_by_role,
      row.rejected_by_user_id,
      row.rejected_by_role
    ]
  );

  const currentRoles =
    row.roles_by_level?.find((entry) => entry.level === row.current_approval_level)?.roles ?? [];

  if (["pending_approval", "partially_approved"].includes(row.state)) {
    await db.query(
      `insert into approval_queue_projection (
         queue_id, batch_id, corporate_tenant_id, corporate_id, title, state,
         approval_level, approval_levels_required, approval_roles, total_amount,
         created_at, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, now())
       on conflict (batch_id) do update
       set corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           title = excluded.title,
           state = excluded.state,
           approval_level = excluded.approval_level,
           approval_levels_required = excluded.approval_levels_required,
           approval_roles = excluded.approval_roles,
           total_amount = excluded.total_amount,
           created_at = excluded.created_at,
           updated_at = now()`,
      [
        `queue-${batchId}`,
        batchId,
        row.corporate_tenant_id,
        row.corporate_id,
        row.title,
        row.state,
        row.current_approval_level ?? null,
        row.approval_levels_required ?? null,
        JSON.stringify(currentRoles),
        row.total_amount,
        row.created_at
      ]
    );
  } else {
    await db.query(`delete from approval_queue_projection where batch_id = $1`, [batchId]);
  }
}

async function syncApprovalAssignments(batchId: string) {
  const contextResult = await db.query<ApprovalContextRow>(
    `select batch_id, corporate_tenant_id, current_approval_level,
            approval_levels_required, roles_by_level, status
     from payout_batch_approval_contexts
     where batch_id = $1`,
    [batchId]
  );
  const context = contextResult.rows[0];
  if (!context) {
    return;
  }

  const batchResult = await db.query<{
    corporate_id: string | null;
    state: string;
  }>(
    `select corporate_id, state
     from payout_batches
     where batch_id = $1`,
    [batchId]
  );
  const batch = batchResult.rows[0];
  if (!batch) {
    return;
  }

  const actionsResult = await db.query<ApprovalActionRow>(
    `select approval_level, action, actor_user_id, actor_role, created_at
     from payout_batch_approval_actions
     where batch_id = $1
     order by created_at asc nulls last`,
    [batchId]
  );
  const actions = actionsResult.rows;

  const roleRows =
    context.roles_by_level?.flatMap((entry) =>
      entry.roles.map((role) => ({
        level: entry.level,
        role
      }))
    ) ?? [];

  for (const roleRow of roleRows) {
    let status = "pending";
    let actedByUserId: string | null = null;
    let actedAt: Date | null = null;

    const levelActions = actions.filter((action) => action.approval_level === roleRow.level);
    const actedHere = levelActions.find((action) => action.actor_role === roleRow.role);
    const anyActionHere = levelActions[0];

    if (actedHere?.action === "approve") {
      status = "approved";
      actedByUserId = actedHere.actor_user_id;
      actedAt = actedHere.created_at;
    } else if (actedHere?.action === "reject") {
      status = "rejected";
      actedByUserId = actedHere.actor_user_id;
      actedAt = actedHere.created_at;
    } else if (anyActionHere) {
      status = "skipped";
      actedAt = anyActionHere.created_at;
    } else if (
      batch.state === "rejected" &&
      roleRow.level > Math.max(...actions.map((action) => action.approval_level), 0)
    ) {
      status = "skipped";
    } else if (
      batch.state === "approved" &&
      roleRow.level < (context.current_approval_level ?? context.approval_levels_required)
    ) {
      status = "skipped";
    }

    await db.query(
      `insert into transaction_approval_assignments (
         assignment_id, batch_id, corporate_tenant_id, corporate_id, approval_level,
         role_name, status, acted_by_user_id, acted_at, created_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       on conflict (batch_id, approval_level, role_name) do update
       set status = excluded.status,
           acted_by_user_id = excluded.acted_by_user_id,
           acted_at = excluded.acted_at`,
      [
        `${batchId}-${roleRow.level}-${roleRow.role}`,
        batchId,
        context.corporate_tenant_id,
        batch.corporate_id,
        roleRow.level,
        roleRow.role,
        status,
        actedByUserId,
        actedAt
      ]
    );
  }
}

async function handleDomainEvent(event: DomainEventEnvelope) {
  if (event.aggregateType === "file-upload" && event.eventType === "file.accepted") {
    await postToApi(`/v1/payouts/file-uploads/${event.aggregateId}/process`);
    return;
  }

  if (
    event.aggregateType === "transaction-command" &&
    event.eventType === "transaction.command.accepted"
  ) {
    await postToApi(`/v1/payouts/commands/${event.aggregateId}/process`);
    return;
  }

  if (event.aggregateType !== "transaction") {
    return;
  }

  const batchId = event.aggregateId;

  await syncTransactionProjection(batchId);

  if (event.eventType === "transaction.created") {
    const payload = event.payload as any;
    const isAutoSubmit = ["partner_api", "checkout_sdk", "api"].includes(payload.tag || "");
    if (isAutoSubmit) {
      console.log(`[Worker] Auto-submitting partner/checkout transaction ${batchId}...`);
      try {
        await postToApi(`/v1/payouts/batches/${batchId}/actions`, {
          action: "submit",
          actedByUserId: payload.createdByUserId,
          comment: "Automatically submitted by background worker (Scenario 2)"
        });
      } catch (err) {
        console.error(`[Worker] Auto-submission failed for batch ${batchId}:`, err);
      }
    }
    return;
  }

  if (
    [
      "transaction.submitted",
      "transaction.partially_approved",
      "transaction.approved",
      "transaction.rejected"
    ].includes(event.eventType)
  ) {
    await syncApprovalAssignments(batchId);
  }

  if (event.eventType === "transaction.approved") {
    await executeCbsDebitJourney(batchId);
  }

  if (event.eventType === "transaction.failed") {
    await executeCbsReversalJourney(batchId);
  }

  if (
    [
      "transaction.sent_to_bank",
      "transaction.paid",
      "transaction.failed"
    ].includes(event.eventType)
  ) {
    await dispatchWebhookForEvent(event);
  }
}

async function executeCbsDebitJourney(batchId: string) {
  if (processingApproved.has(batchId)) {
    return;
  }
  processingApproved.add(batchId);
  try {
    const batchRes = await db.query<{
      batch_id: string;
      total_amount: string;
      account_number: string;
      state: string;
      narration: string | null;
      utr: string | null;
    }>(
      `select pb.batch_id, pb.total_amount, cda.account_number, pb.state, pb.narration, pb.utr
       from payout_batches pb
       left join corporate_debit_accounts cda on cda.debit_account_id = pb.debit_account_id
       where pb.batch_id = $1`,
      [batchId]
    );

    const batch = batchRes.rows[0];
    if (!batch) return;

    const idempotencyKey = `cbs-debit-${batchId}`;

    // Only run pre-flight status check if this is a retry (i.e. state is not 'approved')
    if (batch.state !== "approved") {
      try {
        const statusRes = await fetch(`${apiBaseUrl}/v1/cbs/transactions/status/${idempotencyKey}`, {
          headers: {
            "Authorization": `Bearer ${signJwt({ userId: "system-worker", role: "system", tenantScope: "system" })}`
          }
        });
        if (statusRes.status === 200) {
          const data = (await statusRes.json()) as {
            status: "SUCCESS" | "FAILED";
            cbsReferenceId?: string;
            errorCode?: string;
            errorMessage?: string;
          };
          if (data.status === "SUCCESS") {
            console.log(`[Worker] Pre-flight status check found SUCCESS for batch ${batchId}. Short-circuiting.`);
            await db.query(
              `update payout_batches set state = 'cbs_debit_succeeded', bank_reference = $2 where batch_id = $1`,
              [batchId, data.cbsReferenceId]
            );
            await syncTransactionProjection(batchId);
            await dispatchToPaymentHub(batchId);
            return;
          } else if (data.status === "FAILED") {
            console.log(`[Worker] Pre-flight status check found FAILED for batch ${batchId}. Short-circuiting.`);
            await db.query(
              `update payout_batches set state = 'failed', failure_reason = $2 where batch_id = $1`,
              [batchId, data.errorMessage || "CBS debit rejected (e.g. insufficient funds)."]
            );
            await syncTransactionProjection(batchId);
            return;
          }
        }
      } catch (statusCheckError) {
        console.warn(`[Worker] Pre-flight status check failed for batch ${batchId}, proceeding with normal debit:`, statusCheckError);
      }
    }

    // Transition to cbs_debit_queued
    await db.query(`update payout_batches set state = 'cbs_debit_queued' where batch_id = $1`, [batchId]);
    await syncTransactionProjection(batchId);

    // Transition to cbs_debit_in_flight
    await db.query(`update payout_batches set state = 'cbs_debit_in_flight' where batch_id = $1`, [batchId]);
    await syncTransactionProjection(batchId);
    
    let cbsResponse;
    try {
      cbsResponse = await postToApi(
        `/v1/cbs/debit`,
        {
          accountNumber: batch.account_number,
          amount: batch.total_amount,
          narration: batch.narration || `CMS Payout ${batchId}`
        },
        {
          "X-Idempotency-Key": idempotencyKey
        }
      );
    } catch (fetchError) {
      console.warn(`CBS Debit timeout/network error for batch ${batchId}:`, fetchError);
      await db.query(
        `update payout_batches set state = 'cbs_debit_ambiguous', failure_reason = 'CBS debit timed out. Pending reconciliation.' where batch_id = $1`,
        [batchId]
      );
      await syncTransactionProjection(batchId);
      return;
    }

    if (cbsResponse.ok) {
      const data = await cbsResponse.json() as { status: "SUCCESS", cbsReferenceId: string };
      // Transition to cbs_debit_succeeded
      await db.query(
        `update payout_batches set state = 'cbs_debit_succeeded', bank_reference = $2 where batch_id = $1`,
        [batchId, data.cbsReferenceId]
      );
      await syncTransactionProjection(batchId);

      // Now dispatch to mock clearing bank (Payment Hub)
      await dispatchToPaymentHub(batchId);
    } else if (cbsResponse.status === 422) {
      const data = await cbsResponse.json() as { errorCode?: string, errorMessage?: string };
      // Transition to failed
      await db.query(
        `update payout_batches set state = 'failed', failure_reason = $2 where batch_id = $1`,
        [batchId, data.errorMessage || "CBS debit rejected (e.g. insufficient funds)."]
      );
      await syncTransactionProjection(batchId);
    } else {
      // 5xx or other status: ambiguous
      await db.query(
        `update payout_batches set state = 'cbs_debit_ambiguous', failure_reason = 'CBS debit returned ambiguous error. Pending reconciliation.' where batch_id = $1`,
        [batchId]
      );
      await syncTransactionProjection(batchId);
    }
  } catch (error) {
    console.error(`Error in executeCbsDebitJourney for batch ${batchId}:`, error);
  } finally {
    processingApproved.delete(batchId);
  }
}

async function dispatchToPaymentHub(batchId: string) {
  // Call the core API dispatch route
  const dispatchResponse = await postToApi(`/v1/payouts/batches/${batchId}/dispatch`, {
    actedByUserId: "system-worker",
    comment: "Automatically sent to bank by background dispatch worker"
  });

  if (dispatchResponse.ok) {
    // 1. Retrieve the batch details from the database
    let batchDetails;
    try {
      const queryResult = await db.query<{
        batch_id: string;
        utr: string | null;
        narration: string | null;
        total_amount: string;
        payment_method_code: string | null;
        beneficiary_account: string | null;
        beneficiary_name: string | null;
      }>(
        `select 
           pb.batch_id,
           pb.utr,
           pb.narration,
           pb.total_amount,
           pb.payment_method_code,
           b.account_number as beneficiary_account,
           b.name as beneficiary_name
         from payout_batches pb
         left join payout_items pi on pi.batch_id = pb.batch_id
         left join beneficiaries b on b.beneficiary_id = pi.beneficiary_id
         where pb.batch_id = $1
         order by pi.item_id asc
         limit 1`,
        [batchId]
      );
      batchDetails = queryResult.rows[0];
    } catch (dbErr) {
      console.error(`[Payment Hub] Database query for batch ${batchId} failed:`, dbErr);
    }

    if (!batchDetails) {
      console.error(`[Payment Hub] Batch details for batchId ${batchId} could not be retrieved.`);
      return;
    }

    const utr = batchDetails.utr || `MOCKUTR${batchId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const narration = batchDetails.narration || `CMS-${utr}-PAYOUT`;
    const amount = batchDetails.total_amount;
    const beneficiaryAccount = batchDetails.beneficiary_account || "UNKNOWN";
    const beneficiaryName = batchDetails.beneficiary_name || "UNKNOWN";
    const paymentMethod = batchDetails.payment_method_code || "NEFT";

    // 2. Introduce a mock clearing delay, and then call the simulated Payment Hub transfer API
    processingSentToBank.add(batchId);
    setTimeout(async () => {
      try {
        console.log(`[Payment Hub] Simulating clearing rail response for batch ${batchId}...`);
        
        const token = signJwt({
          userId: "system-worker",
          role: "system",
          tenantScope: "system"
        });

        const phResponse = await fetch(`${apiBaseUrl}/v1/payment-hub/transfer`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            batchId,
            utr,
            narration,
            amount,
            beneficiaryAccount,
            beneficiaryName,
            paymentMethod
          })
        });

        // 3. Based on status:
        if (phResponse.status === 200) {
          console.log(`[Payment Hub] Transfer succeeded for batch ${batchId}. Simulating bank response: paid.`);
          await postToApi(`/v1/payouts/batches/${batchId}/simulate-bank-response`, {
            actedByUserId: "system-worker",
            status: "paid",
            comment: "Mock bank clearing succeeded"
          });
        } else {
          console.warn(`[Payment Hub] Transfer failed with status ${phResponse.status} for batch ${batchId}. Simulating bank response: failed.`);
          await postToApi(`/v1/payouts/batches/${batchId}/simulate-bank-response`, {
            actedByUserId: "system-worker",
            status: "failed",
            comment: "Mock bank clearing failed"
          });
        }
      } catch (err) {
        console.error(`[Payment Hub] Clearing simulation failed for batch ${batchId}:`, err);
      } finally {
        processingSentToBank.delete(batchId);
      }
    }, 5000); // 5 seconds clearing rail delay
  }
}

async function reprocessSentToBank(batchId: string) {
  console.log(`[Reconciliation] Resuming clearing simulation for stuck batch ${batchId}...`);
  let batchDetails;
  try {
    const queryResult = await db.query<{
      batch_id: string;
      utr: string | null;
      narration: string | null;
      total_amount: string;
      payment_method_code: string | null;
      beneficiary_account: string | null;
      beneficiary_name: string | null;
    }>(
      `select 
         pb.batch_id,
         pb.utr,
         pb.narration,
         pb.total_amount,
         pb.payment_method_code,
         b.account_number as beneficiary_account,
         b.name as beneficiary_name
       from payout_batches pb
       left join payout_items pi on pi.batch_id = pb.batch_id
       left join beneficiaries b on b.beneficiary_id = pi.beneficiary_id
       where pb.batch_id = $1
       order by pi.item_id asc
       limit 1`,
      [batchId]
    );
    batchDetails = queryResult.rows[0];
  } catch (dbErr) {
    console.error(`[Reconciliation] Database query for batch ${batchId} failed:`, dbErr);
  }

  if (!batchDetails) {
    console.error(`[Reconciliation] Batch details for batchId ${batchId} could not be retrieved.`);
    return;
  }

  const utr = batchDetails.utr || `MOCKUTR${batchId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const narration = batchDetails.narration || `CMS-${utr}-PAYOUT`;
  const amount = batchDetails.total_amount;
  const beneficiaryAccount = batchDetails.beneficiary_account || "UNKNOWN";
  const beneficiaryName = batchDetails.beneficiary_name || "UNKNOWN";
  const paymentMethod = batchDetails.payment_method_code || "NEFT";

  processingSentToBank.add(batchId);
  setTimeout(async () => {
    try {
      console.log(`[Reconciliation] Simulating clearing rail response for stuck batch ${batchId}...`);
      
      const token = signJwt({
        userId: "system-worker",
        role: "system",
        tenantScope: "system"
      });

      const phResponse = await fetch(`${apiBaseUrl}/v1/payment-hub/transfer`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          batchId,
          utr,
          narration,
          amount,
          beneficiaryAccount,
          beneficiaryName,
          paymentMethod
        })
      });

      if (phResponse.status === 200) {
        console.log(`[Reconciliation] Stuck batch ${batchId} cleared. Simulating paid.`);
        await postToApi(`/v1/payouts/batches/${batchId}/simulate-bank-response`, {
          actedByUserId: "system-worker",
          status: "paid",
          comment: "Mock bank clearing succeeded (reconciliation)"
        });
      } else {
        console.warn(`[Reconciliation] Stuck batch ${batchId} clearing failed. Simulating failed.`);
        await postToApi(`/v1/payouts/batches/${batchId}/simulate-bank-response`, {
          actedByUserId: "system-worker",
          status: "failed",
          comment: "Mock bank clearing failed (reconciliation)"
        });
      }
    } catch (err) {
      console.error(`[Reconciliation] Clearing simulation failed for stuck batch ${batchId}:`, err);
    } finally {
      processingSentToBank.delete(batchId);
    }
  }, 5000);
}

async function executeCbsReversalJourney(batchId: string) {
  try {
    const batchRes = await db.query<{
      batch_id: string;
      bank_reference: string;
      total_amount: string;
      state: string;
    }>(
      `select pb.batch_id, pb.bank_reference, pb.total_amount, pb.state
       from payout_batches pb
       where pb.batch_id = $1`,
      [batchId]
    );

    const batch = batchRes.rows[0];
    if (!batch) {
      return;
    }

    // Find the original CBS debit reference via idempotency key
    const cbsTxRes = await db.query<{ cbs_reference_id: string }>(
      `select cbs_reference_id from cbs_transactions 
       where idempotency_key = $1 and status = 'SUCCESS' and transaction_type = 'debit'`,
      [`cbs-debit-${batchId}`]
    );
    const origCbsRef = cbsTxRes.rows[0]?.cbs_reference_id;
    if (!origCbsRef) {
      console.warn(`[Worker] No original CBS debit transaction found to reverse for batch ${batchId}.`);
      return;
    }

    const reversalIdempotencyKey = `cbs-rev-${batchId}`;

    // Only run pre-flight status check if this is a retry (i.e. state is already a reversal state)
    const isReversalRetry = ["reversal_queued", "reversal_in_flight", "reversal_ambiguous", "reversal_failed"].includes(batch.state);
    if (isReversalRetry) {
      try {
        const statusRes = await fetch(`${apiBaseUrl}/v1/cbs/transactions/status/${reversalIdempotencyKey}`, {
          headers: {
            "Authorization": `Bearer ${signJwt({ userId: "system-worker", role: "system", tenantScope: "system" })}`
          }
        });
        if (statusRes.status === 200) {
          console.log(`[Worker] Pre-flight status check found SUCCESS/processed for reversal ${batchId}. Short-circuiting.`);
          await db.query(
            `update payout_batches set state = 'failed', failure_reason = 'Transaction failed. Reversal posted in CBS.' where batch_id = $1`,
            [batchId]
          );
          await syncTransactionProjection(batchId);
          return;
        }
      } catch (statusCheckError) {
        console.warn(`[Worker] Pre-flight status check failed for reversal ${batchId}, proceeding with normal reversal:`, statusCheckError);
      }
    }

    // Transition to reversal_queued
    await db.query(`update payout_batches set state = 'reversal_queued' where batch_id = $1`, [batchId]);
    await syncTransactionProjection(batchId);

    // Transition to reversal_in_flight
    await db.query(`update payout_batches set state = 'reversal_in_flight' where batch_id = $1`, [batchId]);
    await syncTransactionProjection(batchId);

    let cbsResponse;
    try {
      cbsResponse = await postToApi(
        `/v1/cbs/reverse-debit`,
        {
          originalCbsReferenceId: origCbsRef,
          reversalIdempotencyKey: reversalIdempotencyKey,
          amount: batch.total_amount,
          reason: "Payment Hub clearing failure"
        }
      );
    } catch (fetchError) {
      console.warn(`CBS Reversal timeout/network error for batch ${batchId}:`, fetchError);
      await db.query(
        `update payout_batches set state = 'reversal_ambiguous', failure_reason = 'CBS reversal timed out. Pending reconciliation.' where batch_id = $1`,
        [batchId]
      );
      await syncTransactionProjection(batchId);
      return;
    }

    if (cbsResponse.ok) {
      // Reversal succeeded! Mark state to failed (with reversed message)
      await db.query(
        `update payout_batches set state = 'failed', failure_reason = 'Transaction failed. Reversal posted in CBS.' where batch_id = $1`,
        [batchId]
      );
      await syncTransactionProjection(batchId);
    } else {
      // Reversal failed permanently or returned ambiguous error
      await db.query(
        `update payout_batches set state = 'reversal_failed', failure_reason = 'CBS reversal failed. Requires manual intervention.' where batch_id = $1`,
        [batchId]
      );
      await syncTransactionProjection(batchId);
    }
  } catch (error) {
    console.error(`Error in executeCbsReversalJourney for batch ${batchId}:`, error);
  }
}

async function runReconciliationLoop() {
  while (true) {
    try {
      await reconcileAmbiguousTransactions();
    } catch (error) {
      console.error(
        JSON.stringify({
          service: "worker",
          status: "reconciliation_loop_failed",
          message: error instanceof Error ? error.message : "Unknown reconciliation loop error"
        })
      );
    }
    await sleep(15000); // Poll every 15s
  }
}

async function reconcileAmbiguousTransactions() {
  const ambiguousTx = await db.query<{ batch_id: string, state: string }>(
    `select batch_id, state from payout_batches
     where state in ('cbs_debit_ambiguous', 'reversal_ambiguous')
        or (state = 'sent_to_bank' and dispatched_at is not null and dispatched_at < now() - interval '10 seconds')
        or (state = 'approved' and approved_at is not null and approved_at < now() - interval '10 seconds')`
  );

  for (const row of ambiguousTx.rows) {
    const batchId = row.batch_id;
    if (row.state === "cbs_debit_ambiguous") {
      const idempotencyKey = `cbs-debit-${batchId}`;
      try {
        const response = await fetch(`${apiBaseUrl}/v1/cbs/transactions/status/${idempotencyKey}`, {
          headers: {
            "Authorization": `Bearer ${signJwt({ userId: "system-worker", role: "system", tenantScope: "system" })}`
          }
        });

        if (response.status === 200) {
          const data = await response.json() as { status: "SUCCESS" | "FAILED", cbsReferenceId?: string, errorCode?: string, errorMessage?: string };
          if (data.status === "SUCCESS") {
            await db.query(
              `update payout_batches set state = 'cbs_debit_succeeded', bank_reference = $2 where batch_id = $1`,
              [batchId, data.cbsReferenceId]
            );
            await syncTransactionProjection(batchId);
            await dispatchToPaymentHub(batchId);
          } else {
            await db.query(
              `update payout_batches set state = 'failed', failure_reason = $2 where batch_id = $1`,
              [batchId, data.errorMessage || "CBS debit failed during reconciliation."]
            );
            await syncTransactionProjection(batchId);
          }
        } else if (response.status === 404) {
          await executeCbsDebitJourney(batchId);
        }
      } catch (err) {
        console.error(`Reconciliation failed for batch ${batchId}:`, err);
      }
    } else if (row.state === "reversal_ambiguous") {
      const reversalIdempotencyKey = `cbs-rev-${batchId}`;
      try {
        const response = await fetch(`${apiBaseUrl}/v1/cbs/transactions/status/${reversalIdempotencyKey}`, {
          headers: {
            "Authorization": `Bearer ${signJwt({ userId: "system-worker", role: "system", tenantScope: "system" })}`
          }
        });

        if (response.status === 200) {
          await db.query(`update payout_batches set state = 'failed', failure_reason = 'Transaction failed. Reversal posted in CBS.' where batch_id = $1`, [batchId]);
          await syncTransactionProjection(batchId);
        } else if (response.status === 404) {
          await executeCbsReversalJourney(batchId);
        }
      } catch (err) {
        console.error(`Reconciliation of reversal failed for batch ${batchId}:`, err);
      }
    } else if (row.state === "sent_to_bank") {
      if (!processingSentToBank.has(batchId)) {
        await reprocessSentToBank(batchId);
      }
    } else if (row.state === "approved") {
      if (!processingApproved.has(batchId)) {
        console.log(`[Reconciliation] Resuming CBS debit execution for stuck approved batch ${batchId}...`);
        await executeCbsDebitJourney(batchId);
      }
    }
  }
}

async function dispatchWebhookForEvent(event: DomainEventEnvelope) {
  try {
    // 1. Fetch active webhooks subscribed to this event type
    const webhooksRes = await db.query<{
      webhook_id: string;
      webhook_url: string;
      signing_secret: string;
    }>(
      `select webhook_id, webhook_url, signing_secret 
       from partner_webhooks 
       where status = 'active' and $1 = any(event_types)`,
      [event.eventType]
    );

    if (webhooksRes.rows.length === 0) {
      return;
    }

    // 2. Correlate with partner api activity
    let activityId: string | null = null;
    const batchId = event.aggregateId;
    
    if (batchId) {
      // Find associated command ID
      const commandRes = await db.query<{ command_id: string }>(
        `select command_id from transaction_commands where batch_id = $1`,
        [batchId]
      );
      const commandId = commandRes.rows[0]?.command_id || null;

      const activityRes = await db.query<{ activity_id: string }>(
        `select activity_id from partner_api_activities
         where response_body->>'batchId' = $1
            or response_body->'command'->>'batchId' = $1
            or request_body->>'batchId' = $1
            or path like '%' || $1 || '%'
            or ($2::text is not null and (
                 response_body->>'commandId' = $2
              or response_body->'command'->>'commandId' = $2
              or request_body->>'commandId' = $2
              or request_body->'command'->>'commandId' = $2
              or path like '%' || $2 || '%'
            ))
         order by created_at desc
         limit 1`,
        [batchId, commandId]
      );
      if (activityRes.rows.length > 0) {
        activityId = activityRes.rows[0].activity_id;
      }
    }

    const webhookPayload = {
      id: event.eventId,
      type: event.eventType,
      created: event.occurredAt,
      data: {
        object: event.payload
      }
    };

    const payloadString = JSON.stringify(webhookPayload);

    // 3. Dispatch for each webhook
    await Promise.all(
      webhooksRes.rows.map(async (wh) => {
        const deliveryId = `whd_${Date.now()}_${Math.floor(Math.random() * 100000)
          .toString()
          .padStart(5, "0")}`;

        // Create pending delivery attempt
        await db.query(
          `insert into partner_webhook_deliveries (
             delivery_id, webhook_id, event_type, target_url, payload, status, attempted_at, activity_id
           ) values ($1, $2, $3, $4, $5::jsonb, 'pending', now(), $6)`,
          [deliveryId, wh.webhook_id, event.eventType, wh.webhook_url, payloadString, activityId]
        );

        // Sign the payload
        const timestamp = Math.floor(Date.now() / 1000);
        const signaturePayload = `t=${timestamp},${payloadString}`;
        const signature = createHmac("sha256", wh.signing_secret)
          .update(signaturePayload)
          .digest("hex");
        const xSignature = `t=${timestamp},v1=${signature}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let responseStatus: number | null = null;
        let responseBody: string | null = null;
        let deliveryStatus: "successful" | "failed" = "failed";

        try {
          console.log(`[Worker Webhook] Dispatching event ${event.eventType} (delivery: ${deliveryId}) to ${wh.webhook_url}`);
          const res = await fetch(wh.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Signature": xSignature,
              "User-Agent": "FuturePay-Webhook-Dispatcher/1.0"
            },
            body: payloadString,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          responseStatus = res.status;
          responseBody = await res.text().catch(() => "");
          if (res.ok) {
            deliveryStatus = "successful";
          }
        } catch (err) {
          clearTimeout(timeoutId);
          responseStatus = null;
          responseBody = err instanceof Error ? err.message : String(err);
          console.error(`[Worker Webhook] Failed to dispatch webhook (delivery: ${deliveryId}) to ${wh.webhook_url}:`, err);
        }

        // Update delivery status
        await db.query(
          `update partner_webhook_deliveries
           set response_status = $2, response_body = $3, status = $4, attempted_at = now()
           where delivery_id = $1`,
          [deliveryId, responseStatus, responseBody, deliveryStatus]
        );

        // Update webhook metadata
        await db.query(
          `update partner_webhooks
           set last_delivery_at = now(), last_delivery_status = $2, last_delivery_http_status = $3, updated_at = now()
           where webhook_id = $1`,
          [wh.webhook_id, deliveryStatus, responseStatus]
        );
      })
    );
  } catch (error) {
    console.error(`Error in dispatchWebhookForEvent for event ${event.eventId}:`, error);
  }
}

async function postToApi(path: string, body?: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  const token = signJwt({
    userId: "system-worker",
    role: "system",
    tenantScope: "system"
  });

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      ...extraHeaders
    }
  };

  if (body) {
    requestInit.headers = {
      ...requestInit.headers,
      "Content-Type": "application/json"
    };
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, requestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `API callback failed for ${path}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
    );
  }

  return response;
}

async function startConsumer() {
  await ensureConsumerConnected();
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      let eventId: string | undefined;
      let acquiredLock = false;

      try {
        const event = JSON.parse(message.value.toString()) as DomainEventEnvelope;
        eventId = event.eventId;

        if (!eventId) {
          console.warn(
            JSON.stringify({
              service: "worker",
              status: "consume_skipped",
              message: "Event without eventId ignored"
            })
          );
          return;
        }

        const lockResult = await db.query(
          "insert into processed_events (event_id) values ($1) on conflict (event_id) do nothing",
          [eventId]
        );

        if (lockResult.rowCount === 0) {
          console.log(
            JSON.stringify({
              service: "worker",
              status: "duplicate_skipped",
              eventId,
              message: "Duplicate event detected and skipped"
            })
          );
          return;
        }

        acquiredLock = true;
        await handleDomainEvent(event);
      } catch (error) {
        if (acquiredLock && eventId) {
          try {
            await db.query("delete from processed_events where event_id = $1", [eventId]);
          } catch (deleteError) {
            console.error(
              JSON.stringify({
                service: "worker",
                status: "lock_cleanup_failed",
                eventId,
                message: deleteError instanceof Error ? deleteError.message : "Lock cleanup failed"
              })
            );
          }
        }

        console.error(
          JSON.stringify({
            service: "worker",
            status: "consume_failed",
            eventId,
            message: error instanceof Error ? error.message : "Unknown consumer failure"
          })
        );
      }
    }
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPublisherLoop() {
  while (true) {
    try {
      await publishPendingOutboxEvents();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown worker loop failure";
      console.error(
        JSON.stringify({
          service: "worker",
          status: "loop_failed",
          message
        })
      );
    }

    await sleep(1000);
  }
}

async function run() {
  console.log(
    JSON.stringify({
      service: "worker",
      status: "starting",
      app: config.appName,
      brokers: config.kafkaBrokers,
      clientId: config.kafkaClientId,
      outboxTopic: config.kafkaOutboxTopic
    })
  );

  // Render requires Web Services to bind to a port, even if they only run background jobs.
  const http = await import("http");
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Worker is healthy");
  });
  server.listen(config.port, "0.0.0.0", () => {
    console.log(`Dummy health server listening on port ${config.port}`);
  });

  await Promise.all([startConsumer(), runPublisherLoop(), runReconciliationLoop()]);
}

run().catch((error) => {
  console.error(
    JSON.stringify({
      service: "worker",
      status: "fatal",
      message: error instanceof Error ? error.message : "Unknown fatal worker error"
    })
  );
  process.exitCode = 1;
});
