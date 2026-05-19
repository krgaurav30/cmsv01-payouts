import { loadConfig } from "@cmsv01/shared/config";
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
const apiBaseUrl = `http://127.0.0.1:${config.port}`;

let producerConnected = false;
let consumerConnected = false;

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
    await fetch(`${apiBaseUrl}/v1/payouts/file-uploads/${event.aggregateId}/process`, {
      method: "POST"
    });
    return;
  }

  if (
    event.aggregateType === "transaction-command" &&
    event.eventType === "transaction.command.accepted"
  ) {
    await fetch(`${apiBaseUrl}/v1/payouts/commands/${event.aggregateId}/process`, {
      method: "POST"
    });
    return;
  }

  if (event.aggregateType !== "transaction") {
    return;
  }

  const batchId = event.aggregateId;

  await syncTransactionProjection(batchId);

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
    const dispatchResponse = await fetch(`${apiBaseUrl}/v1/payouts/batches/${batchId}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        actedByUserId: "system-worker",
        comment: "Automatically sent to bank by background dispatch worker"
      })
    });

    if (dispatchResponse.ok) {
      await fetch(`${apiBaseUrl}/v1/payouts/batches/${batchId}/simulate-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          actedByUserId: "system-worker",
          comment: "Mock bank response processed by background worker"
        })
      });
      await syncTransactionProjection(batchId);
    }
  }
}

async function startConsumer() {
  await ensureConsumerConnected();
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value.toString()) as DomainEventEnvelope;
        await handleDomainEvent(event);
      } catch (error) {
        console.error(
          JSON.stringify({
            service: "worker",
            status: "consume_failed",
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

  await Promise.all([startConsumer(), runPublisherLoop()]);
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
