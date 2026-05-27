import { z } from "zod";

export const paymentMethodStatusSchema = z.enum(["active", "inactive"]);
export const packageStatusSchema = z.enum(["active", "inactive"]);
const packageOwnerTypeSchema = z.enum(["bank", "corporate"]);
const packageCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const packageUseCaseSchema = z.enum(["vendor_payments", "salary", "statutory"]);
const beneficiaryTypeSchema = z.enum(["vendor", "employee", "statutory"]);
const debitModeSchema = z.enum(["single", "multi"]);
const fileRejectionModeSchema = z.enum(["fail_full_file", "reject_invalid_rows"]);
export const paymentMethodCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/);
export const paymentMethodCreateSchema = z
  .object({
    paymentMethodCode: paymentMethodCodeSchema,
    displayName: z.string().trim().min(2),
    name: z.string().trim().min(2).optional(),
    minAmount: z.number().int().nonnegative().nullable().optional(),
    maxAmount: z.number().int().positive().nullable().optional(),
    cutoffTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  })
  .refine(
    (value) =>
      value.minAmount == null || value.maxAmount == null || value.maxAmount >= value.minAmount,
    {
      message: "maxAmount must be greater than or equal to minAmount",
      path: ["maxAmount"]
    }
  );
const packageOwnerTypeInputSchema = packageOwnerTypeSchema.optional().default("corporate");

export const packageCreateSchema = z
  .object({
    ownerType: packageOwnerTypeInputSchema,
    bankTenantId: z.string().trim().min(2),
    corporateTenantId: z.string().trim().min(2).nullable().optional(),
    corporateId: z.string().trim().min(2).nullable().optional(),
    basePackageCode: z.string().trim().min(2).nullable().optional(),
    packageCode: packageCodeSchema,
    displayName: z.string().trim().min(2),
    description: z.string().trim().max(500).nullable().optional(),
    useCase: packageUseCaseSchema,
    allowedBeneficiaryTypes: z.array(beneficiaryTypeSchema).min(1),
    bulkApproveEnabled: z.boolean().optional().default(false),
    debitModesAllowed: z.array(debitModeSchema).min(1),
    defaultDebitMode: debitModeSchema.optional(),
    fileRejectionModesAllowed: z.array(fileRejectionModeSchema).min(1),
    defaultFileRejectionMode: fileRejectionModeSchema.optional(),
    maxPaymentsPerBatch: z.number().int().positive(),
    pricingDefaults: z
      .object({
        platformFee: z.string().trim().min(1).default("0")
      })
      .default({ platformFee: "0" }),
    paymentMethodCodes: z.array(paymentMethodCodeSchema).min(1),
    defaultPaymentMethodCode: paymentMethodCodeSchema,
    debitAccountIds: z.array(z.string().min(1)).optional().default([]),
    defaultDebitAccountId: z.string().min(1).nullable().optional(),
    status: packageStatusSchema.optional().default("active")
  })
  .refine(
    (value) =>
      value.ownerType === "bank" ||
      (Boolean(value.corporateTenantId) && Boolean(value.corporateId)),
    {
      message: "corporateTenantId and corporateId are required for corporate-owned packages",
      path: ["corporateId"]
    }
  )
  .refine(
    (value) => value.paymentMethodCodes.includes(value.defaultPaymentMethodCode),
    {
      message: "defaultPaymentMethodCode must be one of the allowed payment methods",
      path: ["defaultPaymentMethodCode"]
    }
  )
  .refine(
    (value) =>
      !value.defaultDebitAccountId ||
      value.debitAccountIds.includes(value.defaultDebitAccountId),
    {
      message: "defaultDebitAccountId must be one of the allowed debit accounts",
      path: ["defaultDebitAccountId"]
    }
  );
export const packageUpdateSchema = z
  .object({
    ownerType: packageOwnerTypeInputSchema,
    bankTenantId: z.string().trim().min(2),
    corporateTenantId: z.string().trim().min(2).nullable().optional(),
    corporateId: z.string().trim().min(2).nullable().optional(),
    basePackageCode: z.string().trim().min(2).nullable().optional(),
    displayName: z.string().trim().min(2),
    description: z.string().trim().max(500).nullable().optional(),
    useCase: packageUseCaseSchema,
    allowedBeneficiaryTypes: z.array(beneficiaryTypeSchema).min(1),
    bulkApproveEnabled: z.boolean().optional().default(false),
    debitModesAllowed: z.array(debitModeSchema).min(1),
    defaultDebitMode: debitModeSchema.optional(),
    fileRejectionModesAllowed: z.array(fileRejectionModeSchema).min(1),
    defaultFileRejectionMode: fileRejectionModeSchema.optional(),
    maxPaymentsPerBatch: z.number().int().positive(),
    pricingDefaults: z
      .object({
        platformFee: z.string().trim().min(1).default("0")
      })
      .default({ platformFee: "0" }),
    paymentMethodCodes: z.array(paymentMethodCodeSchema).min(1),
    defaultPaymentMethodCode: paymentMethodCodeSchema,
    debitAccountIds: z.array(z.string().min(1)).optional().default([]),
    defaultDebitAccountId: z.string().min(1).nullable().optional(),
    status: packageStatusSchema
  })
  .refine(
    (value) =>
      value.ownerType === "bank" ||
      (Boolean(value.corporateTenantId) && Boolean(value.corporateId)),
    {
      message: "corporateTenantId and corporateId are required for corporate-owned packages",
      path: ["corporateId"]
    }
  )
  .refine(
    (value) => value.paymentMethodCodes.includes(value.defaultPaymentMethodCode),
    {
      message: "defaultPaymentMethodCode must be one of the allowed payment methods",
      path: ["defaultPaymentMethodCode"]
    }
  )
  .refine(
    (value) =>
      !value.defaultDebitAccountId ||
      value.debitAccountIds.includes(value.defaultDebitAccountId),
    {
      message: "defaultDebitAccountId must be one of the allowed debit accounts",
      path: ["defaultDebitAccountId"]
    }
  );
export const paymentMethodUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2),
    name: z.string().trim().min(2).optional(),
    minAmount: z.number().int().nonnegative().nullable().optional(),
    maxAmount: z.number().int().positive().nullable().optional(),
    cutoffTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    status: paymentMethodStatusSchema
  })
  .refine(
    (value) =>
      value.minAmount == null || value.maxAmount == null || value.maxAmount >= value.minAmount,
    {
      message: "maxAmount must be greater than or equal to minAmount",
      path: ["maxAmount"]
    }
  );

export type PaymentMethod = {
  paymentMethodCode: string;
  displayName: string;
  name: string;
  railFamily: string;
  settlementMode: "real_time" | "batch";
  weekendSupport: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  cutoffTime: string;
  status: z.infer<typeof paymentMethodStatusSchema>;
  createdAt: number | null;
  updatedAt: number | null;
};

export type PackagePaymentMethod = {
  paymentMethodCode: string;
  minAmountOverride: number | null;
  maxAmountOverride: number | null;
  pricingOverrides: Record<string, unknown>;
};

export type PackageCatalogEntry = {
  packageId: string;
  ownerType: z.infer<typeof packageOwnerTypeSchema>;
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
  status: z.infer<typeof packageStatusSchema>;
  paymentMethods: PackagePaymentMethod[];
  createdAt: number | null;
  updatedAt: number | null;
};

export type PaymentMethodCreateRequest = z.infer<typeof paymentMethodCreateSchema>;
export type PaymentMethodUpdateRequest = z.infer<typeof paymentMethodUpdateSchema>;
export type PackageCreateRequest = z.infer<typeof packageCreateSchema>;
export type PackageUpdateRequest = z.infer<typeof packageUpdateSchema>;
