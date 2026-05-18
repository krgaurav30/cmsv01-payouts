import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";

import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { TenantManagementService } from "../tenant-management/service.js";

import type {
  Beneficiary,
  BeneficiaryApprovalActionRequest,
  BeneficiaryCreateRequest,
  PublishedBeneficiaryApprovalRequest,
  PublishedBeneficiaryCreateRequest,
  BeneficiaryStatusActionRequest,
  BeneficiaryUpdateRequest
} from "./contracts.js";

type BeneficiaryRow = {
  beneficiary_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string | null;
  name: string;
  account_number: string;
  ifsc: string;
  phone_number: string | null;
  category: string | null;
  tags: string[] | null;
  status: Beneficiary["status"];
  approval_state: Beneficiary["approvalState"];
  review_comment: string | null;
  updated_at: Date | null;
};

export class BeneficiaryManagementService {
  private readonly db = getDatabasePool(loadConfig());

  constructor(
    private readonly tenantManagementService = new TenantManagementService(),
    private readonly identityAccessService = new IdentityAccessService(loadConfig()),
    private readonly notificationsService = new NotificationsService()
  ) {}

  async listBeneficiaries(filters?: {
    corporateTenantId?: string;
    corporateId?: string;
    status?: Beneficiary["status"];
    category?: string;
    search?: string;
  }) {
    const clauses: string[] = [];
    const values: string[] = [];

    if (filters?.corporateTenantId) {
      values.push(filters.corporateTenantId);
      clauses.push(`corporate_tenant_id = $${values.length}`);
    }

    if (filters?.corporateId) {
      values.push(filters.corporateId);
      clauses.push(`corporate_id = $${values.length}`);
    }

    if (filters?.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    if (filters?.category) {
      values.push(filters.category);
      clauses.push(`category = $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(lower(name) like $${values.length} or account_number like $${values.length})`);
    }

    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query<BeneficiaryRow>(
      `select beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
              account_number, ifsc, phone_number, category, tags, status,
              approval_state, review_comment, updated_at
       from beneficiaries
       ${whereClause}
       order by updated_at desc nulls last, beneficiary_id desc`,
      values
    );

    return result.rows.map(mapBeneficiaryRow);
  }

  async getBeneficiary(beneficiaryId: string) {
    const result = await this.db.query<BeneficiaryRow>(
      `select beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
              account_number, ifsc, phone_number, category, tags, status,
              approval_state, review_comment, updated_at
       from beneficiaries
       where beneficiary_id = $1`,
      [beneficiaryId]
    );

    const row = result.rows[0];
    return row ? mapBeneficiaryRow(row) : null;
  }

  async createBeneficiary(payload: BeneficiaryCreateRequest) {
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
        "beneficiary.make"
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

    const duplicate = await this.db.query<{ beneficiary_id: string }>(
      `select beneficiary_id
       from beneficiaries
       where corporate_id = $1
         and lower(name) = lower($2)
         and account_number = $3
       limit 1`,
      [payload.corporateId, payload.name, payload.accountNumber]
    );

    if (duplicate.rows[0]) {
      return {
        error: "duplicate_beneficiary" as const,
        beneficiaryId: duplicate.rows[0].beneficiary_id
      };
    }

    const beneficiaryId = await this.generateBeneficiaryId();
    const result = await this.db.query<BeneficiaryRow>(
      `insert into beneficiaries (
         beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
         account_number, ifsc, type, pan, gstin, phone_number, category, tags,
         status, approval_state, review_comment, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, 'vendor', null, null, $8, $9, $10,
               'inactive', 'pending_approval', null, now())
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [
        beneficiaryId,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId,
        payload.name,
        payload.accountNumber,
        payload.ifsc,
        payload.phoneNumber,
        payload.category ?? null,
        payload.tags
      ]
    );

    const created = mapBeneficiaryRow(result.rows[0]);

    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      permission: "beneficiary.checker",
      title: "Beneficiary approval pending",
      message: `${payload.name} is waiting for checker approval.`,
      targetSection: "approvals",
      entityType: "beneficiary",
      entityId: created.beneficiaryId
    });

    return {
      data: created
    };
  }

  async createPublishedBeneficiary(payload: PublishedBeneficiaryCreateRequest) {
    const actor = await this.identityAccessService.getCorporateUserByUsername(
      payload.actorUsername
    );

    if (!actor) {
      return {
        error: "actor_not_found" as const
      };
    }

    return this.createBeneficiary({
      createdByUserId: actor.userId,
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      name: payload.beneName,
      accountNumber: payload.beneBankAccountNumber,
      ifsc: payload.beneIfscCode,
      phoneNumber: payload.benePhoneNumber,
      category: payload.beneCategory,
      tags: payload.tags
    });
  }

  async authorizePublishedBeneficiary(
    beneficiaryId: string,
    payload: PublishedBeneficiaryApprovalRequest
  ) {
    const actor = await this.identityAccessService.getCorporateUserByUsername(
      payload.actorUsername
    );

    if (!actor) {
      return {
        error: "actor_not_found" as const
      };
    }

    return this.applyApprovalAction(beneficiaryId, {
      action: payload.action,
      actedByUserId: actor.userId,
      comment: payload.comment
    });
  }

  async applyApprovalAction(
    beneficiaryId: string,
    payload: BeneficiaryApprovalActionRequest
  ) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.actedByUserId,
        "beneficiary.checker"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    const existing = await this.getBeneficiary(beneficiaryId);
    if (!existing) {
      return {
        error: "beneficiary_not_found" as const
      };
    }

    if (existing.approvalState !== "pending_approval") {
      return {
        error: "invalid_transition" as const,
        currentState: existing.approvalState
      };
    }

    const nextApprovalState = payload.action === "approve" ? "approved" : "rejected";
    const nextStatus = payload.action === "approve" ? "active" : "inactive";

    const result = await this.db.query<BeneficiaryRow>(
      `update beneficiaries
       set approval_state = $2,
           status = $3,
           review_comment = $4,
           updated_at = now()
       where beneficiary_id = $1
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [beneficiaryId, nextApprovalState, nextStatus, payload.comment ?? null]
    );

    const updated = mapBeneficiaryRow(result.rows[0]);
    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: existing.corporateTenantId,
      corporateId: existing.corporateId,
      permission: "beneficiary.make",
      title: `Beneficiary ${payload.action === "approve" ? "approved" : "rejected"}`,
      message: `${existing.name} was ${payload.action === "approve" ? "approved" : "rejected"} by ${actor.displayName}.`,
      targetSection: "beneficiaries",
      entityType: "beneficiary",
      entityId: beneficiaryId
    });

    return {
      data: updated
    };
  }

  async applyStatusAction(
    beneficiaryId: string,
    payload: BeneficiaryStatusActionRequest
  ) {
    const actor = await this.identityAccessService.getCorporateUserById(payload.actedByUserId);
    if (
      !actor ||
      !(await this.identityAccessService.userHasPermission(
        payload.actedByUserId,
        "beneficiary.make"
      ))
    ) {
      return {
        error: "forbidden" as const
      };
    }

    const existing = await this.getBeneficiary(beneficiaryId);
    if (!existing) {
      return {
        error: "beneficiary_not_found" as const
      };
    }

    if (existing.approvalState !== "approved") {
      return {
        error: "beneficiary_not_approved" as const,
        currentState: existing.approvalState
      };
    }

    const nextStatus = payload.action === "activate" ? "active" : "inactive";
    const result = await this.db.query<BeneficiaryRow>(
      `update beneficiaries
       set status = $2,
           review_comment = $3,
           updated_at = now()
       where beneficiary_id = $1
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [beneficiaryId, nextStatus, payload.comment ?? null]
    );

    return {
      data: mapBeneficiaryRow(result.rows[0])
    };
  }

  async updateBeneficiary(beneficiaryId: string, payload: BeneficiaryUpdateRequest) {
    const existing = await this.getBeneficiary(beneficiaryId);

    if (!existing) {
      return {
        error: "beneficiary_not_found" as const
      };
    }

    const result = await this.db.query<BeneficiaryRow>(
      `update beneficiaries
       set name = $2,
           account_number = $3,
           ifsc = $4,
           phone_number = $5,
           category = $6,
           tags = $7,
           updated_at = now()
       where beneficiary_id = $1
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [
        beneficiaryId,
        payload.name,
        payload.accountNumber,
        payload.ifsc,
        payload.phoneNumber,
        payload.category ?? null,
        payload.tags
      ]
    );

    return {
      data: mapBeneficiaryRow(result.rows[0])
    };
  }

  async deleteBeneficiary(beneficiaryId: string) {
    const result = await this.db.query(
      `delete from beneficiaries where beneficiary_id = $1`,
      [beneficiaryId]
    );

    return {
      deleted: (result.rowCount ?? 0) > 0
    };
  }

  private async generateBeneficiaryId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${Date.now()}`.slice(-6) + `${Math.floor(Math.random() * 10000)}`.padStart(4, "0");
      const existing = await this.db.query<{ beneficiary_id: string }>(
        `select beneficiary_id from beneficiaries where beneficiary_id = $1 limit 1`,
        [candidate]
      );

      if (!existing.rows[0]) {
        return candidate;
      }
    }

    return `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  }
}

function mapBeneficiaryRow(row: BeneficiaryRow) {
  return {
    beneficiaryId: row.beneficiary_id,
    bankTenantId: row.bank_tenant_id,
    corporateTenantId: row.corporate_tenant_id,
    corporateId: row.corporate_id,
    name: row.name,
    accountNumber: row.account_number,
    ifsc: row.ifsc,
    bankName: inferBankNameFromIfsc(row.ifsc),
    phoneNumber: row.phone_number,
    category: row.category,
    tags: row.tags ?? [],
    status: row.status,
    approvalState: row.approval_state,
    reviewComment: row.review_comment,
    lastUpdatedAt: row.updated_at?.toISOString() ?? null
  } satisfies Beneficiary;
}

function inferBankNameFromIfsc(ifsc: string) {
  const prefix = ifsc.slice(0, 4).toUpperCase();
  const banks: Record<string, string> = {
    HDFC: "HDFC Bank",
    SBIN: "State Bank of India",
    ICIC: "ICICI Bank",
    UTIB: "Axis Bank",
    KKBK: "Kotak Mahindra Bank",
    YESB: "Yes Bank",
    PUNB: "Punjab National Bank",
    BARB: "Bank of Baroda",
    IDIB: "Indian Bank",
    CNRB: "Canara Bank"
  };

  return banks[prefix] ?? "Unknown Bank";
}
