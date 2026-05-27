import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool, type DatabaseExecutor } from "@cmsv01/shared/db";

import { IdentityAccessService } from "../identity-access/service.js";
import { NotificationsService } from "../notifications/service.js";
import { TenantManagementService } from "../tenant-management/service.js";

import type {
  Beneficiary,
  BeneficiaryApprovalActionRequest,
  BeneficiaryCreateRequest,
  BeneficiaryPackageAssignment,
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
  type: Beneficiary["beneficiaryType"];
  category: string | null;
  tags: string[] | null;
  status: Beneficiary["status"];
  approval_state: Beneficiary["approvalState"];
  review_comment: string | null;
  updated_at: number | null;
};

type BeneficiaryPackageAssignmentRow = {
  beneficiary_id: string;
  package_id: string;
  package_code: string;
  display_name: string;
  owner_type: BeneficiaryPackageAssignment["ownerType"];
};

type AssignablePackageRow = {
  package_id: string;
  package_code: string;
  display_name: string;
  owner_type: BeneficiaryPackageAssignment["ownerType"];
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
    approvalState?: Beneficiary["approvalState"];
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const clauses: string[] = [];
    const values: any[] = [];

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

    if (filters?.approvalState) {
      values.push(filters.approvalState);
      clauses.push(`approval_state = $${values.length}`);
    }

    if (filters?.search) {
      values.push(`%${filters.search.toLowerCase()}%`);
      clauses.push(`(lower(name) like $${values.length} or account_number like $${values.length})`);
    }

    const isPaginated = typeof filters?.page === "number" && typeof filters?.limit === "number";
    let totalCount = 0;
    const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";

    if (isPaginated) {
      const countRes = await this.db.query(`select count(*) from beneficiaries ${whereClause}`, values);
      totalCount = parseInt(countRes.rows[0].count, 10);
    }

    let queryText = `select beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                            account_number, ifsc, phone_number, type, category, tags, status,
                            approval_state, review_comment, updated_at
                     from beneficiaries
                     ${whereClause}
                     order by updated_at desc nulls last, beneficiary_id desc`;

    const queryParams = [...values];
    if (isPaginated) {
      const page = filters!.page!;
      const limit = filters!.limit!;
      const offset = (page - 1) * limit;
      queryParams.push(limit, offset);
      queryText += ` limit $${queryParams.length - 1} offset $${queryParams.length}`;
    }

    const result = await this.db.query<BeneficiaryRow>(queryText, queryParams);
    const items = await this.attachPackageAssignments(result.rows);

    if (isPaginated) {
      const limit = filters!.limit!;
      const page = filters!.page!;
      return {
        items,
        pagination: {
          page,
          limit,
          totalCount,
          hasMore: (page - 1) * limit + items.length < totalCount
        }
      };
    }

    return { items };
  }

  async getBeneficiary(beneficiaryId: string) {
    const result = await this.db.query<BeneficiaryRow>(
      `select beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
              account_number, ifsc, phone_number, type, category, tags, status,
              approval_state, review_comment, updated_at
       from beneficiaries
       where beneficiary_id = $1`,
      [beneficiaryId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [beneficiary] = await this.attachPackageAssignments([row]);
    return beneficiary ?? null;
  }

  async getBeneficiariesByIds(beneficiaryIds: string[]) {
    if (beneficiaryIds.length === 0) {
      return [];
    }
    const result = await this.db.query<BeneficiaryRow>(
      `select beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
              account_number, ifsc, phone_number, type, category, tags, status,
              approval_state, review_comment, updated_at
       from beneficiaries
       where beneficiary_id = any($1::text[])`,
      [beneficiaryIds]
    );

    return this.attachPackageAssignments(result.rows);
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

    const normalizedBeneficiaryId = payload.beneficiaryId.trim().toUpperCase();
    const duplicateById = await this.db.query<{ beneficiary_id: string }>(
      `select beneficiary_id
       from beneficiaries
       where beneficiary_id = $1
       limit 1`,
      [normalizedBeneficiaryId]
    );

    if (duplicateById.rows[0]) {
      return {
        error: "duplicate_beneficiary_id" as const,
        beneficiaryId: duplicateById.rows[0].beneficiary_id
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

    const assignablePackages = await this.resolveAssignablePackagesByCode({
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      packageCodes: payload.packageCodes
    });

    if ("error" in assignablePackages) {
      return assignablePackages;
    }

    const beneficiaryId = normalizedBeneficiaryId;
    const client = await this.db.connect();
    try {
      await client.query("begin");
      await client.query<BeneficiaryRow>(
        `insert into beneficiaries (
           beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
           account_number, ifsc, type, pan, gstin, phone_number, category, tags,
           status, approval_state, review_comment, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, null, null, $9, $10, $11,
                 'inactive', 'pending_approval', null, (extract(epoch from now()) * 1000)::bigint)`,
        [
          beneficiaryId,
          payload.bankTenantId,
          payload.corporateTenantId,
          payload.corporateId,
          payload.name,
          payload.accountNumber,
          payload.ifsc,
          payload.beneficiaryType,
          payload.phoneNumber,
          null,
          payload.tags
        ]
      );

      await this.replacePackageAssignments(beneficiaryId, assignablePackages, client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const created = await this.getBeneficiary(beneficiaryId);
    if (!created) {
      throw new Error("Beneficiary could not be loaded after creation");
    }

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
      beneficiaryId: payload.beneId,
      name: payload.beneName,
      accountNumber: payload.beneBankAccountNumber,
      ifsc: payload.beneIfscCode,
      phoneNumber: payload.benePhoneNumber,
      beneficiaryType: payload.beneType,
      packageCodes: payload.benePackageCodes,
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
           updated_at = (extract(epoch from now()) * 1000)::bigint
       where beneficiary_id = $1
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, type, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [beneficiaryId, nextApprovalState, nextStatus, payload.comment ?? null]
    );

    const updated = mapBeneficiaryRow(result.rows[0], existing.assignedPackages);
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
           updated_at = (extract(epoch from now()) * 1000)::bigint
       where beneficiary_id = $1
       returning beneficiary_id, bank_tenant_id, corporate_tenant_id, corporate_id, name,
                 account_number, ifsc, phone_number, type, category, tags, status,
                 approval_state, review_comment, updated_at`,
      [beneficiaryId, nextStatus, payload.comment ?? null]
    );

    return {
      data: mapBeneficiaryRow(result.rows[0], existing.assignedPackages)
    };
  }

  async updateBeneficiary(beneficiaryId: string, payload: BeneficiaryUpdateRequest) {
    const existing = await this.getBeneficiary(beneficiaryId);

    if (!existing) {
      return {
        error: "beneficiary_not_found" as const
      };
    }

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

    if (
      actor.corporateTenantId !== existing.corporateTenantId ||
      (existing.corporateId && actor.corporateId !== existing.corporateId)
    ) {
      return {
        error: "forbidden" as const
      };
    }

    const assignablePackages = await this.resolveAssignablePackagesByCode({
      bankTenantId: existing.bankTenantId,
      corporateTenantId: existing.corporateTenantId,
      corporateId: existing.corporateId ?? "",
      packageCodes: payload.packageCodes
    });

    if ("error" in assignablePackages) {
      return assignablePackages;
    }

    const client = await this.db.connect();
    try {
      await client.query("begin");
      await client.query<BeneficiaryRow>(
        `update beneficiaries
         set name = $2,
             account_number = $3,
             ifsc = $4,
             phone_number = $5,
             type = $6,
             category = null,
             tags = $7,
             status = 'inactive',
             approval_state = 'pending_approval',
             review_comment = null,
             updated_at = (extract(epoch from now()) * 1000)::bigint
         where beneficiary_id = $1`,
        [
          beneficiaryId,
          payload.name,
          payload.accountNumber,
          payload.ifsc,
          payload.phoneNumber,
          payload.beneficiaryType,
          payload.tags
        ]
      );

      await this.replacePackageAssignments(beneficiaryId, assignablePackages, client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    this.notificationsService.notifyPermissionRecipientsInBackground({
      corporateTenantId: existing.corporateTenantId,
      corporateId: existing.corporateId,
      permission: "beneficiary.checker",
      title: "Beneficiary approval pending",
      message: `${payload.name} was updated and is waiting for checker approval.`,
      targetSection: "approvals",
      entityType: "beneficiary",
      entityId: beneficiaryId
    });

    return {
      data: await this.getBeneficiary(beneficiaryId)
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

  private async attachPackageAssignments(rows: BeneficiaryRow[]) {
    if (rows.length === 0) {
      return [] as Beneficiary[];
    }

    const assignmentsByBeneficiary = await this.getPackageAssignmentsForBeneficiaries(
      rows.map((row) => row.beneficiary_id)
    );

    return rows.map((row) =>
      mapBeneficiaryRow(row, assignmentsByBeneficiary.get(row.beneficiary_id) ?? [])
    );
  }

  private async getPackageAssignmentsForBeneficiaries(beneficiaryIds: string[]) {
    const result = await this.db.query<BeneficiaryPackageAssignmentRow>(
      `select bpa.beneficiary_id, bpa.package_id, p.package_code, p.name as display_name, p.owner_type
       from beneficiary_package_assignments bpa
       join packages p on p.package_id = bpa.package_id
       where bpa.beneficiary_id = any($1::text[])
       order by p.package_code`,
      [beneficiaryIds]
    );

    const assignmentsByBeneficiary = new Map<string, BeneficiaryPackageAssignment[]>();

    for (const row of result.rows) {
      const items = assignmentsByBeneficiary.get(row.beneficiary_id) ?? [];
      items.push({
        packageId: row.package_id,
        packageCode: row.package_code,
        displayName: row.display_name,
        ownerType: row.owner_type
      });
      assignmentsByBeneficiary.set(row.beneficiary_id, items);
    }

    return assignmentsByBeneficiary;
  }

  private async resolveAssignablePackagesByCode(input: {
    bankTenantId: string;
    corporateTenantId: string;
    corporateId: string;
    packageCodes: string[];
  }) {
    const normalizedPackageCodes = [...new Set(input.packageCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];

    const result = await this.db.query<AssignablePackageRow>(
      `select distinct cs.package_id, cs.package_code, cs.display_name, p.owner_type
       from corporate_subscriptions cs
       join packages p on p.package_id = cs.package_id
       where cs.bank_tenant_id = $1
         and cs.corporate_tenant_id = $2
         and cs.corporate_id = $3
         and cs.status = 'active'
         and cs.package_code = any($4::text[])
       order by cs.package_code`,
      [
        input.bankTenantId,
        input.corporateTenantId,
        input.corporateId,
        normalizedPackageCodes
      ]
    );

    if (result.rows.length !== normalizedPackageCodes.length) {
      const resolvedCodes = new Set(result.rows.map((row) => row.package_code));
      return {
        error: "invalid_package_assignments" as const,
        packageCodes: normalizedPackageCodes.filter((code) => !resolvedCodes.has(code))
      };
    }

    return result.rows;
  }

  private async replacePackageAssignments(
    beneficiaryId: string,
    packages: AssignablePackageRow[],
    executor: DatabaseExecutor
  ) {
    await executor.query(
      `delete from beneficiary_package_assignments where beneficiary_id = $1`,
      [beneficiaryId]
    );

    for (const packageRow of packages) {
      await executor.query(
        `insert into beneficiary_package_assignments (beneficiary_id, package_id, created_at)
         values ($1, $2, (extract(epoch from now()) * 1000)::bigint)`,
        [beneficiaryId, packageRow.package_id]
      );
    }
  }
}

function mapBeneficiaryRow(
  row: BeneficiaryRow,
  assignedPackages: BeneficiaryPackageAssignment[]
) {
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
    beneficiaryType: row.type,
    assignedPackages,
    tags: row.tags ?? [],
    status: row.status,
    approvalState: row.approval_state,
    reviewComment: row.review_comment,
    lastUpdatedAt: row.updated_at
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
