export type CorporatePermission =
  | "transaction.make"
  | "transaction.checker"
  | "beneficiary.make"
  | "beneficiary.checker"
  | "roles.make"
  | "roles.checker"
  | "user.make"
  | "user.checker"
  | "devportal.view"
  | "devportal.edit"
  | "settings.view"
  | "settings.edit";

export type CorporateSession = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  tenantScope: "corporate";
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  status: "active";
  permissions: CorporatePermission[];
};

export type LoginResponse = {
  message: string;
  authMode: string;
  databaseConfigured: boolean;
  session: CorporateSession;
};

export type BankTenant = {
  tenantId: string;
  name: string;
};

export type CorporateTenant = {
  tenantId: string;
  bankTenantId: string;
  name: string;
  status: string;
};

export type CorporateTenantSettings = {
  corporateTenantId: string;
  companyDisplayName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  registeredAddress: string | null;
  defaultApprovalNoteTemplate: string | null;
  maxSingleTransactionAmount: number;
  maxDailyCumulativeTransactionAmount: number;
  maxBulkUploadRows: number;
  duplicateReferencePolicy: "enabled" | "disabled";
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByRole: string | null;
};

export type ApprovalMatrix = {
  matrixId: string;
  corporateTenantId: string;
  entityType: "transaction";
  amountFrom: number;
  amountTo: number;
  approvalLevels: 1 | 2 | 3;
  roles: string[];
  status: "active" | "inactive";
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Corporate = {
  corporateId: string;
  corporateTenantId: string;
  bankTenantId: string;
  name: string;
  status: string;
};

export type Beneficiary = {
  beneficiaryId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  name: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  phoneNumber: string | null;
  category: string | null;
  tags: string[];
  status: "active" | "inactive";
  approvalState: "pending_approval" | "approved" | "rejected";
  reviewComment: string | null;
  lastUpdatedAt: string | null;
};

export type PayoutTimelineEvent = {
  event: "created" | "submitted" | "approved" | "rejected";
  role: string | null;
  userId: string | null;
  userName: string | null;
  at: string | null;
};

export type Money = {
  value: number;
  currency: "INR";
};

export type PayoutBatchState =
  | "draft"
  | "pending_approval"
  | "partially_approved"
  | "approved"
  | "rejected"
  | "sent_to_bank"
  | "paid"
  | "failed";

export type PayoutItemState = "pending" | "sent_to_bank" | "processed" | "failed";

export type PayoutItem = {
  itemId: string;
  beneficiaryId: string;
  amount: Money;
  purpose: string;
  state: PayoutItemState;
  bankReference: string | null;
  failureReason: string | null;
  processedAt: string | null;
};

export type PayoutBatch = {
  batchId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  primaryBeneficiaryId: string | null;
  primaryBeneficiaryName: string | null;
  createdByUserId: string;
  createdByRole: string | null;
  title: string;
  tag: string | null;
  remark: string | null;
  state: PayoutBatchState;
  totalAmount: Money;
  approvalComment: string | null;
  bankReference: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  submittedByUserId: string | null;
  submittedByRole: string | null;
  approvedByUserId: string | null;
  approvedByRole: string | null;
  rejectedByUserId: string | null;
  rejectedByRole: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  approvalLevelsRequired: number | null;
  currentApprovalLevel: number | null;
  approvalRoles: string[];
  matchedApprovalMatrixIds: string[];
  timeline: PayoutTimelineEvent[];
  items: PayoutItem[];
};

export type PayoutFileUpload = {
  uploadId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  fileName: string;
  uploadedByUserId: string;
  uploadedByRole: string | null;
  uploadedByName: string | null;
  status: "processing" | "successful" | "partially_successful" | "failed" | "rejected";
  remark: string | null;
  totalRows: number;
  createdCount: number;
  rejectedCount: number;
  uploadedAt: string | null;
};

export type CorporateRole = {
  roleId: string;
  corporateTenantId: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  permissions: CorporatePermission[];
  approvalState: "pending_approval" | "approved" | "rejected";
  reviewComment: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByRole: string | null;
};

export type CorporateUser = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string | null;
  status: "active" | "inactive";
  approvalState: "pending_approval" | "approved" | "rejected";
  reviewComment: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByRole: string | null;
};

export type OperationsInitialData = {
  selectedCorporateId: string;
  bankTenants: BankTenant[];
  corporateTenants: CorporateTenant[];
  corporates: Corporate[];
  beneficiaries: Beneficiary[];
  transactions: PayoutBatch[];
  fileUploads: PayoutFileUpload[];
  approvalMatrices: ApprovalMatrix[];
  roles: CorporateRole[];
  users: CorporateUser[];
  settings: CorporateTenantSettings | null;
};

export type Notification = {
  notificationId: string;
  corporateTenantId: string;
  corporateId: string | null;
  recipientUserId: string;
  title: string;
  message: string;
  targetSection:
    | "home"
    | "transactions"
    | "file-uploads"
    | "beneficiaries"
    | "approvals"
    | "approval-matrices"
    | "roles"
    | "users"
    | "devportal"
    | "reports"
    | "audit"
    | "settings";
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string | null;
};
