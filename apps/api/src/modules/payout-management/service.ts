import { loadConfig } from "@cmsv01/shared/config";
import {
  getDatabasePool,
  type DatabaseExecutor,
  withDatabaseTransaction
} from "@cmsv01/shared/db";
import {
  createDomainEvent,
  type AggregateType,
  type DomainEventType
} from "@cmsv01/shared/events";
import { appendOutboxEvent } from "@cmsv01/shared/outbox";

import { ApprovalMatrixManagementService } from "../approval-matrix-management/service.js";
import { BeneficiaryManagementService } from "../beneficiary-management/service.js";
import { EffectiveSettingsResolverService } from "../effective-settings-resolver/service.js";
import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { SettingsManagementService } from "../settings-management/service.js";
import { SubscriptionManagementService } from "../subscription-management/service.js";
import { TenantManagementService } from "../tenant-management/service.js";

import type {
  PayoutApprovalActionRequest,
  PayoutBatch,
  PayoutBatchCreateRequest,
  PayoutBulkCreateRequest,
  PayoutFileUpload,
  PayoutFileUploadCreateRequest,
  PayoutDispatchRequest,
  PayoutItem,
  PublishedPayoutApprovalRequest,
  PublishedPayoutCreateRequest,
  PayoutRefund,
  PayoutRefundCreateRequest,
  PayoutSimulationRequest,
  PayoutTimelineEvent
} from "./contracts.js";
import type { EffectiveSettingsSnapshot } from "../effective-settings-resolver/contracts.js";

type PayoutBatchRow = {
  batch_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  source_upload_id?: string | null;
  subscription_id: string | null;
  package_code: string | null;
  debit_account_id?: string | null;
  payment_method_code?: string | null;
  primary_beneficiary_id?: string | null;
  primary_beneficiary_name?: string | null;
  created_by_user_id: string;
  created_by_role: string | null;
  title: string;
  tag: string | null;
  remark: string | null;
  state: PayoutBatch["state"];
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
  utr: string | null;
  narration: string | null;
  approval_levels_required?: number | null;
  current_approval_level?: number | null;
  roles_by_level?: Array<{ level: number; roles: string[] }> | null;
  matched_matrix_ids?: string[] | null;
};

type PayoutItemRow = {
  item_id: string;
  batch_id: string;
  beneficiary_id: string;
  amount: string;
  currency: string;
  purpose: string;
  state: PayoutItem["state"];
  bank_reference: string | null;
  failure_reason: string | null;
  processed_at: Date | null;
};

type PayoutRefundRow = {
  refund_id: string;
  batch_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  subscription_id: string | null;
  package_code: string | null;
  requested_by_user_id: string;
  amount: string;
  reason: string;
  state: PayoutRefund["state"];
  created_at: Date | null;
  processed_at: Date | null;
};

type PayoutFileUploadRow = {
  upload_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  subscription_id: string | null;
  package_code: string | null;
  debit_account_id?: string | null;
  file_name: string;
  uploaded_by_user_id: string;
  uploaded_by_role: string | null;
  status: PayoutFileUpload["status"];
  remark: string | null;
  total_rows: number;
  created_count: number;
  rejected_count: number;
  uploaded_at: Date | null;
  utr: string | null;
  payload_json?: Array<{
    paymentMethodCode: string;
    transactionReference: string;
    beneficiaryId: string;
    debitAccountNumber?: string | null;
    amount: number;
    tag?: string | null;
    remark?: string | null;
  }> | null;
  processing_started_at?: Date | null;
  processed_at?: Date | null;
};

type PayoutBatchApprovalContextRow = {
  batch_id: string;
  corporate_tenant_id: string;
  entity_type: "transaction";
  approval_levels_required: number;
  current_approval_level: number;
  roles_by_level: Array<{ level: number; roles: string[] }> | null;
  matched_matrix_ids: string[] | null;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
};

type TransactionListProjectionRow = PayoutBatchRow;

type TransactionCommandRow = {
  command_id: string;
  channel: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string;
  subscription_id: string | null;
  package_code: string | null;
  debit_account_id?: string | null;
  actor_user_id: string;
  transaction_reference: string;
  payload_json: PayoutBatchCreateRequest;
  status: "accepted" | "processing" | "processed" | "failed";
  batch_id: string | null;
  error_message: string | null;
  received_at: Date | null;
  processed_at: Date | null;
};

type ResolvedSubscriptionContext = {
  subscriptionId: string | null;
  packageCode: string | null;
  effectiveSettings: EffectiveSettingsSnapshot | null;
};

type ResolvedDebitAccountContext = {
  debitAccountId: string;
  accountNumber: string;
};

type SubscriptionScopeError =
  | { error: "subscription_not_found" }
  | { error: "subscription_scope_mismatch" };

export class PayoutManagementService {
  private readonly config = loadConfig();
  private readonly db = getDatabasePool(this.config);
  private readonly baseCurrency = "INR";

  constructor(
    private readonly approvalMatrixManagementService = new ApprovalMatrixManagementService(),
    private readonly tenantManagementService = new TenantManagementService(),
    private readonly beneficiaryManagementService = new BeneficiaryManagementService(),
    private readonly identityAccessService = new IdentityAccessService(loadConfig()),
    private readonly settingsManagementService = new SettingsManagementService(),
    private readonly notificationsService = new NotificationsService(),
    private readonly subscriptionManagementService = new SubscriptionManagementService(),
    private readonly effectiveSettingsResolverService = new EffectiveSettingsResolverService()
  ) {}

  async listBatches(filters?: {
    corporateTenantId?: string;
    bankTenantId?: string;
    corporateId?: string;
    subscriptionId?: string;
    packageCode?: string;
    state?: string;
    search?: string;
  }) {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filters?.corporateTenantId) {
      params.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${params.length}`);
    }

    if (filters?.bankTenantId) {
      params.push(filters.bankTenantId);
      clauses.push(`bank_tenant_id = $${params.length}`);
    }

    if (filters?.corporateId) {
      params.push(filters.corporateId);
      clauses.push(`corporate_id = $${params.length}`);
    }

    if (filters?.subscriptionId) {
      params.push(filters.subscriptionId);
      clauses.push(`subscription_id = $${params.length}`);
    }

    if (filters?.packageCode) {
      params.push(filters.packageCode);
      clauses.push(`package_code = $${params.length}`);
    }

    if (filters?.state) {
      params.push(filters.state);
      clauses.push(`state = $${params.length}`);
    }

    if (filters?.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(lower(title) like $${params.length} or lower(batch_id) like $${params.length})`);
    }

    const baseQuery = `select pb.batch_id, pb.bank_tenant_id, pb.corporate_tenant_id,
                              pb.corporate_id, pb.source_upload_id, pb.subscription_id, pb.package_code,
                              pb.debit_account_id, pb.payment_method_code,
                              first_item.beneficiary_id as primary_beneficiary_id,
                              first_item.beneficiary_name as primary_beneficiary_name,
                              pb.created_by_user_id, pb.created_by_role, pb.title, pb.tag, pb.remark,
                              pb.state, pb.total_amount, pb.approval_comment, pb.bank_reference,
                              pb.created_at, pb.submitted_at, pb.submitted_by_user_id, pb.submitted_by_role,
                              pb.approved_at, pb.approved_by_user_id, pb.approved_by_role, pb.rejected_at,
                              pb.rejected_by_user_id, pb.rejected_by_role, pb.dispatched_at, pb.completed_at,
                              pb.failure_reason, pb.utr, pb.narration, pac.approval_levels_required, pac.current_approval_level,
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
                       ) first_item on true`;

    const result =
      params.length > 0
        ? await this.db.query<PayoutBatchRow>(
            `${baseQuery}
             where ${clauses
               .map((clause) =>
                 clause
                   .replaceAll("corporate_tenant_id", "pb.corporate_tenant_id")
                   .replaceAll("bank_tenant_id", "pb.bank_tenant_id")
                   .replaceAll("corporate_id", "pb.corporate_id")
                   .replaceAll("subscription_id", "pb.subscription_id")
                   .replaceAll("package_code", "pb.package_code")
                   .replaceAll("state", "pb.state")
                   .replaceAll("title", "pb.title")
                   .replaceAll("batch_id", "pb.batch_id")
               )
               .join(" and ")}
             order by pb.created_at desc nulls last, pb.batch_id desc`,
            params
          )
        : await this.db.query<PayoutBatchRow>(
            `${baseQuery}
             order by pb.created_at desc nulls last, pb.batch_id desc`
          );

    return result.rows.map((row) => this.mapBatchListRow(row));
  }

  async getBatch(batchId: string) {
    const result = await this.db.query<PayoutBatchRow>(
      `select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
              source_upload_id, package_code, debit_account_id, payment_method_code, created_by_user_id, created_by_role, title, tag, remark, state,
              total_amount, approval_comment, bank_reference, created_at, submitted_at,
              submitted_by_user_id, submitted_by_role, approved_at, approved_by_user_id,
              approved_by_role, rejected_at,
              rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
              failure_reason, utr, narration
       from payout_batches
       where batch_id = $1`,
      [batchId]
    );

    const row = result.rows[0];
    return row ? this.mapBatchRow(row) : null;
  }

  async createBatch(payload: PayoutBatchCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);
    const corporateTenant = await this.tenantManagementService.getCorporateTenant(
      payload.corporateTenantId
    );
    const corporate = await this.tenantManagementService.getCorporate(payload.corporateId);

    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.createdByUserId,
        "transaction.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    if (!bankTenant) {
      return {
        error: "bank_not_found" as const
      };
    }

    if (!corporateTenant) {
      return {
        error: "corporate_not_found" as const
      };
    }

    if (!corporate || corporate.corporateTenantId !== payload.corporateTenantId) {
      return {
        error: "child_corporate_not_found" as const
      };
    }

    const resolvedSubscription = await this.resolveSubscriptionContext({
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: payload.subscriptionId,
      packageCode: payload.packageCode
    });

    if ("error" in resolvedSubscription) {
      return resolvedSubscription;
    }

    const settings = await this.settingsManagementService.getSettingsForCorporateTenant(
      payload.corporateTenantId
    );
    const effectiveSingleLimit = settings?.maxSingleTransactionAmount ?? 500_000;
    const effectiveDailyLimit =
      settings?.maxDailyCumulativeTransactionAmount ?? 5_000_000;

    if (settings?.duplicateReferencePolicy !== "disabled") {
      const existingReference = await this.findBatchByReference(
        payload.corporateTenantId,
        payload.corporateId,
        payload.title
      );

      if (existingReference && existingReference.batchId !== payload.batchId) {
        return {
          error: "duplicate_transaction_reference" as const,
          transactionReference: payload.title,
          existingState: existingReference.state
        };
      }
    }

    const selectedPaymentMethod = this.resolveSelectedPaymentMethod(
      resolvedSubscription.effectiveSettings,
      payload.paymentMethodCode
    );

    if (selectedPaymentMethod && "error" in selectedPaymentMethod) {
      return selectedPaymentMethod;
    }

    const selectedPaymentMethodCode = selectedPaymentMethod?.paymentMethodCode ?? null;

    const resolvedDebitAccount = await this.resolveSelectedDebitAccount(
      payload.corporateTenantId,
      actor.role,
      resolvedSubscription.subscriptionId,
      payload.debitAccountId
    );

    if ("error" in resolvedDebitAccount) {
      return resolvedDebitAccount;
    }

    const allowedBeneficiaryTypes = new Set(
      (resolvedSubscription.effectiveSettings?.allowedBeneficiaryTypes ?? []).map((type) =>
        type.toLowerCase()
      )
    );

    for (const item of payload.items) {
      const beneficiary = await this.beneficiaryManagementService.getBeneficiary(
        item.beneficiaryId
      );

      if (!beneficiary) {
        return {
          error: "beneficiary_not_found" as const,
          beneficiaryId: item.beneficiaryId
        };
      }

      if (beneficiary.corporateId !== payload.corporateId) {
        return {
          error: "beneficiary_corporate_mismatch" as const,
          beneficiaryId: item.beneficiaryId
        };
      }

      if (beneficiary.approvalState !== "approved") {
        return {
          error: "beneficiary_not_approved" as const,
          beneficiaryId: item.beneficiaryId
        };
      }

      if (beneficiary.status !== "active") {
        return {
          error: "beneficiary_inactive" as const,
          beneficiaryId: item.beneficiaryId
        };
      }

      if (
        allowedBeneficiaryTypes.size > 0 &&
        !allowedBeneficiaryTypes.has(beneficiary.beneficiaryType.toLowerCase())
      ) {
        return {
          error: "beneficiary_type_not_allowed" as const,
          beneficiaryId: item.beneficiaryId,
          beneficiaryType: beneficiary.beneficiaryType,
          packageCode: resolvedSubscription.packageCode ?? payload.packageCode ?? null
        };
      }

      if (
        resolvedSubscription.packageCode &&
        !beneficiary.assignedPackages.some(
          (assignedPackage) => assignedPackage.packageCode === resolvedSubscription.packageCode
        )
      ) {
        return {
          error: "beneficiary_package_not_assigned" as const,
          beneficiaryId: item.beneficiaryId,
          packageCode: resolvedSubscription.packageCode
        };
      }

      if (
        selectedPaymentMethod &&
        selectedPaymentMethod.minAmount !== null &&
        item.amount.value < selectedPaymentMethod.minAmount
      ) {
        return {
          error: "payment_method_amount_out_of_range" as const,
          paymentMethodCode: selectedPaymentMethod.paymentMethodCode,
          minAmount: selectedPaymentMethod.minAmount,
          maxAmount: selectedPaymentMethod.maxAmount,
          amount: item.amount.value
        };
      }

      if (
        selectedPaymentMethod &&
        selectedPaymentMethod.maxAmount !== null &&
        item.amount.value > selectedPaymentMethod.maxAmount
      ) {
        return {
          error: "payment_method_amount_out_of_range" as const,
          paymentMethodCode: selectedPaymentMethod.paymentMethodCode,
          minAmount: selectedPaymentMethod.minAmount,
          maxAmount: selectedPaymentMethod.maxAmount,
          amount: item.amount.value
        };
      }
    }

    const totalAmount = payload.items.reduce((sum, item) => sum + item.amount.value, 0);

    if (totalAmount > effectiveSingleLimit) {
      return {
        error: "single_transaction_limit_exceeded" as const,
        limit: effectiveSingleLimit
      };
    }

    const currentDailyTotal = await this.getCurrentDailyCumulativeAmount(
      payload.corporateTenantId,
      payload.corporateId,
      payload.batchId
    );

    if (currentDailyTotal + totalAmount > effectiveDailyLimit) {
      return {
        error: "daily_cumulative_limit_exceeded" as const,
        limit: effectiveDailyLimit,
        currentTotal: currentDailyTotal
      };
    }

    const batchUtr = payload.utr || generate16DigitUtr();
    let batchNarration = payload.narration;
    if (!batchNarration) {
      const packageCode = resolvedSubscription.packageCode || payload.packageCode || "PAYOUT";
      const remarkSuffix = payload.remark ? `-${payload.remark}` : "";
      batchNarration = `CMS-${batchUtr}-${packageCode}${remarkSuffix}`.slice(0, 64);
    }

    await withDatabaseTransaction(this.config, async (client) => {
      await client.query(
        `insert into payout_batches (
           batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, created_by_user_id,
           source_upload_id, subscription_id, package_code, debit_account_id, payment_method_code, created_by_role, title, tag, remark, state,
           total_amount, approval_comment,
           bank_reference, created_at, submitted_at, submitted_by_user_id, submitted_by_role,
           approved_at, approved_by_user_id, approved_by_role, rejected_at,
           rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
           failure_reason, utr, narration
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15, null, null, now(),
                 null, null, null, null, null, null, null, null, null, null, null, null, $16, $17)
         on conflict (batch_id) do update
         set bank_tenant_id = excluded.bank_tenant_id,
             corporate_tenant_id = excluded.corporate_tenant_id,
             corporate_id = excluded.corporate_id,
             created_by_user_id = excluded.created_by_user_id,
             source_upload_id = excluded.source_upload_id,
             subscription_id = excluded.subscription_id,
             package_code = excluded.package_code,
             debit_account_id = excluded.debit_account_id,
             payment_method_code = excluded.payment_method_code,
             created_by_role = excluded.created_by_role,
             title = excluded.title,
             tag = excluded.tag,
             remark = excluded.remark,
             total_amount = excluded.total_amount,
             utr = coalesce(payout_batches.utr, excluded.utr),
             narration = coalesce(payout_batches.narration, excluded.narration)`,
        [
          payload.batchId,
          payload.bankTenantId,
          payload.corporateTenantId,
          payload.corporateId,
          payload.createdByUserId,
          payload.sourceUploadId ?? null,
          resolvedSubscription.subscriptionId,
          resolvedSubscription.packageCode,
          resolvedDebitAccount.debitAccountId,
          selectedPaymentMethodCode,
          actor.role,
          payload.title,
          payload.tag ?? null,
          payload.remark ?? null,
          totalAmount,
          batchUtr,
          batchNarration
        ]
      );

      await client.query(`delete from payout_items where batch_id = $1`, [payload.batchId]);

      for (const item of payload.items) {
        await client.query(
          `insert into payout_items (
             item_id, batch_id, beneficiary_id, amount, currency, purpose, state,
             bank_reference, failure_reason, processed_at
           )
           values ($1, $2, $3, $4, $5, $6, 'pending', null, null, null)`,
          [
            item.itemId,
            payload.batchId,
            item.beneficiaryId,
            item.amount.value,
            item.amount.currency,
            item.purpose
          ]
        );
      }

      await this.appendTransactionOutboxEvent(client, payload.batchId, "transaction.created", {
        batchId: payload.batchId,
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId,
        packageCode: resolvedSubscription.packageCode,
        debitAccountId: resolvedDebitAccount.debitAccountId,
        transactionReference: payload.title,
        totalAmount: {
          value: totalAmount,
          currency: this.baseCurrency
        },
        itemCount: payload.items.length,
        createdByUserId: payload.createdByUserId,
        createdByRole: actor.role,
        state: "draft",
        utr: batchUtr,
        narration: batchNarration,
        occurredAt: new Date().toISOString()
      });
    });

    return {
      data: await this.getBatch(payload.batchId)
    };
  }

  async createBulkBatches(payload: PayoutBulkCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.createdByUserId,
        "transaction.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    const settings = await this.settingsManagementService.getSettingsForCorporateTenant(
      payload.corporateTenantId
    );
    const effectiveBulkRowLimit = settings?.maxBulkUploadRows ?? 100;
    const resolvedSubscription = await this.resolveSubscriptionContext({
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: payload.subscriptionId,
      packageCode: payload.packageCode
    });

    if ("error" in resolvedSubscription) {
      return resolvedSubscription;
    }

    const existingFileUpload = await this.findFileUploadByName(
      payload.corporateTenantId,
      payload.corporateId,
      payload.fileName
    );

    if (existingFileUpload) {
      const fileUploadResult = await this.recordFileUpload({
        uploadId: createSimpleId("upload"),
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
        packageCode: resolvedSubscription.packageCode ?? undefined,
        fileName: payload.fileName,
        uploadedByUserId: payload.createdByUserId,
        status: "rejected",
        remark: `File name already uploaded earlier as ${existingFileUpload.status}`,
        totalRows: payload.rows.length,
        createdCount: 0,
        rejectedCount: payload.rows.length
      });

      return {
        error: "duplicate_file_name" as const,
        fileName: payload.fileName,
        fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
      };
    }

    if (payload.rows.length > effectiveBulkRowLimit) {
      const fileUploadResult = await this.recordFileUpload({
        uploadId: createSimpleId("upload"),
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
        packageCode: resolvedSubscription.packageCode ?? undefined,
        fileName: payload.fileName,
        uploadedByUserId: payload.createdByUserId,
        status: "rejected",
        remark: `File exceeds maximum allowed rows (${effectiveBulkRowLimit})`,
        totalRows: payload.rows.length,
        createdCount: 0,
        rejectedCount: payload.rows.length
      });

      return {
        error: "bulk_upload_row_limit_exceeded" as const,
        limit: effectiveBulkRowLimit,
        fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
      };
    }

    const referencesSeen = new Set<string>();
    const beneficiaries = await this.beneficiaryManagementService.listBeneficiaries({
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId
    });

    const beneficiaryMap = new Map(
      beneficiaries.map((beneficiary) => [
        beneficiary.beneficiaryId.trim().toUpperCase(),
        beneficiary
      ])
    );

    const created: PayoutBatch[] = [];
    const rejected: Array<{ rowNumber: number; transactionReference: string; reason: string }> = [];

    for (const [index, row] of payload.rows.entries()) {
      const transactionReference = row.transactionReference.trim();
      const normalizedReference = transactionReference.toLowerCase();
      const rowNumber = index + 2;

      if (
        settings?.duplicateReferencePolicy !== "disabled" &&
        referencesSeen.has(normalizedReference)
      ) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: "Duplicate transaction reference found inside the uploaded file"
        });
        continue;
      }

      if (settings?.duplicateReferencePolicy !== "disabled") {
        referencesSeen.add(normalizedReference);
      }

      const beneficiary = beneficiaryMap.get(row.beneficiaryId.trim().toUpperCase());
      if (!beneficiary) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: `Beneficiary not found: ${row.beneficiaryId}`
        });
        continue;
      }

      let debitAccountId: string | undefined;
      if (row.debitAccountNumber) {
        const resolvedDebitAccountId = resolvedSubscription.subscriptionId
          ? await this.resolveDebitAccountIdByNumber(
              resolvedSubscription.subscriptionId,
              row.debitAccountNumber
            )
          : null;
        debitAccountId = resolvedDebitAccountId ?? undefined;

        if (!debitAccountId) {
          rejected.push({
            rowNumber,
            transactionReference,
            reason: `Debit account not found for this package: ${row.debitAccountNumber}`
          });
          continue;
        }
      }

      const resolvedPaymentMethod = this.resolveSelectedPaymentMethod(
        resolvedSubscription.effectiveSettings,
        row.paymentMethodCode
      );

      if (resolvedPaymentMethod && "error" in resolvedPaymentMethod) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: mapBulkCreateErrorToMessage(resolvedPaymentMethod)
        });
        continue;
      }

      const createResult = await this.createBatch({
        batchId: crypto.randomUUID(),
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
        packageCode: resolvedSubscription.packageCode ?? undefined,
        debitAccountId,
        paymentMethodCode:
          resolvedPaymentMethod && !("error" in resolvedPaymentMethod)
            ? resolvedPaymentMethod.paymentMethodCode
            : undefined,
        createdByUserId: payload.createdByUserId,
        title: transactionReference,
        tag: row.tag,
        remark: row.remark,
        items: [
          {
            itemId: `${createSimpleId("ITEM")}-${index + 1}`,
            beneficiaryId: beneficiary.beneficiaryId,
            amount: {
              value: row.amount,
              currency: this.baseCurrency
            },
            purpose: row.remark ?? transactionReference
          }
        ]
      });

      if (!("data" in createResult)) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: mapBulkCreateErrorToMessage(
            createResult as Parameters<typeof mapBulkCreateErrorToMessage>[0]
          )
        });
        continue;
      }

      const submitResult = await this.applyApprovalAction(createResult.data!.batchId, {
        action: "submit",
        actedByUserId: payload.createdByUserId,
        comment: `Submitted in bulk upload by maker ${actor.username}`
      });

      if ("error" in submitResult) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: "Transaction was created but could not be submitted for approval"
        });
        continue;
      }

      created.push(submitResult.data!);
    }

    const status =
      created.length === payload.rows.length
        ? "successful"
        : created.length > 0
          ? "partially_successful"
          : "failed";

    const remark =
      rejected.length > 0
        ? rejected
            .slice(0, 5)
            .map(
              (item) =>
                `Row ${item.rowNumber} (${item.transactionReference}): ${item.reason}`
            )
            .join(" | ")
        : undefined;

    const fileUploadResult = await this.recordFileUpload({
      uploadId: createSimpleId("upload"),
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
      packageCode: resolvedSubscription.packageCode ?? undefined,
      fileName: payload.fileName,
      uploadedByUserId: payload.createdByUserId,
      status,
      remark,
      totalRows: payload.rows.length,
      createdCount: created.length,
      rejectedCount: rejected.length
    });

    return {
      data: {
        created,
        rejected,
        fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null,
        summary: {
          totalRows: payload.rows.length,
          createdCount: created.length,
          rejectedCount: rejected.length
        }
      }
    };
  }

  async acceptBulkFileUpload(payload: PayoutBulkCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.createdByUserId,
        "transaction.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    const settings = await this.settingsManagementService.getSettingsForCorporateTenant(
      payload.corporateTenantId
    );
    const effectiveBulkRowLimit = settings?.maxBulkUploadRows ?? 100;
    const resolvedSubscription = await this.resolveSubscriptionContext({
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: payload.subscriptionId,
      packageCode: payload.packageCode
    });

    if ("error" in resolvedSubscription) {
      return resolvedSubscription;
    }
    const existingFileUpload = await this.findFileUploadByName(
      payload.corporateTenantId,
      payload.corporateId,
      payload.fileName
    );

    if (existingFileUpload) {
      const fileUploadResult = await this.recordFileUpload({
        uploadId: createSimpleId("upload"),
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
        packageCode: resolvedSubscription.packageCode ?? undefined,
        fileName: payload.fileName,
        uploadedByUserId: payload.createdByUserId,
        status: "rejected",
        remark: `File name already uploaded earlier as ${existingFileUpload.status}`,
        totalRows: payload.rows.length,
        createdCount: 0,
        rejectedCount: payload.rows.length
      });

      return {
        error: "duplicate_file_name" as const,
        fileName: payload.fileName,
        fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
      };
    }

    if (payload.rows.length > effectiveBulkRowLimit) {
      const fileUploadResult = await this.recordFileUpload({
        uploadId: createSimpleId("upload"),
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
        packageCode: resolvedSubscription.packageCode ?? undefined,
        fileName: payload.fileName,
        uploadedByUserId: payload.createdByUserId,
        status: "rejected",
        remark: `File exceeds maximum allowed rows (${effectiveBulkRowLimit})`,
        totalRows: payload.rows.length,
        createdCount: 0,
        rejectedCount: payload.rows.length
      });

      return {
        error: "bulk_upload_row_limit_exceeded" as const,
        limit: effectiveBulkRowLimit,
        fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
      };
    }

    const uploadId = createSimpleId("upload");

    await withDatabaseTransaction(this.config, async (client) => {
      const uploadResult = await this.recordFileUpload(
        {
          uploadId,
          bankTenantId: payload.bankTenantId,
          corporateTenantId: payload.corporateTenantId,
          corporateId: payload.corporateId,
          subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
          packageCode: resolvedSubscription.packageCode ?? undefined,
          fileName: payload.fileName,
          uploadedByUserId: payload.createdByUserId,
          status: "processing",
          remark: "File accepted for background processing.",
          totalRows: payload.rows.length,
          createdCount: 0,
          rejectedCount: 0,
          payloadRows: payload.rows
        },
        client
      );

      if ("error" in uploadResult) {
        throw new Error("Unable to record accepted file upload");
      }

      await appendOutboxEvent(
        client,
        createDomainEvent({
          aggregateType: "file-upload",
          aggregateId: uploadId,
          eventType: "file.accepted",
          eventKey: uploadId,
          payload: {
            uploadId,
            bankTenantId: payload.bankTenantId,
            corporateTenantId: payload.corporateTenantId,
            corporateId: payload.corporateId,
            subscriptionId: resolvedSubscription.subscriptionId,
            packageCode: resolvedSubscription.packageCode,
            fileName: payload.fileName,
            uploadedByUserId: payload.createdByUserId,
            rowCount: payload.rows.length,
            occurredAt: new Date().toISOString()
          }
        })
      );
    });

    const acceptedUpload = await this.getFileUpload(uploadId);
    return {
      data: {
        fileUpload: acceptedUpload,
        summary: {
          totalRows: payload.rows.length,
          createdCount: 0,
          rejectedCount: 0
        }
      }
    };
  }

  async createPublishedTransaction(payload: PublishedPayoutCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserByUsername(
      payload.actorUsername
    );

    if (!actor) {
      return {
        error: "actor_not_found" as const
      };
    }

    const generatedBatchId = `txn-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    const generatedItemId = `${generatedBatchId}-item-001`;

    return this.acceptTransactionCommand(
      {
        batchId: generatedBatchId,
        bankTenantId: payload.bankTenantId,
        corporateTenantId: payload.corporateTenantId,
        corporateId: payload.corporateId,
        packageCode: payload.packageCode,
        debitAccountId: payload.debitAccountId,
        paymentMethodCode: payload.paymentMethodCode,
        createdByUserId: actor.userId,
        title: payload.txnTitle,
        tag: payload.tag,
        remark: payload.remark,
        items: [
          {
            itemId: generatedItemId,
            beneficiaryId: payload.beneficiaryId,
            amount: payload.amount,
            purpose: "vendor_payout"
          }
        ]
      },
      "api"
    );
  }

  async createAndSubmitBatch(payload: PayoutBatchCreateRequest) {
    const createResult = await this.createBatch(payload);

    if ("error" in createResult) {
      return createResult;
    }

    return this.applyApprovalAction(payload.batchId, {
      action: "submit",
      actedByUserId: payload.createdByUserId,
      comment: `Submitted by maker ${payload.createdByUserId}`
    });
  }

  async acceptTransactionCommand(
    payload: PayoutBatchCreateRequest,
    channel: "ui" | "api" = "ui"
  ) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
    const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);
    const corporateTenant = await this.tenantManagementService.getCorporateTenant(
      payload.corporateTenantId
    );
    const corporate = await this.tenantManagementService.getCorporate(payload.corporateId);

    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.createdByUserId,
        "transaction.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    if (!bankTenant) {
      return {
        error: "bank_not_found" as const
      };
    }

    if (!corporateTenant) {
      return {
        error: "corporate_not_found" as const
      };
    }

    if (!corporate || corporate.corporateTenantId !== payload.corporateTenantId) {
      return {
        error: "child_corporate_not_found" as const
      };
    }

    const resolvedSubscription = await this.resolveSubscriptionContext({
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: payload.subscriptionId,
      packageCode: payload.packageCode
    });

    if ("error" in resolvedSubscription) {
      return resolvedSubscription;
    }

    const commandPayload: PayoutBatchCreateRequest = {
      ...payload,
      subscriptionId: resolvedSubscription.subscriptionId ?? undefined,
      packageCode: resolvedSubscription.packageCode ?? undefined
    };

    const commandId = `cmd-${Date.now()}-${Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0")}`;

    await withDatabaseTransaction(this.config, async (client) => {
      await client.query(
        `insert into transaction_commands (
           command_id, channel, bank_tenant_id, corporate_tenant_id, corporate_id,
           subscription_id, package_code, debit_account_id, payment_method_code, actor_user_id, transaction_reference, payload_json,
           status, batch_id, error_message, received_at, processed_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'accepted', null, null, now(), null)`,
        [
          commandId,
          channel,
          payload.bankTenantId,
          payload.corporateTenantId,
          payload.corporateId,
          resolvedSubscription.subscriptionId,
          resolvedSubscription.packageCode,
          payload.debitAccountId ?? null,
          payload.paymentMethodCode ?? null,
          payload.createdByUserId,
          payload.title,
          JSON.stringify(commandPayload)
        ]
      );

      await appendOutboxEvent(
        client,
        createDomainEvent({
          aggregateType: "transaction-command",
          aggregateId: commandId,
          eventType: "transaction.command.accepted",
          eventKey: commandId,
          payload: {
            commandId,
            channel,
            bankTenantId: payload.bankTenantId,
            corporateTenantId: payload.corporateTenantId,
            corporateId: payload.corporateId,
            subscriptionId: resolvedSubscription.subscriptionId,
            packageCode: resolvedSubscription.packageCode,
            debitAccountId: payload.debitAccountId ?? null,
            actorUserId: payload.createdByUserId,
            transactionReference: payload.title,
            occurredAt: new Date().toISOString()
          }
        })
      );
    });

    return {
      data: {
        commandId,
        status: "accepted" as const,
        transactionReference: payload.title,
        subscriptionId: resolvedSubscription.subscriptionId,
        packageCode: resolvedSubscription.packageCode,
        acceptedAt: new Date().toISOString()
      }
    };
  }

  async processAcceptedTransactionCommand(commandId: string) {
    const commandResult = await this.db.query<TransactionCommandRow>(
      `select command_id, channel, bank_tenant_id, corporate_tenant_id, corporate_id,
              subscription_id, package_code, debit_account_id, actor_user_id, transaction_reference,
              payload_json, status, batch_id, error_message, received_at, processed_at
       from transaction_commands
       where command_id = $1
       for update`,
      [commandId]
    );

    const command = commandResult.rows[0];
    if (!command || command.status !== "accepted") {
      return null;
    }

    await this.db.query(
      `update transaction_commands
       set status = 'processing'
       where command_id = $1`,
      [commandId]
    );

    const processResult = await this.createAndSubmitBatch(command.payload_json);

    if (!("data" in processResult)) {
      const message = mapBulkCreateErrorToMessage(processResult as never);
      await this.db.query(
        `update transaction_commands
         set status = 'failed',
             error_message = $2,
             processed_at = now()
         where command_id = $1`,
        [commandId, message]
      );

      return {
        status: "failed" as const,
        errorMessage: message
      };
    }

    await this.db.query(
      `update transaction_commands
       set status = 'processed',
           batch_id = $2,
           processed_at = now(),
           error_message = null
       where command_id = $1`,
      [commandId, processResult.data?.batchId ?? null]
    );

    return {
      status: "processed" as const,
      batchId: processResult.data?.batchId ?? null
    };
  }

  async authorizePublishedTransaction(
    batchId: string,
    payload: PublishedPayoutApprovalRequest
  ) {
    const actor = await this.identityAccessService.getCorporateUserByUsername(
      payload.actorUsername
    );

    if (!actor) {
      return {
        error: "actor_not_found" as const
      };
    }

    return this.applyApprovalAction(batchId, {
      action: payload.action,
      actedByUserId: actor.userId,
      comment: payload.comment
    });
  }

  async applyApprovalAction(batchId: string, payload: PayoutApprovalActionRequest) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    const batch = await this.getBatch(batchId);

    if (!actor || actor.approvalState !== "approved") {
      return {
        error: "forbidden" as const
      };
    }

    if (
      payload.action === "submit" &&
      !(await this.identityAccessService.userHasPermission(
        payload.actedByUserId,
        "transaction.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    if (
      ["approve", "reject"].includes(payload.action) &&
      !(await this.identityAccessService.userHasPermission(
        payload.actedByUserId,
        "transaction.checker"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    if (
      ["approve", "reject"].includes(payload.action) &&
      batch?.subscriptionId &&
      !(await this.identityAccessService.userHasActiveSubscriptionAccess(
        batch.subscriptionId,
        payload.actedByUserId
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    if (!batch) {
      return {
        error: "batch_not_found" as const
      };
    }

    const nextState = this.resolveNextState(batch.state, payload.action);
    if (!nextState) {
      return {
        error: "invalid_transition" as const,
        currentState: batch.state
      };
    }

    const now = new Date();
    if (payload.action === "submit") {
      await withDatabaseTransaction(this.config, async (client) => {
        await client.query(
          `update payout_batches
           set state = $2,
               approval_comment = $3,
               submitted_at = $4,
               submitted_by_user_id = $5,
               submitted_by_role = $6
           where batch_id = $1`,
          [batchId, nextState, payload.comment ?? batch.approvalComment, now, actor.userId, actor.role]
        );

        await this.initializeApprovalContext(
          batchId,
          batch.corporateTenantId,
          batch.subscriptionId,
          batch.debitAccountId,
          batch.totalAmount.value,
          client
        );

        await this.appendTransactionOutboxEvent(client, batchId, "transaction.submitted", {
          batchId,
          transactionReference: batch.title,
          bankTenantId: batch.bankTenantId,
          corporateTenantId: batch.corporateTenantId,
          corporateId: batch.corporateId,
          totalAmount: batch.totalAmount,
          actedByUserId: actor.userId,
          actedByRole: actor.role,
          comment: payload.comment ?? batch.approvalComment,
          state: nextState,
          occurredAt: now.toISOString()
        });
      });
    } else {
      const actionResult = await withDatabaseTransaction(this.config, async (client) => {
        const lockedBatchResult = await client.query<{
          state: PayoutBatch["state"];
          approval_comment: string | null;
        }>(
          `select state, approval_comment
           from payout_batches
           where batch_id = $1
           for update`,
          [batchId]
        );

        const lockedBatch = lockedBatchResult.rows[0];
        if (!lockedBatch) {
          return {
            error: "batch_not_found" as const
          };
        }

        if (!["pending_approval", "partially_approved"].includes(lockedBatch.state)) {
          return {
            error: "approval_action_in_progress" as const
          };
        }

        const context = await this.getApprovalContextRow(batchId, true, client);
        const currentLevel = context?.current_approval_level ?? 1;
        const currentRoles = this.getRolesForLevel(context, currentLevel);

        if (currentRoles.length > 0 && !currentRoles.includes(actor.role)) {
          return {
            error: "forbidden" as const
          };
        }

        await client.query(
          `insert into payout_batch_approval_actions (
             action_id, batch_id, approval_level, action, actor_user_id, actor_role, comment, created_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, now())`,
          [
            `${batchId}-${currentLevel}-${payload.action}-${Date.now()}`,
            batchId,
            currentLevel,
            payload.action,
            actor.userId,
            actor.role,
            payload.comment ?? null
          ]
        );

        if (payload.action === "approve") {
          const requiredLevels = context?.approval_levels_required ?? 1;
          if (currentLevel < requiredLevels) {
            await client.query(
              `update payout_batch_approval_contexts
               set current_approval_level = $2,
                   updated_at = now()
               where batch_id = $1`,
              [batchId, currentLevel + 1]
            );

            await client.query(
              `update payout_batches
               set state = 'partially_approved',
                   approval_comment = $2
               where batch_id = $1`,
              [
                batchId,
                payload.comment ??
                  `Approval level ${currentLevel} completed by ${actor.role}`
              ]
            );
            await this.appendTransactionOutboxEvent(
              client,
              batchId,
              "transaction.partially_approved",
              {
                batchId,
                transactionReference: batch.title,
                bankTenantId: batch.bankTenantId,
                corporateTenantId: batch.corporateTenantId,
                corporateId: batch.corporateId,
                totalAmount: batch.totalAmount,
                actedByUserId: actor.userId,
                actedByRole: actor.role,
                comment:
                  payload.comment ??
                  `Approval level ${currentLevel} completed by ${actor.role}`,
                state: "partially_approved",
                approvalLevel: currentLevel,
                approvalLevelsRequired: requiredLevels,
                nextApprovalLevel: currentLevel + 1,
                occurredAt: now.toISOString()
              }
            );
          } else {
            if (context) {
              await client.query(
                `update payout_batch_approval_contexts
                 set status = 'approved',
                     updated_at = now()
                 where batch_id = $1`,
                [batchId]
              );
            }

            await client.query(
              `update payout_batches
               set state = $2,
                   approval_comment = $3,
                   approved_at = $4,
                   approved_by_user_id = $5,
                   approved_by_role = $6
               where batch_id = $1`,
              [
                batchId,
                nextState,
                payload.comment ?? lockedBatch.approval_comment,
                now,
                actor.userId,
                actor.role
              ]
            );
            await this.appendTransactionOutboxEvent(
              client,
              batchId,
              "transaction.approved",
              {
                batchId,
                transactionReference: batch.title,
                bankTenantId: batch.bankTenantId,
                corporateTenantId: batch.corporateTenantId,
                corporateId: batch.corporateId,
                totalAmount: batch.totalAmount,
                actedByUserId: actor.userId,
                actedByRole: actor.role,
                comment: payload.comment ?? lockedBatch.approval_comment,
                state: nextState,
                approvalLevel: currentLevel,
                approvalLevelsRequired: requiredLevels,
                occurredAt: now.toISOString()
              }
            );
          }
        } else {
          if (context) {
            await client.query(
              `update payout_batch_approval_contexts
               set status = 'rejected',
                   updated_at = now()
               where batch_id = $1`,
              [batchId]
            );
          }

          await client.query(
            `update payout_batches
             set state = $2,
                 approval_comment = $3,
                 rejected_at = $4,
                 rejected_by_user_id = $5,
                 rejected_by_role = $6
             where batch_id = $1`,
            [
              batchId,
              nextState,
              payload.comment ?? lockedBatch.approval_comment,
              now,
              actor.userId,
              actor.role
            ]
          );

          await this.appendTransactionOutboxEvent(client, batchId, "transaction.rejected", {
            batchId,
            transactionReference: batch.title,
            bankTenantId: batch.bankTenantId,
            corporateTenantId: batch.corporateTenantId,
            corporateId: batch.corporateId,
            totalAmount: batch.totalAmount,
            actedByUserId: actor.userId,
            actedByRole: actor.role,
            comment: payload.comment ?? lockedBatch.approval_comment,
            state: nextState,
            approvalLevel: currentLevel,
            occurredAt: now.toISOString()
          });
        }
      });

      if (actionResult && "error" in actionResult) {
        return actionResult;
      }
    }

    const updatedBatch = await this.getBatch(batchId);

    if (updatedBatch) {
      if (payload.action === "submit") {
        this.notificationsService.notifyPermissionRecipientsInBackground({
          corporateTenantId: updatedBatch.corporateTenantId,
          corporateId: updatedBatch.corporateId,
          permission: "transaction.checker",
          title: "Transaction approval pending",
          message: `${updatedBatch.title} is waiting for checker approval.`,
          targetSection: "approvals",
          entityType: "transaction",
          entityId: updatedBatch.batchId
        });
      }

      if (payload.action === "approve" || payload.action === "reject") {
        this.notificationsService.notifyPermissionRecipientsInBackground({
          corporateTenantId: updatedBatch.corporateTenantId,
          corporateId: updatedBatch.corporateId,
          permission: "transaction.make",
          title: `Transaction ${payload.action === "approve" ? "approved" : "rejected"}`,
          message: `${updatedBatch.title} was ${payload.action === "approve" ? "approved" : "rejected"} by ${actor.displayName}.`,
          targetSection: "transactions",
          entityType: "transaction",
          entityId: updatedBatch.batchId
        });
      }
    }

    return {
      data: updatedBatch
    };
  }

  async dispatchBatch(batchId: string, payload: PayoutDispatchRequest) {
    const batch = await this.getBatch(batchId);

    if (!batch) {
      return {
        error: "batch_not_found" as const
      };
    }

    if (batch.state !== "approved") {
      return {
        error: "invalid_transition" as const,
        currentState: batch.state
      };
    }

    const dispatchedAt = new Date();
    const batchReference = this.generateBankReference(batch.bankTenantId, batchId);

    await withDatabaseTransaction(this.config, async (client) => {
      await client.query(
        `update payout_batches
         set state = 'sent_to_bank',
             approval_comment = $2,
             bank_reference = $3,
             dispatched_at = $4,
             completed_at = null,
             failure_reason = null
         where batch_id = $1`,
        [
          batchId,
          payload.comment ?? `Dispatched by ${payload.actedByUserId}`,
          batchReference,
          dispatchedAt
        ]
      );

      for (const item of batch.items) {
        await client.query(
          `update payout_items
           set state = 'sent_to_bank',
               bank_reference = $2,
               failure_reason = null,
               processed_at = null
           where item_id = $1`,
          [item.itemId, `${batchReference}-${item.itemId.toUpperCase()}`]
        );
      }

      await this.appendTransactionOutboxEvent(client, batchId, "transaction.sent_to_bank", {
        batchId,
        transactionReference: batch.title,
        bankTenantId: batch.bankTenantId,
        corporateTenantId: batch.corporateTenantId,
        corporateId: batch.corporateId,
        totalAmount: batch.totalAmount,
        bankReference: batchReference,
        actedByUserId: payload.actedByUserId,
        comment: payload.comment ?? `Dispatched by ${payload.actedByUserId}`,
        state: "sent_to_bank",
        occurredAt: dispatchedAt.toISOString()
      });
    });

    return {
      data: await this.getBatch(batchId)
    };
  }

  async listRefunds(filters?: {
    corporateTenantId?: string;
    batchId?: string;
    corporateId?: string;
    subscriptionId?: string;
    packageCode?: string;
  }) {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filters?.corporateTenantId) {
      params.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${params.length}`);
    }

    if (filters?.batchId) {
      params.push(filters.batchId);
      clauses.push(`batch_id = $${params.length}`);
    }

    if (filters?.corporateId) {
      params.push(filters.corporateId);
      clauses.push(`corporate_id = $${params.length}`);
    }

    if (filters?.subscriptionId) {
      params.push(filters.subscriptionId);
      clauses.push(`subscription_id = $${params.length}`);
    }

    if (filters?.packageCode) {
      params.push(filters.packageCode);
      clauses.push(`package_code = $${params.length}`);
    }

    const result =
      params.length > 0
        ? await this.db.query<PayoutRefundRow>(
            `select refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, requested_by_user_id, amount, reason,
                    state, created_at, processed_at
             from payout_refunds
             where ${clauses.join(" and ")}
             order by refund_id desc`,
            params
          )
        : await this.db.query<PayoutRefundRow>(
            `select refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, requested_by_user_id, amount, reason,
                    state, created_at, processed_at
             from payout_refunds
             order by refund_id desc`
          );

    return result.rows.map(mapRefundRow);
  }

  async listFileUploads(filters?: {
    corporateTenantId?: string;
    corporateId?: string;
    bankTenantId?: string;
    subscriptionId?: string;
    packageCode?: string;
  }) {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filters?.corporateTenantId) {
      params.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${params.length}`);
    }

    if (filters?.corporateId) {
      params.push(filters.corporateId);
      clauses.push(`corporate_id = $${params.length}`);
    }

    if (filters?.subscriptionId) {
      params.push(filters.subscriptionId);
      clauses.push(`subscription_id = $${params.length}`);
    }

    if (filters?.packageCode) {
      params.push(filters.packageCode);
      clauses.push(`package_code = $${params.length}`);
    }

    if (filters?.bankTenantId) {
      params.push(filters.bankTenantId);
      clauses.push(`bank_tenant_id = $${params.length}`);
    }

    const projectionResult =
      params.length > 0
        ? await this.db.query<PayoutFileUploadRow>(
            `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, file_name, uploaded_by_user_id,
                    uploaded_by_role, status, remark, total_rows, created_count,
                    rejected_count, uploaded_at
             from file_upload_projection
             where ${clauses.join(" and ")}
             order by uploaded_at desc nulls last, upload_id desc`,
            params
          )
        : await this.db.query<PayoutFileUploadRow>(
            `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, file_name, uploaded_by_user_id,
                    uploaded_by_role, status, remark, total_rows, created_count,
                    rejected_count, uploaded_at
             from file_upload_projection
             order by uploaded_at desc nulls last, upload_id desc`
          );

    const result = projectionResult.rows.length
      ? projectionResult
      : params.length > 0
        ? await this.db.query<PayoutFileUploadRow>(
            `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, file_name, uploaded_by_user_id,
                    uploaded_by_role, status, remark, total_rows, created_count,
                    rejected_count, uploaded_at
             from payout_file_uploads
             where ${clauses.join(" and ")}
             order by uploaded_at desc nulls last, upload_id desc`,
            params
          )
        : await this.db.query<PayoutFileUploadRow>(
            `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    subscription_id, package_code, file_name, uploaded_by_user_id,
                    uploaded_by_role, status, remark, total_rows, created_count,
                    rejected_count, uploaded_at
             from payout_file_uploads
             order by uploaded_at desc nulls last, upload_id desc`
          );

    const userIds = [...new Set(result.rows.map((r) => r.uploaded_by_user_id).filter(Boolean))];
    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const usersResult = await this.db.query<{ user_id: string; display_name: string }>(
        `select user_id, display_name
         from corporate_users
         where user_id = any($1)`,
        [userIds]
      );
      for (const u of usersResult.rows) {
        userMap.set(u.user_id, u.display_name);
      }
    }

    return result.rows.map((row) => ({
      uploadId: row.upload_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      subscriptionId: row.subscription_id,
      packageCode: row.package_code,
      debitAccountId: row.debit_account_id ?? null,
      fileName: row.file_name,
      uploadedByUserId: row.uploaded_by_user_id,
      uploadedByRole: row.uploaded_by_role,
      uploadedByName: userMap.get(row.uploaded_by_user_id) ?? null,
      status: row.status,
      remark: row.remark,
      totalRows: row.total_rows,
      createdCount: row.created_count,
      rejectedCount: row.rejected_count,
      uploadedAt: row.uploaded_at?.toISOString() ?? null
    }));
  }

  async getFileUpload(uploadId: string) {
    const result = await this.db.query<PayoutFileUploadRow>(
      `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
              package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
              total_rows, created_count, rejected_count, uploaded_at, payload_json,
              processing_started_at, processed_at
       from payout_file_uploads
       where upload_id = $1`,
      [uploadId]
    );

    const row = result.rows[0];
    return row ? this.mapFileUploadRow(row) : null;
  }

  async listBatchesBySourceUpload(uploadId: string) {
    const result = await this.db.query<PayoutBatchRow>(
      `select pb.batch_id, pb.bank_tenant_id, pb.corporate_tenant_id,
              pb.corporate_id, pb.source_upload_id, pb.subscription_id, pb.package_code,
              pb.debit_account_id, pb.payment_method_code,
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
       where pb.source_upload_id = $1
       order by pb.created_at asc, pb.batch_id asc`,
      [uploadId]
    );

    return result.rows.map((row) => this.mapBatchListRow(row));
  }

  async applyFileUploadApprovalAction(
    uploadId: string,
    payload: PayoutApprovalActionRequest
  ) {
    const upload = await this.getFileUpload(uploadId);

    if (!upload) {
      return {
        error: "upload_not_found" as const
      };
    }

    const batches = await this.listBatchesBySourceUpload(uploadId);
    const actionableBatches = batches.filter((batch) =>
      batch.state === "pending_approval" || batch.state === "partially_approved"
    );

    if (actionableBatches.length === 0) {
      return {
        error: "no_actionable_batches" as const
      };
    }

    const results: Array<{
      batchId: string;
      status: "approved" | "rejected" | "skipped";
      state: PayoutBatch["state"] | null;
      message?: string;
    }> = [];

    for (const batch of actionableBatches) {
      const result = await this.applyApprovalAction(batch.batchId, payload);

      if ("data" in result) {
        results.push({
          batchId: batch.batchId,
          status: payload.action === "approve" ? "approved" : "rejected",
          state: result.data?.state ?? batch.state
        });
      } else {
        results.push({
          batchId: batch.batchId,
          status: "skipped",
          state: batch.state,
          message: mapBulkFileApprovalErrorToMessage(result as never)
        });
      }
    }

    const refreshedUpload = await this.getFileUpload(uploadId);
    const refreshedBatches = await this.listBatchesBySourceUpload(uploadId);

    return {
      data: {
        fileUpload: refreshedUpload ?? upload,
        batches: refreshedBatches,
        summary: {
          total: actionableBatches.length,
          processed: results.filter((item) => item.status !== "skipped").length,
          skipped: results.filter((item) => item.status === "skipped").length
        },
        results
      }
    };
  }

  async recordFileUpload(
    payload: PayoutFileUploadCreateRequest,
    executor: DatabaseExecutor = this.db
  ) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.uploadedByUserId);

    if (!actor) {
      return {
        error: "forbidden" as const
      };
    }

    const fileUtr = generate16DigitUtr();

    const result = await executor.query<PayoutFileUploadRow>(
      `insert into payout_file_uploads (
         upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
         package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
         total_rows, created_count, rejected_count, uploaded_at, payload_json, utr
       )
       values ($1, $2, $3, $4, $5, $6, null, $7, $8, $9, $10, $11, $12, $13, $14, now(), $15::jsonb, $16)
       on conflict (upload_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           subscription_id = excluded.subscription_id,
           package_code = excluded.package_code,
           debit_account_id = excluded.debit_account_id,
           file_name = excluded.file_name,
           uploaded_by_user_id = excluded.uploaded_by_user_id,
           uploaded_by_role = excluded.uploaded_by_role,
           status = excluded.status,
           remark = excluded.remark,
           total_rows = excluded.total_rows,
           created_count = excluded.created_count,
           rejected_count = excluded.rejected_count,
           payload_json = excluded.payload_json,
           utr = coalesce(payout_file_uploads.utr, excluded.utr)
       returning upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
                 package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
                 total_rows, created_count, rejected_count, uploaded_at, payload_json,
                 processing_started_at, processed_at, utr`,
      [
        payload.uploadId,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId,
        payload.subscriptionId ?? null,
        payload.packageCode ?? null,
        payload.fileName,
        payload.uploadedByUserId,
        actor.role,
        payload.status,
        payload.remark ?? null,
        payload.totalRows,
        payload.createdCount,
        payload.rejectedCount,
        JSON.stringify(payload.payloadRows ?? null),
        fileUtr
      ]
    );

    await executor.query(
      `insert into file_upload_projection (
         upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
         package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
         total_rows, created_count, rejected_count, uploaded_at, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, null, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
       on conflict (upload_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           subscription_id = excluded.subscription_id,
           package_code = excluded.package_code,
           debit_account_id = excluded.debit_account_id,
           file_name = excluded.file_name,
           uploaded_by_user_id = excluded.uploaded_by_user_id,
           uploaded_by_role = excluded.uploaded_by_role,
           status = excluded.status,
           remark = excluded.remark,
           total_rows = excluded.total_rows,
           created_count = excluded.created_count,
           rejected_count = excluded.rejected_count,
           uploaded_at = now(),
           updated_at = now()`,
      [
        payload.uploadId,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId,
        payload.subscriptionId ?? null,
        payload.packageCode ?? null,
        payload.fileName,
        payload.uploadedByUserId,
        actor.role,
        payload.status,
        payload.remark ?? null,
        payload.totalRows,
        payload.createdCount,
        payload.rejectedCount
      ]
    );

    return {
      data: await this.mapFileUploadRow(result.rows[0])
    };
  }

  async processAcceptedFileUpload(uploadId: string) {
    const result = await this.db.query<PayoutFileUploadRow>(
      `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
              package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
              total_rows, created_count, rejected_count, uploaded_at, payload_json,
              processing_started_at, processed_at, utr
       from payout_file_uploads
       where upload_id = $1
       for update`,
      [uploadId]
    );

    const upload = result.rows[0];
    if (!upload || upload.status !== "processing" || !upload.payload_json) {
      return;
    }

    await this.db.query(
      `update payout_file_uploads
       set processing_started_at = coalesce(processing_started_at, now())
       where upload_id = $1`,
      [uploadId]
    );

    const rows = upload.payload_json;
    const created: PayoutBatch[] = [];
    const rejected: Array<{ rowNumber: number; transactionReference: string; reason: string }> = [];
    const referencesSeen = new Set<string>();
    const settings = await this.settingsManagementService.getSettingsForCorporateTenant(
      upload.corporate_tenant_id
    );
    const beneficiaries = await this.beneficiaryManagementService.listBeneficiaries({
      corporateTenantId: upload.corporate_tenant_id,
      corporateId: upload.corporate_id ?? undefined
    });
    const uploadEffectiveSettingsResult = upload.subscription_id
      ? await this.effectiveSettingsResolverService.resolveForSubscription(
          upload.subscription_id
        )
      : null;
    const uploadEffectiveSettings =
      uploadEffectiveSettingsResult && "data" in uploadEffectiveSettingsResult
        ? (uploadEffectiveSettingsResult.data ?? null)
        : null;
    const beneficiaryMap = new Map(
      beneficiaries.map((beneficiary) => [
        beneficiary.beneficiaryId.trim().toUpperCase(),
        beneficiary
      ])
    );

    for (const [index, row] of rows.entries()) {
      const transactionReference = row.transactionReference.trim();
      const normalizedReference = transactionReference.toLowerCase();
      const rowNumber = index + 2;

      if (
        settings?.duplicateReferencePolicy !== "disabled" &&
        referencesSeen.has(normalizedReference)
      ) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: "Duplicate transaction reference found inside the uploaded file"
        });
        continue;
      }

      if (settings?.duplicateReferencePolicy !== "disabled") {
        referencesSeen.add(normalizedReference);
      }

      const beneficiary = beneficiaryMap.get(row.beneficiaryId.trim().toUpperCase());
      if (!beneficiary) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: `Beneficiary not found: ${row.beneficiaryId}`
        });
        continue;
      }

      let debitAccountId: string | undefined;
      if (row.debitAccountNumber) {
        const resolvedDebitAccountId = upload.subscription_id
          ? await this.resolveDebitAccountIdByNumber(
              upload.subscription_id,
              row.debitAccountNumber
            )
          : null;
        debitAccountId = resolvedDebitAccountId ?? undefined;

        if (!debitAccountId) {
          rejected.push({
            rowNumber,
            transactionReference,
            reason: `Debit account not found for this package: ${row.debitAccountNumber}`
          });
          continue;
        }
      }

      const resolvedPaymentMethod = this.resolveSelectedPaymentMethod(
        uploadEffectiveSettings,
        row.paymentMethodCode
      );

      if (resolvedPaymentMethod && "error" in resolvedPaymentMethod) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: mapBulkCreateErrorToMessage(resolvedPaymentMethod)
        });
        continue;
      }

      const isSingleDebit = uploadEffectiveSettings?.effectiveDebitMode === "single";
      const batchUtr = isSingleDebit ? (upload.utr || generate16DigitUtr()) : generate16DigitUtr();
      let batchNarration: string;
      if (isSingleDebit) {
        batchNarration = `CMS-${batchUtr}- ${upload.file_name}`;
      } else {
        const remarkSuffix = row.remark ? `-${row.remark}` : "";
        batchNarration = `CMS-${batchUtr}-${upload.package_code || "PAYOUT"}${remarkSuffix}`.slice(0, 64);
      }

      const createResult = await this.createAndSubmitBatch({
        batchId: crypto.randomUUID(),
        bankTenantId: upload.bank_tenant_id,
        corporateTenantId: upload.corporate_tenant_id,
        corporateId: upload.corporate_id ?? "",
        sourceUploadId: uploadId,
        subscriptionId: upload.subscription_id ?? undefined,
        packageCode: upload.package_code ?? undefined,
        debitAccountId,
        paymentMethodCode:
          resolvedPaymentMethod && !("error" in resolvedPaymentMethod)
            ? resolvedPaymentMethod.paymentMethodCode
            : undefined,
        createdByUserId: upload.uploaded_by_user_id,
        title: transactionReference,
        tag: row.tag ?? undefined,
        remark: row.remark ?? undefined,
        utr: batchUtr,
        narration: batchNarration,
        items: [
          {
            itemId: `${createSimpleId("ITEM")}-${index + 1}`,
            beneficiaryId: beneficiary.beneficiaryId,
            amount: {
              value: row.amount,
              currency: this.baseCurrency
            },
            purpose: row.remark ?? transactionReference
          }
        ]
      });

      if (!("data" in createResult)) {
        rejected.push({
          rowNumber,
          transactionReference,
          reason: mapBulkCreateErrorToMessage(
            createResult as Parameters<typeof mapBulkCreateErrorToMessage>[0]
          )
        });
        continue;
      }

      created.push(createResult.data!);
    }

    const status =
      created.length === rows.length
        ? "successful"
        : created.length > 0
          ? "partially_successful"
          : "failed";

    const remark =
      rejected.length > 0
        ? rejected
            .slice(0, 5)
            .map(
              (item) =>
                `Row ${item.rowNumber} (${item.transactionReference}): ${item.reason}`
            )
            .join(" | ")
        : status === "successful"
          ? "File processed successfully."
          : "No rows could be created from this file.";

    await this.db.query(
      `update payout_file_uploads
       set status = $2,
           remark = $3,
           created_count = $4,
           rejected_count = $5,
           payload_json = null,
           processed_at = now()
       where upload_id = $1`,
      [uploadId, status, remark, created.length, rejected.length]
    );

    await this.db.query(
      `update file_upload_projection
       set status = $2,
           remark = $3,
           created_count = $4,
           rejected_count = $5,
           updated_at = now()
       where upload_id = $1`,
      [uploadId, status, remark, created.length, rejected.length]
    );

    await appendOutboxEvent(
      this.db,
      createDomainEvent({
        aggregateType: "file-upload",
        aggregateId: uploadId,
        eventType: "file.processed",
        eventKey: uploadId,
        payload: {
          uploadId,
          fileName: upload.file_name,
          status,
          createdCount: created.length,
          rejectedCount: rejected.length,
          occurredAt: new Date().toISOString()
        }
      })
    );

    return {
      created,
      rejected
    };
  }

  async createRefund(payload: PayoutRefundCreateRequest) {
    const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);
    const corporateTenant = await this.tenantManagementService.getCorporateTenant(
      payload.corporateTenantId
    );
    const corporate = payload.corporateId
      ? await this.tenantManagementService.getCorporate(payload.corporateId)
      : null;
    const batch = await this.getBatch(payload.batchId);

    if (!bankTenant) {
      return {
        error: "bank_not_found" as const
      };
    }

    if (!corporateTenant) {
      return {
        error: "corporate_not_found" as const
      };
    }

    if (!corporate || corporate.corporateTenantId !== payload.corporateTenantId) {
      return {
        error: "child_corporate_not_found" as const
      };
    }

    if (!batch) {
      return {
        error: "batch_not_found" as const
      };
    }

    if (batch.corporateTenantId !== payload.corporateTenantId) {
      return {
        error: "batch_corporate_mismatch" as const
      };
    }

    if (batch.corporateId !== payload.corporateId) {
      return {
        error: "batch_corporate_mismatch" as const
      };
    }

    if (!["paid", "failed"].includes(batch.state)) {
      return {
        error: "batch_not_refundable" as const,
        currentState: batch.state
      };
    }

    if (payload.amount > batch.totalAmount.value) {
      return {
        error: "refund_amount_exceeds_batch" as const,
        batchAmount: batch.totalAmount.value
      };
    }

    const result = await this.db.query<PayoutRefundRow>(
      `insert into payout_refunds (
         refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
         package_code, requested_by_user_id, amount, reason, state, created_at, processed_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'requested', now(), null)
       on conflict (refund_id) do update
       set batch_id = excluded.batch_id,
           bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           subscription_id = excluded.subscription_id,
           package_code = excluded.package_code,
           requested_by_user_id = excluded.requested_by_user_id,
           amount = excluded.amount,
           reason = excluded.reason
       returning refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                 subscription_id, package_code, requested_by_user_id, amount, reason, state,
                 created_at, processed_at`,
      [
        payload.refundId,
        payload.batchId,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId,
        batch.subscriptionId,
        batch.packageCode,
        payload.requestedByUserId,
        payload.amount,
        payload.reason
      ]
    );

    return {
      data: mapRefundRow(result.rows[0])
    };
  }

  async simulateBankResponse(batchId: string, payload: PayoutSimulationRequest) {
    const batch = await this.getBatch(batchId);

    if (!batch) {
      return {
        error: "batch_not_found" as const
      };
    }

    if (batch.state !== "sent_to_bank") {
      return {
        error: "invalid_transition" as const,
        currentState: batch.state
      };
    }

    const processedAt = new Date();
    
    // Determine item-level outcomes
    let itemOutcomes;
    if (payload.status === "paid") {
      itemOutcomes = batch.items.map((item) => ({
        itemId: item.itemId,
        succeeded: true
      }));
    } else if (payload.status === "failed") {
      itemOutcomes = batch.items.map((item) => ({
        itemId: item.itemId,
        succeeded: false
      }));
    } else {
      // Fallback to legacy default logic
      itemOutcomes = batch.items.map((item, index) => ({
        itemId: item.itemId,
        succeeded: batch.items.length === 1 ? true : index % 3 !== 2
      }));
    }

    const successfulCount = itemOutcomes.filter((item) => item.succeeded).length;
    const failedCount = itemOutcomes.length - successfulCount;

    const nextBatchState: PayoutBatch["state"] =
      successfulCount === itemOutcomes.length ? "paid" : "failed";

    const failureReason =
      nextBatchState === "paid"
        ? null
        : failedCount === itemOutcomes.length
          ? "All payout items failed in mock bank processing"
          : `${failedCount} payout item(s) failed in mock bank processing`;

    await withDatabaseTransaction(this.config, async (client) => {
      for (const outcome of itemOutcomes) {
        await client.query(
          `update payout_items
           set state = $2,
               failure_reason = $3,
               processed_at = $4
           where item_id = $1`,
          [
            outcome.itemId,
            outcome.succeeded ? "processed" : "failed",
            outcome.succeeded ? null : "Mock bank marked this payout item as failed",
            processedAt
          ]
        );
      }

      await client.query(
        `update payout_batches
         set state = $2,
             approval_comment = $3,
             completed_at = $4,
             failure_reason = $5
         where batch_id = $1`,
        [
          batchId,
          nextBatchState,
          payload.comment ?? `Mock bank response captured by ${payload.actedByUserId}`,
          processedAt,
          failureReason
        ]
      );

      await this.appendTransactionOutboxEvent(
        client,
        batchId,
        nextBatchState === "paid" ? "transaction.paid" : "transaction.failed",
        {
          batchId,
          transactionReference: batch.title,
          bankTenantId: batch.bankTenantId,
          corporateTenantId: batch.corporateTenantId,
          corporateId: batch.corporateId,
          totalAmount: batch.totalAmount,
          actedByUserId: payload.actedByUserId,
          comment: payload.comment ?? `Mock bank response captured by ${payload.actedByUserId}`,
          state: nextBatchState,
          successfulItemCount: successfulCount,
          failedItemCount: failedCount,
          failureReason,
          occurredAt: processedAt.toISOString()
        }
      );
    });

    return {
      data: await this.getBatch(batchId)
    };
  }

  private resolveNextState(
    currentState: PayoutBatch["state"],
    action: PayoutApprovalActionRequest["action"]
  ) {
    if (action === "submit" && currentState === "draft") {
      return "pending_approval";
    }

    if (action === "approve" && currentState === "pending_approval") {
      return "approved";
    }

    if (action === "approve" && currentState === "partially_approved") {
      return "approved";
    }

    if (
      action === "reject" &&
      (currentState === "pending_approval" || currentState === "partially_approved")
    ) {
      return "rejected";
    }

    return null;
  }

  private mapBatchListRow(row: PayoutBatchRow) {
    const currentApprovalLevel = row.current_approval_level ?? null;
    const approvalLevelsRequired = row.approval_levels_required ?? null;
    const approvalRoles = currentApprovalLevel
      ? (row.roles_by_level?.find((entry) => entry.level === currentApprovalLevel)?.roles ?? [])
      : [];

    return {
      batchId: row.batch_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      sourceUploadId: row.source_upload_id ?? null,
      subscriptionId: row.subscription_id,
      packageCode: row.package_code,
      debitAccountId: row.debit_account_id ?? null,
      paymentMethodCode: row.payment_method_code ?? null,
      primaryBeneficiaryId: row.primary_beneficiary_id ?? null,
      primaryBeneficiaryName: row.primary_beneficiary_name ?? null,
      createdByUserId: row.created_by_user_id,
      createdByRole: row.created_by_role,
      title: row.title,
      tag: row.tag,
      remark: row.remark,
      state: this.mapInternalToUserState(row.state),
      internalState: row.state,
      totalAmount: {
        value: Number(row.total_amount),
        currency: this.baseCurrency
      },
      approvalComment: row.approval_comment,
      bankReference: row.bank_reference,
      utr: row.utr,
      narration: row.narration,
      dispatchedAt: row.dispatched_at?.toISOString() ?? null,
      completedAt: row.completed_at?.toISOString() ?? null,
      failureReason: row.failure_reason,
      approvalLevelsRequired,
      currentApprovalLevel,
      approvalRoles,
      matchedApprovalMatrixIds: row.matched_matrix_ids ?? [],
      createdAt: row.created_at?.toISOString() ?? null,
      submittedAt: row.submitted_at?.toISOString() ?? null,
      approvedAt: row.approved_at?.toISOString() ?? null,
      rejectedAt: row.rejected_at?.toISOString() ?? null,
      submittedByUserId: row.submitted_by_user_id,
      submittedByRole: row.submitted_by_role,
      approvedByUserId: row.approved_by_user_id,
      approvedByRole: row.approved_by_role,
      rejectedByUserId: row.rejected_by_user_id,
      rejectedByRole: row.rejected_by_role,
      timeline: [],
      items: []
    } satisfies PayoutBatch;
  }

  private async mapBatchRow(row: PayoutBatchRow) {
    const itemsResult = await this.db.query<PayoutItemRow>(
      `select item_id, batch_id, beneficiary_id, amount, currency, purpose,
              state, bank_reference, failure_reason, processed_at
       from payout_items
       where batch_id = $1
       order by item_id`,
      [row.batch_id]
    );

    const timeline = await this.buildTimeline(row);
    const approvalContext = await this.getApprovalContextRow(row.batch_id);
    const currentApprovalLevel = approvalContext?.current_approval_level ?? null;
    const approvalLevelsRequired = approvalContext?.approval_levels_required ?? null;
    const approvalRoles = currentApprovalLevel
      ? this.getRolesForLevel(approvalContext, currentApprovalLevel)
      : [];

    return {
      batchId: row.batch_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      sourceUploadId: row.source_upload_id ?? null,
      subscriptionId: row.subscription_id,
      packageCode: row.package_code,
      debitAccountId: row.debit_account_id ?? null,
      paymentMethodCode: row.payment_method_code ?? null,
      primaryBeneficiaryId: itemsResult.rows[0]?.beneficiary_id ?? null,
      primaryBeneficiaryName: null,
      createdByUserId: row.created_by_user_id,
      createdByRole: row.created_by_role,
      title: row.title,
      tag: row.tag,
      remark: row.remark,
      state: this.mapInternalToUserState(row.state),
      internalState: row.state,
      totalAmount: {
        value: Number(row.total_amount),
        currency: this.baseCurrency
      },
      approvalComment: row.approval_comment,
      bankReference: row.bank_reference,
      utr: row.utr,
      narration: row.narration,
      createdAt: row.created_at?.toISOString() ?? null,
      submittedAt: row.submitted_at?.toISOString() ?? null,
      approvedAt: row.approved_at?.toISOString() ?? null,
      rejectedAt: row.rejected_at?.toISOString() ?? null,
      submittedByUserId: row.submitted_by_user_id,
      submittedByRole: row.submitted_by_role,
      approvedByUserId: row.approved_by_user_id,
      approvedByRole: row.approved_by_role,
      rejectedByUserId: row.rejected_by_user_id,
      rejectedByRole: row.rejected_by_role,
      dispatchedAt: row.dispatched_at?.toISOString() ?? null,
      completedAt: row.completed_at?.toISOString() ?? null,
      failureReason: row.failure_reason,
      approvalLevelsRequired,
      currentApprovalLevel,
      approvalRoles,
      matchedApprovalMatrixIds: approvalContext?.matched_matrix_ids ?? [],
      timeline,
      items: itemsResult.rows.map(mapPayoutItemRow)
    } satisfies PayoutBatch;
  }

  private async buildTimeline(row: PayoutBatchRow) {
    const timelineEntries: Array<{
      event: string;
      role: string | null;
      userId: string | null;
      at: Date | null;
    }> = [
      {
        event: "created",
        role: row.created_by_role,
        userId: row.created_by_user_id,
        at: row.created_at
      },
      {
        event: "submitted",
        role: row.submitted_by_role,
        userId: row.submitted_by_user_id,
        at: row.submitted_at
      }
    ];

    const approvalActionsResult = await this.db.query<{
      approval_level: number;
      action: string;
      actor_user_id: string;
      actor_role: string;
      comment: string | null;
      created_at: Date;
    }>(
      `select approval_level, action, actor_user_id, actor_role, comment, created_at
       from payout_batch_approval_actions
       where batch_id = $1
       order by approval_level asc, created_at asc`,
      [row.batch_id]
    );

    for (const action of approvalActionsResult.rows) {
      const displayEvent = action.action === "approve"
        ? `Approved (Level ${action.approval_level})`
        : `Rejected (Level ${action.approval_level})`;

      timelineEntries.push({
        event: displayEvent,
        role: action.actor_role,
        userId: action.actor_user_id,
        at: action.created_at
      });
    }

    if (approvalActionsResult.rows.length === 0) {
      if (row.approved_by_user_id || row.approved_at) {
        timelineEntries.push({
          event: "approved",
          role: row.approved_by_role,
          userId: row.approved_by_user_id,
          at: row.approved_at
        });
      }
      if (row.rejected_by_user_id || row.rejected_at) {
        timelineEntries.push({
          event: "rejected",
          role: row.rejected_by_role,
          userId: row.rejected_by_user_id,
          at: row.rejected_at
        });
      }
    }

    const userState = this.mapInternalToUserState(row.state);
    if (userState === "failed") {
      timelineEntries.push({
        event: row.failure_reason ? `failed: ${row.failure_reason}` : "failed",
        role: "system",
        userId: null,
        at: row.completed_at || row.approved_at || row.submitted_at || row.created_at
      });
    }

    const filteredTimelineEntries = timelineEntries.filter((entry) =>
      Boolean(entry.userId || entry.at)
    );

    const userIds = [...new Set(filteredTimelineEntries.map((entry) => entry.userId).filter(Boolean))] as string[];
    const userMap = new Map<string, string>();

    await Promise.all(
      userIds.map(async (userId) => {
        const user = await this.identityAccessService.getCorporateUserById(userId);
        if (user) {
          userMap.set(userId, user.displayName);
        }
      })
    );

    return filteredTimelineEntries.map((entry) => ({
      event: entry.event,
      role: entry.role,
      userId: entry.userId,
      userName: entry.userId ? userMap.get(entry.userId) ?? null : null,
      at: entry.at?.toISOString() ?? null
    })) satisfies PayoutTimelineEvent[];
  }

  private async mapFileUploadRow(row: PayoutFileUploadRow) {
    const user = await this.identityAccessService.getCorporateUserById(row.uploaded_by_user_id);

    return {
      uploadId: row.upload_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      subscriptionId: row.subscription_id,
      packageCode: row.package_code,
      debitAccountId: row.debit_account_id ?? null,
      fileName: row.file_name,
      uploadedByUserId: row.uploaded_by_user_id,
      uploadedByRole: row.uploaded_by_role,
      uploadedByName: user?.displayName ?? null,
      status: row.status,
      remark: row.remark,
      totalRows: row.total_rows,
      createdCount: row.created_count,
      rejectedCount: row.rejected_count,
      uploadedAt: row.uploaded_at?.toISOString() ?? null
    } satisfies PayoutFileUpload;
  }

  private async findFileUploadByName(
    corporateTenantId: string,
    corporateId: string,
    fileName: string
  ) {
    const result = await this.db.query<PayoutFileUploadRow>(
      `select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
              package_code, debit_account_id, file_name, uploaded_by_user_id, uploaded_by_role, status, remark,
              total_rows, created_count, rejected_count, uploaded_at
       from payout_file_uploads
       where corporate_tenant_id = $1
         and corporate_id = $2
         and lower(file_name) = lower($3)
       order by uploaded_at desc nulls last
       limit 1`,
      [corporateTenantId, corporateId, fileName]
    );

    const row = result.rows[0];
    return row ? this.mapFileUploadRow(row) : null;
  }

  private generateBankReference(bankTenantId: string, batchId: string) {
    const prefix = bankTenantId.replace(/[^a-z0-9]/gi, "").toUpperCase();
    return `${prefix}-DISP-${batchId.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
  }

  private async findBatchByReference(
    corporateTenantId: string,
    corporateId: string,
    transactionReference: string
  ) {
    const result = await this.db.query<PayoutBatchRow>(
      `select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, subscription_id,
              source_upload_id, package_code, debit_account_id, payment_method_code, created_by_user_id, created_by_role, title, tag, remark, state,
              total_amount, approval_comment, bank_reference, created_at, submitted_at,
              submitted_by_user_id, submitted_by_role, approved_at, approved_by_user_id,
              approved_by_role, rejected_at,
              rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
              failure_reason, utr, narration
       from payout_batches
       where corporate_tenant_id = $1
         and corporate_id = $2
         and lower(title) = lower($3)
       order by created_at desc nulls last
       limit 1`,
      [corporateTenantId, corporateId, transactionReference]
    );

    const row = result.rows[0];
    return row ? this.mapBatchRow(row) : null;
  }

  private async getCurrentDailyCumulativeAmount(
    corporateTenantId: string,
    corporateId: string,
    excludingBatchId?: string
  ) {
    const params: Array<string> = [corporateTenantId, corporateId];
    let exclusionClause = "";

    if (excludingBatchId) {
      params.push(excludingBatchId);
      exclusionClause = `and batch_id <> $${params.length}`;
    }

    const result = await this.db.query<{ total_amount: string | null }>(
      `select coalesce(sum(total_amount), 0)::text as total_amount
       from payout_batches
       where corporate_tenant_id = $1
         and corporate_id = $2
         and state <> 'rejected'
         and created_at >= date_trunc('day', now())
         and created_at < date_trunc('day', now()) + interval '1 day'
         ${exclusionClause}`,
      params
    );

    return Number(result.rows[0]?.total_amount ?? 0);
  }

  private async resolveSelectedDebitAccount(
    corporateTenantId: string,
    roleName: string,
    subscriptionId: string | null,
    requestedDebitAccountId?: string
  ): Promise<
    | ResolvedDebitAccountContext
    | { error: "debit_account_required"; subscriptionId: string | null }
    | { error: "debit_account_not_allowed"; debitAccountId: string }
    | { error: "default_debit_account_not_configured"; subscriptionId: string | null }
  > {
    if (!subscriptionId) {
      return {
        error: "default_debit_account_not_configured",
        subscriptionId: null
      };
    }

    const subscription = await this.subscriptionManagementService.getSubscription(subscriptionId);
    if (!subscription) {
      return {
        error: "default_debit_account_not_configured",
        subscriptionId
      };
    }

    const roleAllowedDebitAccountIds =
      await this.identityAccessService.getAllowedDebitAccountIdsForRole(
        corporateTenantId,
        roleName
      );

    const selectableAccounts = subscription.debitAccounts.filter(
      (account) =>
        account.status === "active" &&
        roleAllowedDebitAccountIds.includes(account.debitAccountId)
    );

    if (selectableAccounts.length === 0) {
      return {
        error: "debit_account_required",
        subscriptionId
      };
    }

    const normalizedRequestedDebitAccountId = requestedDebitAccountId?.trim() ?? "";
    if (normalizedRequestedDebitAccountId) {
      const requestedAccount = selectableAccounts.find(
        (account) => account.debitAccountId === normalizedRequestedDebitAccountId
      );

      if (!requestedAccount) {
        return {
          error: "debit_account_not_allowed",
          debitAccountId: normalizedRequestedDebitAccountId
        };
      }

      return {
        debitAccountId: requestedAccount.debitAccountId,
        accountNumber: requestedAccount.accountNumber
      };
    }

    const defaultAccount =
      selectableAccounts.find((account) => account.isDefault) ?? selectableAccounts[0] ?? null;

    if (!defaultAccount) {
      return {
        error: "default_debit_account_not_configured",
        subscriptionId
      };
    }

    return {
      debitAccountId: defaultAccount.debitAccountId,
      accountNumber: defaultAccount.accountNumber
    };
  }

  private async resolveDebitAccountIdByNumber(
    subscriptionId: string,
    accountNumber: string
  ) {
    const normalizedAccountNumber = accountNumber.trim();
    if (!normalizedAccountNumber) {
      return null;
    }

    const result = await this.db.query<{ debit_account_id: string }>(
      `select sda.debit_account_id
       from subscription_debit_accounts sda
       inner join corporate_debit_accounts cda on cda.debit_account_id = sda.debit_account_id
       where sda.subscription_id = $1
         and sda.status = 'active'
         and cda.account_number = $2
       limit 1`,
      [subscriptionId, normalizedAccountNumber]
    );

    return result.rows[0]?.debit_account_id ?? null;
  }

  private async initializeApprovalContext(
    batchId: string,
    corporateTenantId: string,
    subscriptionId: string | null,
    debitAccountId: string | null,
    amount: number,
    executor: DatabaseExecutor = this.db
  ) {
    const snapshot = await this.approvalMatrixManagementService.buildTransactionApprovalPlan(
      corporateTenantId,
      amount,
      subscriptionId,
      debitAccountId
    );

    await executor.query(
      `insert into payout_batch_approval_contexts (
         batch_id, corporate_tenant_id, entity_type, approval_levels_required,
         current_approval_level, roles_by_level, matched_matrix_ids, status, created_at, updated_at
       )
       values ($1, $2, 'transaction', $3, $4, $5::jsonb, $6, 'open', now(), now())
       on conflict (batch_id) do update
       set corporate_tenant_id = excluded.corporate_tenant_id,
           approval_levels_required = excluded.approval_levels_required,
           current_approval_level = excluded.current_approval_level,
           roles_by_level = excluded.roles_by_level,
           matched_matrix_ids = excluded.matched_matrix_ids,
           status = 'open',
           updated_at = now()`,
      [
        batchId,
        corporateTenantId,
        snapshot.approvalLevelsRequired,
        snapshot.currentApprovalLevel,
        JSON.stringify(snapshot.rolesByLevel),
        snapshot.matchedApprovalMatrixIds
      ]
    );
  }

  private async resolveSubscriptionContext(input: {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    subscriptionId?: string;
    packageCode?: string;
  }): Promise<ResolvedSubscriptionContext | SubscriptionScopeError> {
    let subscription = null;

    if (input.subscriptionId) {
      subscription = await this.subscriptionManagementService.getSubscription(
        input.subscriptionId
      );
    } else if (input.packageCode) {
      subscription = await this.subscriptionManagementService.findActiveSubscription(
        input.corporateId,
        input.packageCode
      );
    } else {
      const subscriptions = await this.subscriptionManagementService.listSubscriptions({
        corporateTenantId: input.corporateTenantId,
        corporateId: input.corporateId,
        status: "active"
      });
      subscription = subscriptions[0] ?? null;
    }

    if (!subscription) {
      return input.subscriptionId || input.packageCode
        ? ({ error: "subscription_not_found" } as const)
        : ({
            subscriptionId: null,
            packageCode: null,
            effectiveSettings: null
          } satisfies ResolvedSubscriptionContext);
    }

    if (
      subscription.bankTenantId !== input.bankTenantId ||
      subscription.corporateTenantId !== input.corporateTenantId ||
      subscription.corporateId !== input.corporateId ||
      subscription.status !== "active"
    ) {
      return {
        error: "subscription_scope_mismatch" as const
      };
    }

    const effectiveSettingsResult =
      await this.effectiveSettingsResolverService.resolveForSubscription(
        subscription.subscriptionId
      );

    const effectiveSettings =
      "data" in effectiveSettingsResult ? (effectiveSettingsResult.data ?? null) : null;

    return {
      subscriptionId: subscription.subscriptionId,
      packageCode: subscription.packageCode,
      effectiveSettings
    } satisfies ResolvedSubscriptionContext;
  }

  private resolveSelectedPaymentMethod(
    effectiveSettings: EffectiveSettingsSnapshot | null,
    requestedPaymentMethodCode?: string
  ) {
    const allowedPaymentMethods = effectiveSettings?.paymentMethods ?? [];

    if (allowedPaymentMethods.length === 0) {
      return null;
    }

    const normalizedRequestedCode = requestedPaymentMethodCode?.trim().toUpperCase() ?? "";
    if (!normalizedRequestedCode) {
      const defaultPaymentMethodCode =
        effectiveSettings?.defaultPaymentMethodCode?.trim().toUpperCase() ?? "";

      if (defaultPaymentMethodCode) {
        const defaultPaymentMethod =
          allowedPaymentMethods.find(
            (method) => method.paymentMethodCode.toUpperCase() === defaultPaymentMethodCode
          ) ?? null;

        if (defaultPaymentMethod) {
          return defaultPaymentMethod;
        }
      }

      if (allowedPaymentMethods.length === 1) {
        return allowedPaymentMethods[0] ?? null;
      }

      return {
        error: "payment_method_required" as const,
        allowedPaymentMethodCodes: allowedPaymentMethods.map((method) => method.paymentMethodCode)
      };
    }

    const selectedPaymentMethod =
      allowedPaymentMethods.find(
        (method) => method.paymentMethodCode.toUpperCase() === normalizedRequestedCode
      ) ?? null;

    if (!selectedPaymentMethod) {
      return {
        error: "payment_method_not_allowed" as const,
        paymentMethodCode: normalizedRequestedCode,
        allowedPaymentMethodCodes: allowedPaymentMethods.map((method) => method.paymentMethodCode)
      };
    }

    return selectedPaymentMethod;
  }

  private async getApprovalContextRow(
    batchId: string,
    forUpdate = false,
    executor: DatabaseExecutor = this.db
  ) {
    const result = await executor.query<PayoutBatchApprovalContextRow>(
      `select batch_id, corporate_tenant_id, entity_type, approval_levels_required,
              current_approval_level, roles_by_level, matched_matrix_ids, status,
              created_at, updated_at
       from payout_batch_approval_contexts
       where batch_id = $1
       ${forUpdate ? "for update" : ""}`,
      [batchId]
    );

    return result.rows[0] ?? null;
  }

  private getRolesForLevel(
    context: PayoutBatchApprovalContextRow | null,
    level: number
  ) {
    const match = context?.roles_by_level?.find((entry) => entry.level === level);
    return match?.roles ?? [];
  }

  private async appendTransactionOutboxEvent(
    executor: DatabaseExecutor,
    batchId: string,
    eventType: DomainEventType,
    payload: Record<string, unknown>
  ) {
    await appendOutboxEvent(
      executor,
      createDomainEvent({
        aggregateType: "transaction",
        aggregateId: batchId,
        eventType,
        eventKey: batchId,
        payload
      })
    );
  }

  private mapInternalToUserState(internalState: string): PayoutBatch["state"] {
    switch (internalState) {
      case "draft":
        return "draft";
      case "submitted":
        return "pending_approval";
      case "pending_approval":
        return "pending_approval";
      case "partially_approved":
        return "partially_approved";
      case "approved":
      case "cbs_debit_queued":
      case "cbs_debit_in_flight":
      case "cbs_debit_succeeded":
        return "approved";
      case "dispatched_to_hub":
      case "in_flight":
      case "sent_to_bank":
      case "rail_settled":
        return "sent_to_bank";
      case "paid":
      case "settled":
        return "paid";
      case "rejected":
        return "rejected";
      case "recalled":
      case "cancelled":
      case "returned":
      case "failed":
      case "cbs_debit_failed":
      case "rail_failed":
      case "reversal_queued":
      case "reversal_in_flight":
      case "reversed":
      case "reversal_failed":
      case "cbs_debit_ambiguous":
      case "reversal_ambiguous":
        return "failed";
      default:
        return "failed";
    }
  }
}

function mapBulkCreateErrorToMessage(
  error:
    | { error: "bank_not_found" }
    | { error: "corporate_not_found" }
    | { error: "child_corporate_not_found" }
    | { error: "beneficiary_not_found"; beneficiaryId: string }
    | { error: "beneficiary_corporate_mismatch"; beneficiaryId: string }
    | { error: "beneficiary_not_approved"; beneficiaryId: string }
    | { error: "beneficiary_inactive"; beneficiaryId: string }
    | {
        error: "beneficiary_package_not_assigned";
        beneficiaryId: string;
        packageCode: string;
      }
    | {
        error: "beneficiary_type_not_allowed";
        beneficiaryId: string;
        beneficiaryType: string;
        packageCode: string | null;
      }
    | {
        error: "duplicate_transaction_reference";
        transactionReference: string;
        existingState: string;
      }
    | { error: "single_transaction_limit_exceeded"; limit: number }
    | {
        error: "daily_cumulative_limit_exceeded";
        limit: number;
        currentTotal: number;
      }
    | {
        error: "payment_method_required";
        allowedPaymentMethodCodes: string[];
      }
    | {
        error: "payment_method_not_allowed";
        paymentMethodCode: string;
        allowedPaymentMethodCodes: string[];
      }
    | {
        error: "payment_method_amount_out_of_range";
        paymentMethodCode: string;
        minAmount: number | null;
        maxAmount: number | null;
        amount: number;
      }
    | { error: "debit_account_required"; subscriptionId: string | null }
    | { error: "debit_account_not_allowed"; debitAccountId: string }
    | { error: "default_debit_account_not_configured"; subscriptionId: string | null }
    | { error: "subscription_not_found" }
    | { error: "subscription_scope_mismatch" }
    | { error: "forbidden" }
) {
  switch (error.error) {
    case "bank_not_found":
      return "Bank tenant not found";
    case "corporate_not_found":
      return "Corporate tenant not found";
    case "child_corporate_not_found":
      return "Child corporate not found";
    case "beneficiary_not_found":
      return `Beneficiary not found: ${error.beneficiaryId}`;
    case "beneficiary_corporate_mismatch":
      return `Beneficiary does not belong to the selected child corporate: ${error.beneficiaryId}`;
    case "beneficiary_not_approved":
      return `Beneficiary is waiting for approval: ${error.beneficiaryId}`;
    case "beneficiary_inactive":
      return `Beneficiary is inactive: ${error.beneficiaryId}`;
    case "beneficiary_package_not_assigned":
      return `Beneficiary ${error.beneficiaryId} is not assigned to package ${error.packageCode}`;
    case "beneficiary_type_not_allowed":
      return `Beneficiary type ${error.beneficiaryType} is not allowed for package ${error.packageCode ?? "this selection"}`;
    case "duplicate_transaction_reference":
      return `Transaction reference already used earlier (${error.existingState})`;
    case "single_transaction_limit_exceeded":
      return `Transaction exceeds the single transaction limit of INR ${formatCurrency(error.limit)}`;
    case "daily_cumulative_limit_exceeded":
      return `Daily cumulative limit of INR ${formatCurrency(error.limit)} would be exceeded`;
    case "payment_method_required":
      return `Select a payment method. Allowed methods: ${error.allowedPaymentMethodCodes.join(", ")}`;
    case "payment_method_not_allowed":
      return `Payment method ${error.paymentMethodCode} is not allowed for the selected package`;
    case "payment_method_amount_out_of_range":
      return `Payment amount INR ${formatCurrency(error.amount)} is outside the allowed range for ${error.paymentMethodCode}`;
    case "debit_account_required":
      return "No debit account is available for this role and package";
    case "debit_account_not_allowed":
      return `Debit account is not allowed for this role and package: ${error.debitAccountId}`;
    case "default_debit_account_not_configured":
      return "A default debit account is not configured for this package";
    case "subscription_not_found":
      return "No active package subscription was found for this transaction context";
    case "subscription_scope_mismatch":
      return "The selected package subscription does not belong to this corporate context";
    case "forbidden":
      return "Only an approved transaction maker can upload transactions";
  }
}

function mapBulkFileApprovalErrorToMessage(
  error:
    | { error: "forbidden" }
    | { error: "batch_not_found" }
    | { error: "invalid_transition"; currentState: string }
) {
  switch (error.error) {
    case "forbidden":
      return "You are not allowed to take approval action on one or more transactions in this file";
    case "batch_not_found":
      return "A transaction linked to this file could not be found";
    case "invalid_transition":
      return `A transaction is already in ${error.currentState} state`;
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function createSimpleId(prefix: string) {
  return `${prefix}-${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
}

function mapPayoutItemRow(row: PayoutItemRow) {
  return {
    itemId: row.item_id,
    beneficiaryId: row.beneficiary_id,
    amount: {
      value: Number(row.amount),
      currency: row.currency as "INR"
    },
    purpose: row.purpose,
    state: row.state,
    bankReference: row.bank_reference,
    failureReason: row.failure_reason,
    processedAt: row.processed_at?.toISOString() ?? null
  } satisfies PayoutItem;
}

function mapRefundRow(row: PayoutRefundRow) {
  return {
    refundId: row.refund_id,
    batchId: row.batch_id,
    bankTenantId: row.bank_tenant_id,
    corporateTenantId: row.corporate_tenant_id,
    corporateId: row.corporate_id,
    subscriptionId: row.subscription_id,
    packageCode: row.package_code,
    requestedByUserId: row.requested_by_user_id,
    amount: Number(row.amount),
    reason: row.reason,
    state: row.state,
    createdAt: row.created_at?.toISOString() ?? null,
    processedAt: row.processed_at?.toISOString() ?? null
  } satisfies PayoutRefund;
}

function generate16DigitUtr(): string {
  let utr = (Math.floor(Math.random() * 9) + 1).toString();
  for (let i = 1; i < 16; i++) {
    utr += Math.floor(Math.random() * 10).toString();
  }
  return utr;
}

