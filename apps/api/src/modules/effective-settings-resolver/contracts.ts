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
