import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "@cmsv01/shared/config";

import { PartnerApiKeyService } from "../partner-api-keys/service.js";

import {
  payoutDispatchSchema,
  payoutApprovalActionSchema,
  payoutBatchCreateSchema,
  payoutBulkCreateSchema,
  payoutFileUploadCreateSchema,
  publishedPayoutApprovalSchema,
  publishedPayoutCreateSchema,
  payoutRefundCreateSchema,
  payoutSimulationSchema
} from "./contracts.js";
import { PayoutManagementService } from "./service.js";

export const payoutManagementRoutes: FastifyPluginAsync = async (app) => {
  const payoutManagementService = new PayoutManagementService();
  const config = loadConfig();
  const partnerApiKeyService = new PartnerApiKeyService(config);

  app.get("/v1/payouts/health", async () => {
    return {
      module: "payout-management",
      status: "ready"
    };
  });

  app.get("/v1/payouts/batches", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      bankTenantId?: string;
      corporateId?: string;
      subscriptionId?: string;
      packageCode?: string;
      state?: string;
      search?: string;
    };

    return {
      items: await payoutManagementService.listBatches({
        corporateTenantId: query.corporateTenantId,
        bankTenantId: query.bankTenantId,
        corporateId: query.corporateId,
        subscriptionId: query.subscriptionId,
        packageCode: query.packageCode,
        state: query.state,
        search: query.search
      })
    };
  });

  app.get("/v1/payouts/batches/:batchId", async (request, reply) => {
    const params = request.params as { batchId: string };
    const batch = await payoutManagementService.getBatch(params.batchId);

    if (!batch) {
      return reply.status(404).send({
        message: "Payout batch not found"
      });
    }

    return batch;
  });

  app.post("/v1/payouts/batches", async (request, reply) => {
    const parsed = payoutBatchCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payout batch payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.createBatch(parsed.data);

    if (!("data" in result)) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can create payout transactions"
        });
      }

      if (result.error === "beneficiary_not_found") {
        return reply.status(404).send({
          message: `Beneficiary not found: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_not_approved") {
        return reply.status(409).send({
          message: `Beneficiary is still waiting for checker approval: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_inactive") {
        return reply.status(409).send({
          message: `Beneficiary is inactive and cannot be used for payout creation: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_package_not_assigned") {
        return reply.status(409).send({
          message: `Beneficiary ${result.beneficiaryId} is not assigned to package ${result.packageCode}`
        });
      }

      if (result.error === "beneficiary_corporate_mismatch") {
        return reply.status(409).send({
          message: `Beneficiary does not belong to the selected child corporate: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_type_not_allowed") {
        return reply.status(409).send({
          message: `Beneficiary type ${result.beneficiaryType} is not allowed for package ${result.packageCode ?? "this selection"}`
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      if (result.error === "duplicate_transaction_reference") {
        return reply.status(409).send({
          message: `Transaction reference already exists and was processed earlier: ${result.transactionReference}`,
          existingState: result.existingState
        });
      }

      if (result.error === "subscription_not_found") {
        return reply.status(404).send({
          message: "No active package subscription was found for this transaction context"
        });
      }

      if (result.error === "subscription_scope_mismatch") {
        return reply.status(409).send({
          message: "The selected package subscription does not belong to this corporate context"
        });
      }

      if (result.error === "single_transaction_limit_exceeded") {
        return reply.status(409).send({
          message: `This transaction exceeds the single transaction limit of INR ${result.limit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          limit: result.limit
        });
      }

      if (result.error === "daily_cumulative_limit_exceeded") {
        return reply.status(409).send({
          message: `This transaction would exceed the daily cumulative transaction limit of INR ${result.limit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          limit: result.limit,
          currentTotal: result.currentTotal
        });
      }

      if (result.error === "payment_method_required") {
        return reply.status(409).send({
          message: `Select a payment method. Allowed methods: ${result.allowedPaymentMethodCodes.join(", ")}`
        });
      }

      if (result.error === "payment_method_not_allowed") {
        return reply.status(409).send({
          message: `Payment method ${result.paymentMethodCode} is not allowed for the selected package`
        });
      }

      if (result.error === "payment_method_amount_out_of_range") {
        return reply.status(409).send({
          message: `This amount is outside the allowed range for ${result.paymentMethodCode}`,
          paymentMethodCode: result.paymentMethodCode,
          minAmount: result.minAmount,
          maxAmount: result.maxAmount,
          amount: result.amount
        });
      }

      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/payouts/transactions", async (request, reply) => {
    const parsed = payoutBatchCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payout transaction payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.createAndSubmitBatch(parsed.data);

    if (!("data" in result)) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can create payout transactions"
        });
      }

      if (result.error === "beneficiary_not_found") {
        return reply.status(404).send({
          message: `Beneficiary not found: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_not_approved") {
        return reply.status(409).send({
          message: `Beneficiary is still waiting for checker approval: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_inactive") {
        return reply.status(409).send({
          message: `Beneficiary is inactive and cannot be used for payout creation: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_package_not_assigned") {
        return reply.status(409).send({
          message: `Beneficiary ${result.beneficiaryId} is not assigned to package ${result.packageCode}`
        });
      }

      if (result.error === "beneficiary_corporate_mismatch") {
        return reply.status(409).send({
          message: `Beneficiary does not belong to the selected child corporate: ${result.beneficiaryId}`
        });
      }

      if (result.error === "beneficiary_type_not_allowed") {
        return reply.status(409).send({
          message: `Beneficiary type ${result.beneficiaryType} is not allowed for package ${result.packageCode ?? "this selection"}`
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      if (result.error === "duplicate_transaction_reference") {
        return reply.status(409).send({
          message: `Transaction reference already exists and was processed earlier: ${result.transactionReference}`,
          existingState: result.existingState
        });
      }

      if (result.error === "subscription_not_found") {
        return reply.status(404).send({
          message: "No active package subscription was found for this transaction context"
        });
      }

      if (result.error === "subscription_scope_mismatch") {
        return reply.status(409).send({
          message: "The selected package subscription does not belong to this corporate context"
        });
      }

      if (result.error === "single_transaction_limit_exceeded") {
        return reply.status(409).send({
          message: `This transaction exceeds the single transaction limit of INR ${result.limit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          limit: result.limit
        });
      }

      if (result.error === "daily_cumulative_limit_exceeded") {
        return reply.status(409).send({
          message: `This transaction would exceed the daily cumulative transaction limit of INR ${result.limit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          limit: result.limit,
          currentTotal: result.currentTotal
        });
      }

      if (result.error === "payment_method_required") {
        return reply.status(409).send({
          message: `Select a payment method. Allowed methods: ${result.allowedPaymentMethodCodes.join(", ")}`
        });
      }

      if (result.error === "payment_method_not_allowed") {
        return reply.status(409).send({
          message: `Payment method ${result.paymentMethodCode} is not allowed for the selected package`
        });
      }

      if (result.error === "payment_method_amount_out_of_range") {
        return reply.status(409).send({
          message: `This amount is outside the allowed range for ${result.paymentMethodCode}`,
          paymentMethodCode: result.paymentMethodCode,
          minAmount: result.minAmount,
          maxAmount: result.maxAmount,
          amount: result.amount
        });
      }

      if (result.error === "debit_account_required") {
        return reply.status(409).send({
          message: "No debit account is available for this role and package"
        });
      }

      if (result.error === "debit_account_not_allowed") {
        return reply.status(409).send({
          message: `Debit account is not allowed for this role and package: ${result.debitAccountId}`
        });
      }

      if (result.error === "default_debit_account_not_configured") {
        return reply.status(409).send({
          message: "A default debit account is not configured for this package"
        });
      }

      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/payouts/batches/bulk", async (request, reply) => {
    const parsed = payoutBulkCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid bulk payout payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.createBulkBatches(parsed.data);

    if (!("data" in result)) {
      if (result.error === "duplicate_file_name") {
        return reply.status(409).send({
          message: `A file with this name was already uploaded earlier: ${result.fileName}`,
          fileUpload: result.fileUpload ?? null
        });
      }

      if (result.error === "bulk_upload_row_limit_exceeded") {
        return reply.status(409).send({
          message: `This file exceeds the maximum allowed rows for bulk upload: ${result.limit}`,
          limit: result.limit,
          fileUpload: result.fileUpload ?? null
        });
      }

      if (result.error === "subscription_not_found") {
        return reply.status(404).send({
          message: "No active package subscription was found for this file upload context"
        });
      }

      if (result.error === "subscription_scope_mismatch") {
        return reply.status(409).send({
          message: "The selected package subscription does not belong to this corporate context"
        });
      }

      return reply.status(403).send({
        message: "Only an approved transaction maker can upload bulk transactions"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/payouts/file-uploads/accept", async (request, reply) => {
    const parsed = payoutBulkCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid bulk payout payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.acceptBulkFileUpload(parsed.data);

    if (!("data" in result)) {
      if (result.error === "duplicate_file_name") {
        return reply.status(409).send({
          message: `A file with this name was already uploaded earlier: ${result.fileName}`,
          fileUpload: result.fileUpload ?? null
        });
      }

      if (result.error === "bulk_upload_row_limit_exceeded") {
        return reply.status(409).send({
          message: `This file exceeds the maximum allowed rows for bulk upload: ${result.limit}`,
          limit: result.limit,
          fileUpload: result.fileUpload ?? null
        });
      }

      if (result.error === "subscription_not_found") {
        return reply.status(404).send({
          message: "No active package subscription was found for this file upload context"
        });
      }

      if (result.error === "subscription_scope_mismatch") {
        return reply.status(409).send({
          message: "The selected package subscription does not belong to this corporate context"
        });
      }

      return reply.status(403).send({
        message: "Only an approved transaction maker can upload bulk transactions"
      });
    }

    return reply.status(202).send({
      message: "File accepted for background processing",
      ...result.data
    });
  });

  app.post("/v1/payouts/file-uploads/:uploadId/process", async (request, reply) => {
    const params = request.params as { uploadId: string };
    const result = await payoutManagementService.processAcceptedFileUpload(params.uploadId);

    return reply.status(202).send({
      message: "File upload processing completed",
      result: result ?? null
    });
  });

  app.get("/v1/payouts/file-uploads", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      corporateId?: string;
      bankTenantId?: string;
      subscriptionId?: string;
      packageCode?: string;
    };

    return {
      items: await payoutManagementService.listFileUploads({
        corporateTenantId: query.corporateTenantId,
        corporateId: query.corporateId,
        bankTenantId: query.bankTenantId,
        subscriptionId: query.subscriptionId,
        packageCode: query.packageCode
      })
    };
  });

  app.get("/v1/payouts/file-uploads/:uploadId/batches", async (request, reply) => {
    const params = request.params as { uploadId: string };
    const upload = await payoutManagementService.getFileUpload(params.uploadId);

    if (!upload) {
      return reply.status(404).send({
        message: "Payout file upload not found"
      });
    }

    return {
      items: await payoutManagementService.listBatchesBySourceUpload(params.uploadId)
    };
  });

  app.post("/v1/payouts/file-uploads", async (request, reply) => {
    const parsed = payoutFileUploadCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid file upload record payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.recordFileUpload(parsed.data);

    if (!("data" in result)) {
      return reply.status(403).send({
        message: "Only a signed-in corporate user can record file uploads"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post("/v1/payouts/file-uploads/:uploadId/actions", async (request, reply) => {
    const params = request.params as { uploadId: string };
    const parsed = payoutApprovalActionSchema.safeParse(request.body);

    if (!parsed.success || parsed.data.action === "submit") {
      return reply.status(400).send({
        message: "Invalid bulk file approval payload",
        issues: parsed.success ? undefined : parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.applyFileUploadApprovalAction(
      params.uploadId,
      parsed.data
    );

    if (!("data" in result)) {
      if (result.error === "upload_not_found") {
        return reply.status(404).send({
          message: "Payout file upload not found"
        });
      }

      if (result.error === "no_actionable_batches") {
        return reply.status(409).send({
          message: "No transactions in this file are waiting for approval"
        });
      }

      return reply.status(409).send({
        message: "The file approval action could not be completed"
      });
    }

    return result.data;
  });

  app.post("/v1/partner/payments/transactions", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const parsed = publishedPayoutCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid transaction API payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.createPublishedTransaction(parsed.data);

    if (!("data" in result)) {
      if (result.error === "actor_not_found") {
        return reply.status(404).send({
          message: "Actor username not found"
        });
      }

      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can create transactions through this API"
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(202).send({
      message: "Transaction accepted for background processing",
      command: result.data
    });
  });

  app.post("/v1/payouts/commands/:commandId/process", async (request, reply) => {
    const params = request.params as { commandId: string };
    const result = await payoutManagementService.processAcceptedTransactionCommand(
      params.commandId
    );

    return reply.status(202).send({
      message: "Transaction command processing completed",
      result: result ?? null
    });
  });

  app.get("/v1/partner/payments/transactions/:batchId/status", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const params = request.params as { batchId: string };
    const batch = await payoutManagementService.getBatch(params.batchId);

    if (!batch) {
      return reply.status(404).send({
        message: "Transaction not found"
      });
    }

    return {
      message: "Transaction status fetched successfully",
      transaction: {
        batchId: batch.batchId,
        transactionReference: batch.title,
        state: batch.state,
        amount: batch.totalAmount,
        beneficiaryId: batch.primaryBeneficiaryId,
        beneficiaryName: batch.primaryBeneficiaryName,
        approvalLevelsRequired: batch.approvalLevelsRequired,
        currentApprovalLevel: batch.currentApprovalLevel,
        approvalRoles: batch.approvalRoles,
        bankReference: batch.bankReference,
        failureReason: batch.failureReason,
        createdAt: batch.createdAt,
        submittedAt: batch.submittedAt,
        approvedAt: batch.approvedAt,
        rejectedAt: batch.rejectedAt,
        sentToBankAt: batch.dispatchedAt,
        paidAt: batch.completedAt
      }
    };
  });

  app.post("/v1/payouts/batches/:batchId/actions", async (request, reply) => {
    const params = request.params as { batchId: string };
    const parsed = payoutApprovalActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payout approval payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.applyApprovalAction(
      params.batchId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message:
            parsed.data.action === "submit"
              ? "Only an approved maker can submit payout transactions"
              : "Only an approved checker can approve or reject payout transactions"
        });
      }

      if (result.error === "batch_not_found") {
        return reply.status(404).send({
          message: "Payout batch not found"
        });
      }

      if (result.error === "approval_action_in_progress") {
        return reply.status(409).send({
          message:
            "An action is already in progress by another user, please recheck the status after sometime"
        });
      }

      return reply.status(409).send({
        message: "Invalid payout state transition",
        currentState: result.currentState
      });
    }

    return result.data;
  });

  app.post("/v1/partner/payments/transactions/:batchId/authorize", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const params = request.params as { batchId: string };
    const parsed = publishedPayoutApprovalSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid transaction authorization payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.authorizePublishedTransaction(
      params.batchId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "actor_not_found") {
        return reply.status(404).send({
          message: "Actor username not found"
        });
      }

      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved checker can authorize transactions through this API"
        });
      }

      if (result.error === "batch_not_found") {
        return reply.status(404).send({
          message: "Transaction not found"
        });
      }

      if (result.error === "approval_action_in_progress") {
        return reply.status(409).send({
          message:
            "An action is already in progress by another user, please recheck the status after sometime"
        });
      }

      return reply.status(409).send({
        message: "Invalid transaction state transition",
        currentState: result.currentState
      });
    }

    return {
      message: "Transaction authorization applied",
      transaction: result.data
    };
  });

  app.post("/v1/payouts/batches/:batchId/dispatch", async (request, reply) => {
    const params = request.params as { batchId: string };
    const parsed = payoutDispatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payout dispatch payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.dispatchBatch(params.batchId, parsed.data);

    if ("error" in result) {
      if (result.error === "batch_not_found") {
        return reply.status(404).send({
          message: "Payout batch not found"
        });
      }

      return reply.status(409).send({
        message: "Payout batch cannot be dispatched from its current state",
        currentState: result.currentState
      });
    }

    return result.data;
  });

  app.post(
    "/v1/payouts/batches/:batchId/simulate-bank-response",
    async (request, reply) => {
      const params = request.params as { batchId: string };
      const parsed = payoutSimulationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid payout simulation payload",
          issues: parsed.error.flatten()
        });
      }

      const result = await payoutManagementService.simulateBankResponse(
        params.batchId,
        parsed.data
      );

      if ("error" in result) {
        if (result.error === "batch_not_found") {
          return reply.status(404).send({
            message: "Payout batch not found"
          });
        }

        return reply.status(409).send({
          message:
            "Mock bank response cannot be simulated from the payout batch's current state",
          currentState: result.currentState
        });
      }

      return result.data;
    }
  );

  app.get("/v1/payouts/refunds", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      batchId?: string;
      corporateId?: string;
      subscriptionId?: string;
      packageCode?: string;
    };

    return {
      items: await payoutManagementService.listRefunds({
        corporateTenantId: query.corporateTenantId,
        batchId: query.batchId,
        corporateId: query.corporateId,
        subscriptionId: query.subscriptionId,
        packageCode: query.packageCode
      })
    };
  });

  app.post("/v1/payouts/refunds", async (request, reply) => {
    const parsed = payoutRefundCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid payout refund payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await payoutManagementService.createRefund(parsed.data);

    if ("error" in result) {
      if (result.error === "batch_not_found") {
        return reply.status(404).send({
          message: "Linked payout batch not found"
        });
      }

      if (result.error === "batch_corporate_mismatch") {
        return reply.status(409).send({
          message: "The selected payout batch does not belong to this child corporate context"
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      if (result.error === "batch_not_refundable") {
        return reply.status(409).send({
          message: "Only paid or failed payout batches can be refunded",
          currentState: result.currentState
        });
      }

      if (result.error === "refund_amount_exceeds_batch") {
        return reply.status(409).send({
          message: "Refund amount cannot exceed the payout batch amount",
          batchAmount: result.batchAmount
        });
      }

      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });
};
