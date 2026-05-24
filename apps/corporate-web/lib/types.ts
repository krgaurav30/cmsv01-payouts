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
  name: string;
  corporateTenantId: string;
  subscriptionId: string | null;
  packageCode: string | null;
  packageDisplayName: string | null;
  debitAccountIds: string[];
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
  createdAt?: string | null;
  assignedPackages: BeneficiaryPackageAssignment[];
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
  sourceUploadId?: string | null;
  subscriptionId?: string | null;
  debitAccountId?: string | null;
  paymentMethodCode?: string | null;
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
  utr?: string | null;
  narration?: string | null;
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
  packageCode?: string | null;
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

export type CorporateDebitAccount = {
  debitAccountId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  isDefault: boolean;
  status: "active" | "inactive";
  balance: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PackagePaymentMethod = {
  paymentMethodCode: string;
  minAmountOverride: number | null;
  maxAmountOverride: number | null;
  pricingOverrides: Record<string, unknown>;
};

export type PackageCatalogEntry = {
  packageId: string;
  ownerType: "bank" | "corporate";
  bankTenantId: string;
  corporateTenantId: string | null;
  corporateId: string | null;
  basePackageCode: string | null;
  packageCode: string;
  name: string;
  useCase: string;
  description: string | null;
  allowedBeneficiaryTypes: string[];
  bulkApproveEnabled: boolean;
  debitModesAllowed: string[];
  defaultDebitMode: string;
  fileRejectionModesAllowed: string[];
  defaultFileRejectionMode: string;
  defaultPaymentMethodCode: string | null;
  debitAccountIds: string[];
  defaultDebitAccountId: string | null;
  maxPaymentsPerBatch: number;
  pricingDefaults: Record<string, unknown>;
  status: "active" | "inactive";
  paymentMethods: PackagePaymentMethod[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubscriptionDebitAccountAccess = {
  debitAccountId: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  allowedPaymentMethodCodes: string[];
  isDefault: boolean;
  status: "active" | "inactive";
};

export type SubscriptionUserAccess = {
  accessId: string;
  userId: string;
  username: string;
  displayName: string;
  roleName: string;
  status: "active" | "inactive";
};

export type CorporateSubscription = {
  subscriptionId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  packageId: string;
  packageCode: string;
  displayName: string;
  status: "draft" | "active" | "suspended" | "terminated";
  startedAt: string | null;
  suspendedAt: string | null;
  terminatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  debitAccounts: SubscriptionDebitAccountAccess[];
  userAccess: SubscriptionUserAccess[];
};

export type EffectivePackagePaymentMethod = {
  paymentMethodCode: string;
  minAmount: number | null;
  maxAmount: number | null;
  pricing: Record<string, unknown>;
};

export type EffectiveSettingsSnapshot = {
  subscriptionId: string;
  corporateId: string;
  corporateTenantId: string;
  bankTenantId: string;
  packageId: string;
  packageCode: string;
  subscriptionStatus: string;
  allowedBeneficiaryTypes: string[];
  bulkApproveEnabled: boolean;
  debitModesAllowed: string[];
  defaultDebitMode: string;
  effectiveDebitMode: string;
  fileRejectionModesAllowed: string[];
  defaultFileRejectionMode: string;
  effectiveFileRejectionMode: string;
  maxPaymentsPerBatch: number;
  paymentMethods: EffectivePackagePaymentMethod[];
  defaultPaymentMethodCode: string | null;
  defaultDebitAccountId: string | null;
  activeOverrideKeys: string[];
};

export type ActiveSubscriptionContext = {
  subscription: CorporateSubscription;
  effectiveSettings: EffectiveSettingsSnapshot | null;
};

export type BeneficiaryPackageAssignment = {
  packageId: string;
  packageCode: string;
  displayName: string;
  ownerType: "bank" | "corporate";
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
  debitAccounts: CorporateDebitAccount[];
  subscriptions: CorporateSubscription[];
  activeSubscription: ActiveSubscriptionContext | null;
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
