import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool, withDatabaseTransaction } from "@cmsv01/shared/db";
import { createDomainEvent } from "@cmsv01/shared/events";
import { appendOutboxEvent } from "@cmsv01/shared/outbox";
import { ApprovalMatrixManagementService } from "../approval-matrix-management/service.js";
import { BeneficiaryManagementService } from "../beneficiary-management/service.js";
import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { SettingsManagementService } from "../settings-management/service.js";
import { TenantManagementService } from "../tenant-management/service.js";
export class PayoutManagementService {
    approvalMatrixManagementService;
    tenantManagementService;
    beneficiaryManagementService;
    identityAccessService;
    settingsManagementService;
    notificationsService;
    config = loadConfig();
    db = getDatabasePool(this.config);
    baseCurrency = "INR";
    constructor(approvalMatrixManagementService = new ApprovalMatrixManagementService(), tenantManagementService = new TenantManagementService(), beneficiaryManagementService = new BeneficiaryManagementService(), identityAccessService = new IdentityAccessService(loadConfig()), settingsManagementService = new SettingsManagementService(), notificationsService = new NotificationsService()) {
        this.approvalMatrixManagementService = approvalMatrixManagementService;
        this.tenantManagementService = tenantManagementService;
        this.beneficiaryManagementService = beneficiaryManagementService;
        this.identityAccessService = identityAccessService;
        this.settingsManagementService = settingsManagementService;
        this.notificationsService = notificationsService;
    }
    async listBatches(filters) {
        const clauses = [];
        const params = [];
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
        if (filters?.state) {
            params.push(filters.state);
            clauses.push(`state = $${params.length}`);
        }
        if (filters?.search) {
            params.push(`%${filters.search.toLowerCase()}%`);
            clauses.push(`(lower(title) like $${params.length} or lower(batch_id) like $${params.length})`);
        }
        const projectionWhereClauses = clauses.map((clause) => clause
            .replaceAll("corporate_tenant_id", "tlp.corporate_tenant_id")
            .replaceAll("bank_tenant_id", "tlp.bank_tenant_id")
            .replaceAll("corporate_id", "tlp.corporate_id")
            .replaceAll("state", "tlp.state")
            .replaceAll("title", "tlp.title")
            .replaceAll("batch_id", "tlp.batch_id"));
        const projectionResult = params.length > 0
            ? await this.db.query(`select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    primary_beneficiary_id, primary_beneficiary_name, created_by_user_id,
                    created_by_role, title, tag, remark, state, total_amount,
                    approval_comment, bank_reference, created_at, submitted_at,
                    submitted_by_user_id, submitted_by_role, approved_at,
                    approved_by_user_id, approved_by_role, rejected_at,
                    rejected_by_user_id, rejected_by_role, dispatched_at,
                    completed_at, failure_reason, approval_levels_required,
                    current_approval_level, roles_by_level, matched_matrix_ids
             from transaction_list_projection tlp
             where ${projectionWhereClauses.join(" and ")}
             order by tlp.created_at desc nulls last, tlp.batch_id desc`, params)
            : await this.db.query(`select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id,
                    primary_beneficiary_id, primary_beneficiary_name, created_by_user_id,
                    created_by_role, title, tag, remark, state, total_amount,
                    approval_comment, bank_reference, created_at, submitted_at,
                    submitted_by_user_id, submitted_by_role, approved_at,
                    approved_by_user_id, approved_by_role, rejected_at,
                    rejected_by_user_id, rejected_by_role, dispatched_at,
                    completed_at, failure_reason, approval_levels_required,
                    current_approval_level, roles_by_level, matched_matrix_ids
             from transaction_list_projection tlp
             order by tlp.created_at desc nulls last, tlp.batch_id desc`);
        if (projectionResult.rows.length > 0) {
            return projectionResult.rows.map((row) => this.mapBatchListRow(row));
        }
        const baseQuery = `select pb.batch_id, pb.bank_tenant_id, pb.corporate_tenant_id, pb.corporate_id,
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
                       ) first_item on true`;
        const result = params.length > 0
            ? await this.db.query(`${baseQuery}
             where ${clauses
                .map((clause) => clause
                .replaceAll("corporate_tenant_id", "pb.corporate_tenant_id")
                .replaceAll("bank_tenant_id", "pb.bank_tenant_id")
                .replaceAll("corporate_id", "pb.corporate_id")
                .replaceAll("state", "pb.state")
                .replaceAll("title", "pb.title")
                .replaceAll("batch_id", "pb.batch_id"))
                .join(" and ")}
             order by pb.created_at desc nulls last, pb.batch_id desc`, params)
            : await this.db.query(`${baseQuery}
             order by pb.created_at desc nulls last, pb.batch_id desc`);
        return result.rows.map((row) => this.mapBatchListRow(row));
    }
    async getBatch(batchId) {
        const result = await this.db.query(`select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, created_by_user_id,
              created_by_role, title, tag, remark, state, total_amount, approval_comment,
              bank_reference, created_at, submitted_at, submitted_by_user_id, submitted_by_role,
              approved_at, approved_by_user_id, approved_by_role, rejected_at,
              rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
              failure_reason
       from payout_batches
       where batch_id = $1`, [batchId]);
        const row = result.rows[0];
        return row ? this.mapBatchRow(row) : null;
    }
    async createBatch(payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
        const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);
        const corporateTenant = await this.tenantManagementService.getCorporateTenant(payload.corporateTenantId);
        const corporate = await this.tenantManagementService.getCorporate(payload.corporateId);
        if (!actor ||
            !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "transaction.make"))) {
            return {
                error: "forbidden"
            };
        }
        if (!bankTenant) {
            return {
                error: "bank_not_found"
            };
        }
        if (!corporateTenant) {
            return {
                error: "corporate_not_found"
            };
        }
        if (!corporate || corporate.corporateTenantId !== payload.corporateTenantId) {
            return {
                error: "child_corporate_not_found"
            };
        }
        const settings = await this.settingsManagementService.getSettingsForCorporateTenant(payload.corporateTenantId);
        const effectiveSingleLimit = settings?.maxSingleTransactionAmount ?? 500_000;
        const effectiveDailyLimit = settings?.maxDailyCumulativeTransactionAmount ?? 5_000_000;
        if (settings?.duplicateReferencePolicy !== "disabled") {
            const existingReference = await this.findBatchByReference(payload.corporateTenantId, payload.corporateId, payload.title);
            if (existingReference && existingReference.batchId !== payload.batchId) {
                return {
                    error: "duplicate_transaction_reference",
                    transactionReference: payload.title,
                    existingState: existingReference.state
                };
            }
        }
        for (const item of payload.items) {
            const beneficiary = await this.beneficiaryManagementService.getBeneficiary(item.beneficiaryId);
            if (!beneficiary) {
                return {
                    error: "beneficiary_not_found",
                    beneficiaryId: item.beneficiaryId
                };
            }
            if (beneficiary.corporateId !== payload.corporateId) {
                return {
                    error: "beneficiary_corporate_mismatch",
                    beneficiaryId: item.beneficiaryId
                };
            }
            if (beneficiary.approvalState !== "approved") {
                return {
                    error: "beneficiary_not_approved",
                    beneficiaryId: item.beneficiaryId
                };
            }
            if (beneficiary.status !== "active") {
                return {
                    error: "beneficiary_inactive",
                    beneficiaryId: item.beneficiaryId
                };
            }
        }
        const totalAmount = payload.items.reduce((sum, item) => sum + item.amount.value, 0);
        if (totalAmount > effectiveSingleLimit) {
            return {
                error: "single_transaction_limit_exceeded",
                limit: effectiveSingleLimit
            };
        }
        const currentDailyTotal = await this.getCurrentDailyCumulativeAmount(payload.corporateTenantId, payload.corporateId, payload.batchId);
        if (currentDailyTotal + totalAmount > effectiveDailyLimit) {
            return {
                error: "daily_cumulative_limit_exceeded",
                limit: effectiveDailyLimit,
                currentTotal: currentDailyTotal
            };
        }
        await withDatabaseTransaction(this.config, async (client) => {
            await client.query(`insert into payout_batches (
           batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, created_by_user_id,
           created_by_role, title, tag, remark, state, total_amount, approval_comment,
           bank_reference, created_at, submitted_at, submitted_by_user_id, submitted_by_role,
           approved_at, approved_by_user_id, approved_by_role, rejected_at,
           rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
           failure_reason
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, null, null, now(),
                 null, null, null, null, null, null, null, null, null, null, null, null)
         on conflict (batch_id) do update
         set bank_tenant_id = excluded.bank_tenant_id,
             corporate_tenant_id = excluded.corporate_tenant_id,
             corporate_id = excluded.corporate_id,
             created_by_user_id = excluded.created_by_user_id,
             created_by_role = excluded.created_by_role,
             title = excluded.title,
             tag = excluded.tag,
             remark = excluded.remark,
             total_amount = excluded.total_amount`, [
                payload.batchId,
                payload.bankTenantId,
                payload.corporateTenantId,
                payload.corporateId,
                payload.createdByUserId,
                actor.role,
                payload.title,
                payload.tag ?? null,
                payload.remark ?? null,
                totalAmount
            ]);
            await client.query(`delete from payout_items where batch_id = $1`, [payload.batchId]);
            for (const item of payload.items) {
                await client.query(`insert into payout_items (
             item_id, batch_id, beneficiary_id, amount, currency, purpose, state,
             bank_reference, failure_reason, processed_at
           )
           values ($1, $2, $3, $4, $5, $6, 'pending', null, null, null)`, [
                    item.itemId,
                    payload.batchId,
                    item.beneficiaryId,
                    item.amount.value,
                    item.amount.currency,
                    item.purpose
                ]);
            }
            await this.appendTransactionOutboxEvent(client, payload.batchId, "transaction.created", {
                batchId: payload.batchId,
                bankTenantId: payload.bankTenantId,
                corporateTenantId: payload.corporateTenantId,
                corporateId: payload.corporateId,
                transactionReference: payload.title,
                totalAmount: {
                    value: totalAmount,
                    currency: this.baseCurrency
                },
                itemCount: payload.items.length,
                createdByUserId: payload.createdByUserId,
                createdByRole: actor.role,
                state: "draft",
                occurredAt: new Date().toISOString()
            });
        });
        return {
            data: await this.getBatch(payload.batchId)
        };
    }
    async createBulkBatches(payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
        if (!actor ||
            !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "transaction.make"))) {
            return {
                error: "forbidden"
            };
        }
        const settings = await this.settingsManagementService.getSettingsForCorporateTenant(payload.corporateTenantId);
        const effectiveBulkRowLimit = settings?.maxBulkUploadRows ?? 100;
        const existingFileUpload = await this.findFileUploadByName(payload.corporateTenantId, payload.corporateId, payload.fileName);
        if (existingFileUpload) {
            const fileUploadResult = await this.recordFileUpload({
                uploadId: createSimpleId("upload"),
                bankTenantId: payload.bankTenantId,
                corporateTenantId: payload.corporateTenantId,
                corporateId: payload.corporateId,
                fileName: payload.fileName,
                uploadedByUserId: payload.createdByUserId,
                status: "rejected",
                remark: `File name already uploaded earlier as ${existingFileUpload.status}`,
                totalRows: payload.rows.length,
                createdCount: 0,
                rejectedCount: payload.rows.length
            });
            return {
                error: "duplicate_file_name",
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
                fileName: payload.fileName,
                uploadedByUserId: payload.createdByUserId,
                status: "rejected",
                remark: `File exceeds maximum allowed rows (${effectiveBulkRowLimit})`,
                totalRows: payload.rows.length,
                createdCount: 0,
                rejectedCount: payload.rows.length
            });
            return {
                error: "bulk_upload_row_limit_exceeded",
                limit: effectiveBulkRowLimit,
                fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
            };
        }
        const referencesSeen = new Set();
        const beneficiaries = await this.beneficiaryManagementService.listBeneficiaries({
            corporateTenantId: payload.corporateTenantId,
            corporateId: payload.corporateId
        });
        const beneficiaryMap = new Map(beneficiaries.map((beneficiary) => [beneficiary.name.trim().toLowerCase(), beneficiary]));
        const created = [];
        const rejected = [];
        for (const [index, row] of payload.rows.entries()) {
            const transactionReference = row.transactionReference.trim();
            const normalizedReference = transactionReference.toLowerCase();
            const rowNumber = index + 2;
            if (settings?.duplicateReferencePolicy !== "disabled" &&
                referencesSeen.has(normalizedReference)) {
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
            const beneficiary = beneficiaryMap.get(row.beneficiaryName.trim().toLowerCase());
            if (!beneficiary) {
                rejected.push({
                    rowNumber,
                    transactionReference,
                    reason: `Beneficiary not found: ${row.beneficiaryName}`
                });
                continue;
            }
            const createResult = await this.createBatch({
                batchId: crypto.randomUUID(),
                bankTenantId: payload.bankTenantId,
                corporateTenantId: payload.corporateTenantId,
                corporateId: payload.corporateId,
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
            if ("error" in createResult) {
                rejected.push({
                    rowNumber,
                    transactionReference,
                    reason: mapBulkCreateErrorToMessage(createResult)
                });
                continue;
            }
            const submitResult = await this.applyApprovalAction(createResult.data.batchId, {
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
            created.push(submitResult.data);
        }
        const status = created.length === payload.rows.length
            ? "successful"
            : created.length > 0
                ? "partially_successful"
                : "failed";
        const remark = rejected.length > 0
            ? rejected
                .slice(0, 5)
                .map((item) => `Row ${item.rowNumber} (${item.transactionReference}): ${item.reason}`)
                .join(" | ")
            : undefined;
        const fileUploadResult = await this.recordFileUpload({
            uploadId: createSimpleId("upload"),
            bankTenantId: payload.bankTenantId,
            corporateTenantId: payload.corporateTenantId,
            corporateId: payload.corporateId,
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
    async acceptBulkFileUpload(payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.createdByUserId);
        if (!actor ||
            !(await this.identityAccessService.userHasPermission(payload.createdByUserId, "transaction.make"))) {
            return {
                error: "forbidden"
            };
        }
        const settings = await this.settingsManagementService.getSettingsForCorporateTenant(payload.corporateTenantId);
        const effectiveBulkRowLimit = settings?.maxBulkUploadRows ?? 100;
        const existingFileUpload = await this.findFileUploadByName(payload.corporateTenantId, payload.corporateId, payload.fileName);
        if (existingFileUpload) {
            const fileUploadResult = await this.recordFileUpload({
                uploadId: createSimpleId("upload"),
                bankTenantId: payload.bankTenantId,
                corporateTenantId: payload.corporateTenantId,
                corporateId: payload.corporateId,
                fileName: payload.fileName,
                uploadedByUserId: payload.createdByUserId,
                status: "rejected",
                remark: `File name already uploaded earlier as ${existingFileUpload.status}`,
                totalRows: payload.rows.length,
                createdCount: 0,
                rejectedCount: payload.rows.length
            });
            return {
                error: "duplicate_file_name",
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
                fileName: payload.fileName,
                uploadedByUserId: payload.createdByUserId,
                status: "rejected",
                remark: `File exceeds maximum allowed rows (${effectiveBulkRowLimit})`,
                totalRows: payload.rows.length,
                createdCount: 0,
                rejectedCount: payload.rows.length
            });
            return {
                error: "bulk_upload_row_limit_exceeded",
                limit: effectiveBulkRowLimit,
                fileUpload: "data" in fileUploadResult ? fileUploadResult.data : null
            };
        }
        const uploadId = createSimpleId("upload");
        await withDatabaseTransaction(this.config, async (client) => {
            const uploadResult = await this.recordFileUpload({
                uploadId,
                bankTenantId: payload.bankTenantId,
                corporateTenantId: payload.corporateTenantId,
                corporateId: payload.corporateId,
                fileName: payload.fileName,
                uploadedByUserId: payload.createdByUserId,
                status: "processing",
                remark: "File accepted for background processing.",
                totalRows: payload.rows.length,
                createdCount: 0,
                rejectedCount: 0,
                payloadRows: payload.rows
            }, client);
            if ("error" in uploadResult) {
                throw new Error("Unable to record accepted file upload");
            }
            await appendOutboxEvent(client, createDomainEvent({
                aggregateType: "file-upload",
                aggregateId: uploadId,
                eventType: "file.accepted",
                eventKey: uploadId,
                payload: {
                    uploadId,
                    bankTenantId: payload.bankTenantId,
                    corporateTenantId: payload.corporateTenantId,
                    corporateId: payload.corporateId,
                    fileName: payload.fileName,
                    uploadedByUserId: payload.createdByUserId,
                    rowCount: payload.rows.length,
                    occurredAt: new Date().toISOString()
                }
            }));
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
    async createPublishedTransaction(payload) {
        const actor = await this.identityAccessService.getCorporateUserByUsername(payload.actorUsername);
        if (!actor) {
            return {
                error: "actor_not_found"
            };
        }
        const generatedBatchId = `txn-${Date.now()}-${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0")}`;
        const generatedItemId = `${generatedBatchId}-item-001`;
        const createResult = await this.createBatch({
            batchId: generatedBatchId,
            bankTenantId: payload.bankTenantId,
            corporateTenantId: payload.corporateTenantId,
            corporateId: payload.corporateId,
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
        });
        if ("error" in createResult) {
            return createResult;
        }
        return this.applyApprovalAction(generatedBatchId, {
            action: "submit",
            actedByUserId: actor.userId,
            comment: payload.remark ?? "Submitted through partner transaction API"
        });
    }
    async createAndSubmitBatch(payload) {
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
    async authorizePublishedTransaction(batchId, payload) {
        const actor = await this.identityAccessService.getCorporateUserByUsername(payload.actorUsername);
        if (!actor) {
            return {
                error: "actor_not_found"
            };
        }
        return this.applyApprovalAction(batchId, {
            action: payload.action,
            actedByUserId: actor.userId,
            comment: payload.comment
        });
    }
    async applyApprovalAction(batchId, payload) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
        const batch = await this.getBatch(batchId);
        if (!actor || actor.approvalState !== "approved") {
            return {
                error: "forbidden"
            };
        }
        if (payload.action === "submit" &&
            !(await this.identityAccessService.userHasPermission(payload.actedByUserId, "transaction.make"))) {
            return {
                error: "forbidden"
            };
        }
        if (["approve", "reject"].includes(payload.action) &&
            !(await this.identityAccessService.userHasPermission(payload.actedByUserId, "transaction.checker"))) {
            return {
                error: "forbidden"
            };
        }
        if (!batch) {
            return {
                error: "batch_not_found"
            };
        }
        const nextState = this.resolveNextState(batch.state, payload.action);
        if (!nextState) {
            return {
                error: "invalid_transition",
                currentState: batch.state
            };
        }
        const now = new Date();
        if (payload.action === "submit") {
            await withDatabaseTransaction(this.config, async (client) => {
                await client.query(`update payout_batches
           set state = $2,
               approval_comment = $3,
               submitted_at = $4,
               submitted_by_user_id = $5,
               submitted_by_role = $6
           where batch_id = $1`, [batchId, nextState, payload.comment ?? batch.approvalComment, now, actor.userId, actor.role]);
                await this.initializeApprovalContext(batchId, batch.corporateTenantId, batch.totalAmount.value, client);
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
        }
        else {
            const actionResult = await withDatabaseTransaction(this.config, async (client) => {
                const lockedBatchResult = await client.query(`select state, approval_comment
           from payout_batches
           where batch_id = $1
           for update`, [batchId]);
                const lockedBatch = lockedBatchResult.rows[0];
                if (!lockedBatch) {
                    return {
                        error: "batch_not_found"
                    };
                }
                if (!["pending_approval", "partially_approved"].includes(lockedBatch.state)) {
                    return {
                        error: "approval_action_in_progress"
                    };
                }
                const context = await this.getApprovalContextRow(batchId, true, client);
                const currentLevel = context?.current_approval_level ?? 1;
                const currentRoles = this.getRolesForLevel(context, currentLevel);
                if (currentRoles.length > 0 && !currentRoles.includes(actor.role)) {
                    return {
                        error: "forbidden"
                    };
                }
                await client.query(`insert into payout_batch_approval_actions (
             action_id, batch_id, approval_level, action, actor_user_id, actor_role, comment, created_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, now())`, [
                    `${batchId}-${currentLevel}-${payload.action}-${Date.now()}`,
                    batchId,
                    currentLevel,
                    payload.action,
                    actor.userId,
                    actor.role,
                    payload.comment ?? null
                ]);
                if (payload.action === "approve") {
                    const requiredLevels = context?.approval_levels_required ?? 1;
                    if (currentLevel < requiredLevels) {
                        await client.query(`update payout_batch_approval_contexts
               set current_approval_level = $2,
                   updated_at = now()
               where batch_id = $1`, [batchId, currentLevel + 1]);
                        await client.query(`update payout_batches
               set state = 'partially_approved',
                   approval_comment = $2
               where batch_id = $1`, [
                            batchId,
                            payload.comment ??
                                `Approval level ${currentLevel} completed by ${actor.role}`
                        ]);
                        await this.appendTransactionOutboxEvent(client, batchId, "transaction.partially_approved", {
                            batchId,
                            transactionReference: batch.title,
                            bankTenantId: batch.bankTenantId,
                            corporateTenantId: batch.corporateTenantId,
                            corporateId: batch.corporateId,
                            totalAmount: batch.totalAmount,
                            actedByUserId: actor.userId,
                            actedByRole: actor.role,
                            comment: payload.comment ??
                                `Approval level ${currentLevel} completed by ${actor.role}`,
                            state: "partially_approved",
                            approvalLevel: currentLevel,
                            approvalLevelsRequired: requiredLevels,
                            nextApprovalLevel: currentLevel + 1,
                            occurredAt: now.toISOString()
                        });
                    }
                    else {
                        if (context) {
                            await client.query(`update payout_batch_approval_contexts
                 set status = 'approved',
                     updated_at = now()
                 where batch_id = $1`, [batchId]);
                        }
                        await client.query(`update payout_batches
               set state = $2,
                   approval_comment = $3,
                   approved_at = $4,
                   approved_by_user_id = $5,
                   approved_by_role = $6
               where batch_id = $1`, [
                            batchId,
                            nextState,
                            payload.comment ?? lockedBatch.approval_comment,
                            now,
                            actor.userId,
                            actor.role
                        ]);
                        await this.appendTransactionOutboxEvent(client, batchId, "transaction.approved", {
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
                        });
                    }
                }
                else {
                    if (context) {
                        await client.query(`update payout_batch_approval_contexts
               set status = 'rejected',
                   updated_at = now()
               where batch_id = $1`, [batchId]);
                    }
                    await client.query(`update payout_batches
             set state = $2,
                 approval_comment = $3,
                 rejected_at = $4,
                 rejected_by_user_id = $5,
                 rejected_by_role = $6
             where batch_id = $1`, [
                        batchId,
                        nextState,
                        payload.comment ?? lockedBatch.approval_comment,
                        now,
                        actor.userId,
                        actor.role
                    ]);
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
    async dispatchBatch(batchId, payload) {
        const batch = await this.getBatch(batchId);
        if (!batch) {
            return {
                error: "batch_not_found"
            };
        }
        if (batch.state !== "approved") {
            return {
                error: "invalid_transition",
                currentState: batch.state
            };
        }
        const dispatchedAt = new Date();
        const batchReference = this.generateBankReference(batch.bankTenantId, batchId);
        await withDatabaseTransaction(this.config, async (client) => {
            await client.query(`update payout_batches
         set state = 'sent_to_bank',
             approval_comment = $2,
             bank_reference = $3,
             dispatched_at = $4,
             completed_at = null,
             failure_reason = null
         where batch_id = $1`, [
                batchId,
                payload.comment ?? `Dispatched by ${payload.actedByUserId}`,
                batchReference,
                dispatchedAt
            ]);
            for (const item of batch.items) {
                await client.query(`update payout_items
           set state = 'sent_to_bank',
               bank_reference = $2,
               failure_reason = null,
               processed_at = null
           where item_id = $1`, [item.itemId, `${batchReference}-${item.itemId.toUpperCase()}`]);
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
    async listRefunds(filters) {
        const clauses = [];
        const params = [];
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
        const result = params.length > 0
            ? await this.db.query(`select refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, requested_by_user_id,
                    amount, reason, state, created_at, processed_at
             from payout_refunds
             where ${clauses.join(" and ")}
             order by refund_id desc`, params)
            : await this.db.query(`select refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, requested_by_user_id,
                    amount, reason, state, created_at, processed_at
             from payout_refunds
             order by refund_id desc`);
        return result.rows.map(mapRefundRow);
    }
    async listFileUploads(filters) {
        const clauses = [];
        const params = [];
        if (filters?.corporateTenantId) {
            params.push(filters.corporateTenantId);
            clauses.push(`corporate_tenant_id = $${params.length}`);
        }
        if (filters?.corporateId) {
            params.push(filters.corporateId);
            clauses.push(`corporate_id = $${params.length}`);
        }
        if (filters?.bankTenantId) {
            params.push(filters.bankTenantId);
            clauses.push(`bank_tenant_id = $${params.length}`);
        }
        const projectionResult = params.length > 0
            ? await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
                    uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
                    created_count, rejected_count, uploaded_at
             from file_upload_projection
             where ${clauses.join(" and ")}
             order by uploaded_at desc nulls last, upload_id desc`, params)
            : await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
                    uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
                    created_count, rejected_count, uploaded_at
             from file_upload_projection
             order by uploaded_at desc nulls last, upload_id desc`);
        const result = projectionResult.rows.length
            ? projectionResult
            : params.length > 0
                ? await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
                    uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
                    created_count, rejected_count, uploaded_at
             from payout_file_uploads
             where ${clauses.join(" and ")}
             order by uploaded_at desc nulls last, upload_id desc`, params)
                : await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
                    uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
                    created_count, rejected_count, uploaded_at
             from payout_file_uploads
             order by uploaded_at desc nulls last, upload_id desc`);
        const items = [];
        for (const row of result.rows) {
            items.push(await this.mapFileUploadRow(row));
        }
        return items;
    }
    async getFileUpload(uploadId) {
        const result = await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
              uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
              created_count, rejected_count, uploaded_at, payload_json,
              processing_started_at, processed_at
       from payout_file_uploads
       where upload_id = $1`, [uploadId]);
        const row = result.rows[0];
        return row ? this.mapFileUploadRow(row) : null;
    }
    async recordFileUpload(payload, executor = this.db) {
        const actor = await this.identityAccessService.getCorporateUserById(payload.uploadedByUserId);
        if (!actor) {
            return {
                error: "forbidden"
            };
        }
        const result = await executor.query(`insert into payout_file_uploads (
         upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
         uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
         created_count, rejected_count, uploaded_at, payload_json
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13::jsonb)
       on conflict (upload_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           file_name = excluded.file_name,
           uploaded_by_user_id = excluded.uploaded_by_user_id,
           uploaded_by_role = excluded.uploaded_by_role,
           status = excluded.status,
           remark = excluded.remark,
           total_rows = excluded.total_rows,
           created_count = excluded.created_count,
           rejected_count = excluded.rejected_count,
           payload_json = excluded.payload_json
       returning upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
                 uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
                 created_count, rejected_count, uploaded_at, payload_json,
                 processing_started_at, processed_at`, [
            payload.uploadId,
            payload.bankTenantId,
            payload.corporateTenantId,
            payload.corporateId,
            payload.fileName,
            payload.uploadedByUserId,
            actor.role,
            payload.status,
            payload.remark ?? null,
            payload.totalRows,
            payload.createdCount,
            payload.rejectedCount,
            JSON.stringify(payload.payloadRows ?? null)
        ]);
        await executor.query(`insert into file_upload_projection (
         upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
         uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
         created_count, rejected_count, uploaded_at, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       on conflict (upload_id) do update
       set bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           file_name = excluded.file_name,
           uploaded_by_user_id = excluded.uploaded_by_user_id,
           uploaded_by_role = excluded.uploaded_by_role,
           status = excluded.status,
           remark = excluded.remark,
           total_rows = excluded.total_rows,
           created_count = excluded.created_count,
           rejected_count = excluded.rejected_count,
           uploaded_at = now(),
           updated_at = now()`, [
            payload.uploadId,
            payload.bankTenantId,
            payload.corporateTenantId,
            payload.corporateId,
            payload.fileName,
            payload.uploadedByUserId,
            actor.role,
            payload.status,
            payload.remark ?? null,
            payload.totalRows,
            payload.createdCount,
            payload.rejectedCount
        ]);
        return {
            data: await this.mapFileUploadRow(result.rows[0])
        };
    }
    async processAcceptedFileUpload(uploadId) {
        const result = await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
              uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
              created_count, rejected_count, uploaded_at, payload_json,
              processing_started_at, processed_at
       from payout_file_uploads
       where upload_id = $1
       for update`, [uploadId]);
        const upload = result.rows[0];
        if (!upload || upload.status !== "processing" || !upload.payload_json) {
            return;
        }
        await this.db.query(`update payout_file_uploads
       set processing_started_at = coalesce(processing_started_at, now())
       where upload_id = $1`, [uploadId]);
        const rows = upload.payload_json;
        const created = [];
        const rejected = [];
        const referencesSeen = new Set();
        const settings = await this.settingsManagementService.getSettingsForCorporateTenant(upload.corporate_tenant_id);
        const beneficiaries = await this.beneficiaryManagementService.listBeneficiaries({
            corporateTenantId: upload.corporate_tenant_id,
            corporateId: upload.corporate_id ?? undefined
        });
        const beneficiaryMap = new Map(beneficiaries.map((beneficiary) => [beneficiary.name.trim().toLowerCase(), beneficiary]));
        for (const [index, row] of rows.entries()) {
            const transactionReference = row.transactionReference.trim();
            const normalizedReference = transactionReference.toLowerCase();
            const rowNumber = index + 2;
            if (settings?.duplicateReferencePolicy !== "disabled" &&
                referencesSeen.has(normalizedReference)) {
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
            const beneficiary = beneficiaryMap.get(row.beneficiaryName.trim().toLowerCase());
            if (!beneficiary) {
                rejected.push({
                    rowNumber,
                    transactionReference,
                    reason: `Beneficiary not found: ${row.beneficiaryName}`
                });
                continue;
            }
            const createResult = await this.createAndSubmitBatch({
                batchId: crypto.randomUUID(),
                bankTenantId: upload.bank_tenant_id,
                corporateTenantId: upload.corporate_tenant_id,
                corporateId: upload.corporate_id ?? "",
                createdByUserId: upload.uploaded_by_user_id,
                title: transactionReference,
                tag: row.tag ?? undefined,
                remark: row.remark ?? undefined,
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
            if ("error" in createResult) {
                rejected.push({
                    rowNumber,
                    transactionReference,
                    reason: mapBulkCreateErrorToMessage(createResult)
                });
                continue;
            }
            created.push(createResult.data);
        }
        const status = created.length === rows.length
            ? "successful"
            : created.length > 0
                ? "partially_successful"
                : "failed";
        const remark = rejected.length > 0
            ? rejected
                .slice(0, 5)
                .map((item) => `Row ${item.rowNumber} (${item.transactionReference}): ${item.reason}`)
                .join(" | ")
            : status === "successful"
                ? "File processed successfully."
                : "No rows could be created from this file.";
        await this.db.query(`update payout_file_uploads
       set status = $2,
           remark = $3,
           created_count = $4,
           rejected_count = $5,
           payload_json = null,
           processed_at = now()
       where upload_id = $1`, [uploadId, status, remark, created.length, rejected.length]);
        await this.db.query(`update file_upload_projection
       set status = $2,
           remark = $3,
           created_count = $4,
           rejected_count = $5,
           updated_at = now()
       where upload_id = $1`, [uploadId, status, remark, created.length, rejected.length]);
        await appendOutboxEvent(this.db, createDomainEvent({
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
        }));
        return {
            created,
            rejected
        };
    }
    async createRefund(payload) {
        const bankTenant = await this.tenantManagementService.getBankTenant(payload.bankTenantId);
        const corporateTenant = await this.tenantManagementService.getCorporateTenant(payload.corporateTenantId);
        const corporate = payload.corporateId
            ? await this.tenantManagementService.getCorporate(payload.corporateId)
            : null;
        const batch = await this.getBatch(payload.batchId);
        if (!bankTenant) {
            return {
                error: "bank_not_found"
            };
        }
        if (!corporateTenant) {
            return {
                error: "corporate_not_found"
            };
        }
        if (!corporate || corporate.corporateTenantId !== payload.corporateTenantId) {
            return {
                error: "child_corporate_not_found"
            };
        }
        if (!batch) {
            return {
                error: "batch_not_found"
            };
        }
        if (batch.corporateTenantId !== payload.corporateTenantId) {
            return {
                error: "batch_corporate_mismatch"
            };
        }
        if (batch.corporateId !== payload.corporateId) {
            return {
                error: "batch_corporate_mismatch"
            };
        }
        if (!["paid", "failed"].includes(batch.state)) {
            return {
                error: "batch_not_refundable",
                currentState: batch.state
            };
        }
        if (payload.amount > batch.totalAmount.value) {
            return {
                error: "refund_amount_exceeds_batch",
                batchAmount: batch.totalAmount.value
            };
        }
        const result = await this.db.query(`insert into payout_refunds (
         refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, requested_by_user_id,
         amount, reason, state, created_at, processed_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'requested', now(), null)
       on conflict (refund_id) do update
       set batch_id = excluded.batch_id,
           bank_tenant_id = excluded.bank_tenant_id,
           corporate_tenant_id = excluded.corporate_tenant_id,
           corporate_id = excluded.corporate_id,
           requested_by_user_id = excluded.requested_by_user_id,
           amount = excluded.amount,
           reason = excluded.reason
       returning refund_id, batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, requested_by_user_id,
                 amount, reason, state, created_at, processed_at`, [
            payload.refundId,
            payload.batchId,
            payload.bankTenantId,
            payload.corporateTenantId,
            payload.corporateId,
            payload.requestedByUserId,
            payload.amount,
            payload.reason
        ]);
        return {
            data: mapRefundRow(result.rows[0])
        };
    }
    async simulateBankResponse(batchId, payload) {
        const batch = await this.getBatch(batchId);
        if (!batch) {
            return {
                error: "batch_not_found"
            };
        }
        if (batch.state !== "sent_to_bank") {
            return {
                error: "invalid_transition",
                currentState: batch.state
            };
        }
        const processedAt = new Date();
        const itemOutcomes = batch.items.map((item, index) => ({
            itemId: item.itemId,
            succeeded: batch.items.length === 1 ? true : index % 3 !== 2
        }));
        const successfulCount = itemOutcomes.filter((item) => item.succeeded).length;
        const failedCount = itemOutcomes.length - successfulCount;
        const nextBatchState = successfulCount === itemOutcomes.length ? "paid" : "failed";
        const failureReason = nextBatchState === "paid"
            ? null
            : failedCount === itemOutcomes.length
                ? "All payout items failed in mock bank processing"
                : `${failedCount} payout item(s) failed in mock bank processing`;
        await withDatabaseTransaction(this.config, async (client) => {
            for (const outcome of itemOutcomes) {
                await client.query(`update payout_items
           set state = $2,
               failure_reason = $3,
               processed_at = $4
           where item_id = $1`, [
                    outcome.itemId,
                    outcome.succeeded ? "processed" : "failed",
                    outcome.succeeded ? null : "Mock bank marked this payout item as failed",
                    processedAt
                ]);
            }
            await client.query(`update payout_batches
         set state = $2,
             approval_comment = $3,
             completed_at = $4,
             failure_reason = $5
         where batch_id = $1`, [
                batchId,
                nextBatchState,
                payload.comment ?? `Mock bank response captured by ${payload.actedByUserId}`,
                processedAt,
                failureReason
            ]);
            await this.appendTransactionOutboxEvent(client, batchId, nextBatchState === "paid" ? "transaction.paid" : "transaction.failed", {
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
            });
        });
        return {
            data: await this.getBatch(batchId)
        };
    }
    resolveNextState(currentState, action) {
        if (action === "submit" && currentState === "draft") {
            return "pending_approval";
        }
        if (action === "approve" && currentState === "pending_approval") {
            return "approved";
        }
        if (action === "approve" && currentState === "partially_approved") {
            return "approved";
        }
        if (action === "reject" &&
            (currentState === "pending_approval" || currentState === "partially_approved")) {
            return "rejected";
        }
        return null;
    }
    mapBatchListRow(row) {
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
            primaryBeneficiaryId: row.primary_beneficiary_id ?? null,
            primaryBeneficiaryName: row.primary_beneficiary_name ?? null,
            createdByUserId: row.created_by_user_id,
            createdByRole: row.created_by_role,
            title: row.title,
            tag: row.tag,
            remark: row.remark,
            state: row.state,
            totalAmount: {
                value: Number(row.total_amount),
                currency: this.baseCurrency
            },
            approvalComment: row.approval_comment,
            bankReference: row.bank_reference,
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
        };
    }
    async mapBatchRow(row) {
        const itemsResult = await this.db.query(`select item_id, batch_id, beneficiary_id, amount, currency, purpose,
              state, bank_reference, failure_reason, processed_at
       from payout_items
       where batch_id = $1
       order by item_id`, [row.batch_id]);
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
            primaryBeneficiaryId: itemsResult.rows[0]?.beneficiary_id ?? null,
            primaryBeneficiaryName: null,
            createdByUserId: row.created_by_user_id,
            createdByRole: row.created_by_role,
            title: row.title,
            tag: row.tag,
            remark: row.remark,
            state: row.state,
            totalAmount: {
                value: Number(row.total_amount),
                currency: this.baseCurrency
            },
            approvalComment: row.approval_comment,
            bankReference: row.bank_reference,
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
        };
    }
    async buildTimeline(row) {
        const timelineEntries = [
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
            },
            {
                event: "approved",
                role: row.approved_by_role,
                userId: row.approved_by_user_id,
                at: row.approved_at
            },
            {
                event: "rejected",
                role: row.rejected_by_role,
                userId: row.rejected_by_user_id,
                at: row.rejected_at
            }
        ];
        const filteredTimelineEntries = timelineEntries.filter((entry) => Boolean(entry.userId || entry.at));
        const userIds = [...new Set(filteredTimelineEntries.map((entry) => entry.userId).filter(Boolean))];
        const userMap = new Map();
        await Promise.all(userIds.map(async (userId) => {
            const user = await this.identityAccessService.getCorporateUserById(userId);
            if (user) {
                userMap.set(userId, user.displayName);
            }
        }));
        return filteredTimelineEntries.map((entry) => ({
            event: entry.event,
            role: entry.role,
            userId: entry.userId,
            userName: entry.userId ? userMap.get(entry.userId) ?? null : null,
            at: entry.at?.toISOString() ?? null
        }));
    }
    async mapFileUploadRow(row) {
        const user = await this.identityAccessService.getCorporateUserById(row.uploaded_by_user_id);
        return {
            uploadId: row.upload_id,
            bankTenantId: row.bank_tenant_id,
            corporateTenantId: row.corporate_tenant_id,
            corporateId: row.corporate_id,
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
        };
    }
    async findFileUploadByName(corporateTenantId, corporateId, fileName) {
        const result = await this.db.query(`select upload_id, bank_tenant_id, corporate_tenant_id, corporate_id, file_name,
              uploaded_by_user_id, uploaded_by_role, status, remark, total_rows,
              created_count, rejected_count, uploaded_at
       from payout_file_uploads
       where corporate_tenant_id = $1
         and corporate_id = $2
         and lower(file_name) = lower($3)
       order by uploaded_at desc nulls last
       limit 1`, [corporateTenantId, corporateId, fileName]);
        const row = result.rows[0];
        return row ? this.mapFileUploadRow(row) : null;
    }
    generateBankReference(bankTenantId, batchId) {
        const prefix = bankTenantId.replace(/[^a-z0-9]/gi, "").toUpperCase();
        return `${prefix}-DISP-${batchId.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
    }
    async findBatchByReference(corporateTenantId, corporateId, transactionReference) {
        const result = await this.db.query(`select batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, created_by_user_id,
              created_by_role, title, tag, remark, state, total_amount, approval_comment,
              bank_reference, created_at, submitted_at, submitted_by_user_id, submitted_by_role,
              approved_at, approved_by_user_id, approved_by_role, rejected_at,
              rejected_by_user_id, rejected_by_role, dispatched_at, completed_at,
              failure_reason
       from payout_batches
       where corporate_tenant_id = $1
         and corporate_id = $2
         and lower(title) = lower($3)
       order by created_at desc nulls last
       limit 1`, [corporateTenantId, corporateId, transactionReference]);
        const row = result.rows[0];
        return row ? this.mapBatchRow(row) : null;
    }
    async getCurrentDailyCumulativeAmount(corporateTenantId, corporateId, excludingBatchId) {
        const params = [corporateTenantId, corporateId];
        let exclusionClause = "";
        if (excludingBatchId) {
            params.push(excludingBatchId);
            exclusionClause = `and batch_id <> $${params.length}`;
        }
        const result = await this.db.query(`select coalesce(sum(total_amount), 0)::text as total_amount
       from payout_batches
       where corporate_tenant_id = $1
         and corporate_id = $2
         and state <> 'rejected'
         and created_at >= date_trunc('day', now())
         and created_at < date_trunc('day', now()) + interval '1 day'
         ${exclusionClause}`, params);
        return Number(result.rows[0]?.total_amount ?? 0);
    }
    async initializeApprovalContext(batchId, corporateTenantId, amount, executor = this.db) {
        const snapshot = await this.approvalMatrixManagementService.buildTransactionApprovalPlan(corporateTenantId, amount);
        await executor.query(`insert into payout_batch_approval_contexts (
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
           updated_at = now()`, [
            batchId,
            corporateTenantId,
            snapshot.approvalLevelsRequired,
            snapshot.currentApprovalLevel,
            JSON.stringify(snapshot.rolesByLevel),
            snapshot.matchedApprovalMatrixIds
        ]);
    }
    async getApprovalContextRow(batchId, forUpdate = false, executor = this.db) {
        const result = await executor.query(`select batch_id, corporate_tenant_id, entity_type, approval_levels_required,
              current_approval_level, roles_by_level, matched_matrix_ids, status,
              created_at, updated_at
       from payout_batch_approval_contexts
       where batch_id = $1
       ${forUpdate ? "for update" : ""}`, [batchId]);
        return result.rows[0] ?? null;
    }
    getRolesForLevel(context, level) {
        const match = context?.roles_by_level?.find((entry) => entry.level === level);
        return match?.roles ?? [];
    }
    async appendTransactionOutboxEvent(executor, batchId, eventType, payload) {
        await appendOutboxEvent(executor, createDomainEvent({
            aggregateType: "transaction",
            aggregateId: batchId,
            eventType,
            eventKey: batchId,
            payload
        }));
    }
}
function mapBulkCreateErrorToMessage(error) {
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
        case "duplicate_transaction_reference":
            return `Transaction reference already used earlier (${error.existingState})`;
        case "single_transaction_limit_exceeded":
            return `Transaction exceeds the single transaction limit of INR ${formatCurrency(error.limit)}`;
        case "daily_cumulative_limit_exceeded":
            return `Daily cumulative limit of INR ${formatCurrency(error.limit)} would be exceeded`;
        case "forbidden":
            return "Only an approved transaction maker can upload transactions";
    }
}
function formatCurrency(value) {
    return value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function createSimpleId(prefix) {
    return `${prefix}-${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0")}`;
}
function mapPayoutItemRow(row) {
    return {
        itemId: row.item_id,
        beneficiaryId: row.beneficiary_id,
        amount: {
            value: Number(row.amount),
            currency: row.currency
        },
        purpose: row.purpose,
        state: row.state,
        bankReference: row.bank_reference,
        failureReason: row.failure_reason,
        processedAt: row.processed_at?.toISOString() ?? null
    };
}
function mapRefundRow(row) {
    return {
        refundId: row.refund_id,
        batchId: row.batch_id,
        bankTenantId: row.bank_tenant_id,
        corporateTenantId: row.corporate_tenant_id,
        corporateId: row.corporate_id,
        requestedByUserId: row.requested_by_user_id,
        amount: Number(row.amount),
        reason: row.reason,
        state: row.state,
        createdAt: row.created_at?.toISOString() ?? null,
        processedAt: row.processed_at?.toISOString() ?? null
    };
}
