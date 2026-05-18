import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "@cmsv01/shared/config";

import { PartnerApiKeyService } from "../partner-api-keys/service.js";

import {
  beneficiaryApprovalActionSchema,
  beneficiaryCreateSchema,
  publishedBeneficiaryApprovalSchema,
  publishedBeneficiaryCreateSchema,
  beneficiaryStatusActionSchema,
  beneficiaryUpdateSchema
} from "./contracts.js";
import { BeneficiaryManagementService } from "./service.js";

export const beneficiaryManagementRoutes: FastifyPluginAsync = async (app) => {
  const beneficiaryManagementService = new BeneficiaryManagementService();
  const config = loadConfig();
  const partnerApiKeyService = new PartnerApiKeyService(config);

  app.get("/v1/beneficiaries/health", async () => {
    return {
      module: "beneficiary-management",
      status: "ready"
    };
  });

  app.get("/v1/beneficiaries", async (request) => {
    const query = request.query as {
      corporateTenantId?: string;
      corporateId?: string;
      status?: "active" | "inactive";
      category?: string;
      search?: string;
    };

    return {
      items: await beneficiaryManagementService.listBeneficiaries({
        corporateTenantId: query.corporateTenantId,
        corporateId: query.corporateId,
        status: query.status,
        category: query.category,
        search: query.search
      })
    };
  });

  app.get("/v1/beneficiaries/:beneficiaryId", async (request, reply) => {
    const params = request.params as { beneficiaryId: string };
    const beneficiary = await beneficiaryManagementService.getBeneficiary(
      params.beneficiaryId
    );

    if (!beneficiary) {
      return reply.status(404).send({
        message: "Beneficiary not found"
      });
    }

    return beneficiary;
  });

  app.post("/v1/beneficiaries", async (request, reply) => {
    const parsed = beneficiaryCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.createBeneficiary(parsed.data);

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can create beneficiaries"
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      if (result.error === "duplicate_beneficiary") {
        return reply.status(409).send({
          message: "A beneficiary with the same name and bank account number already exists",
          beneficiaryId: result.beneficiaryId
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

  app.post("/v1/partner/beneficiaries", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const parsed = publishedBeneficiaryCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary API payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.createPublishedBeneficiary(
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
          message: "Only an approved maker can create beneficiaries through this API"
        });
      }

      if (result.error === "child_corporate_not_found") {
        return reply.status(404).send({
          message: "Linked child corporate not found"
        });
      }

      if (result.error === "duplicate_beneficiary") {
        return reply.status(409).send({
          message: "A beneficiary with the same name and bank account number already exists",
          beneficiaryId: result.beneficiaryId
        });
      }

      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send({
      message: "Beneficiary accepted for checker approval",
      beneficiary: result.data
    });
  });

  app.post("/v1/partner/beneficiaries/:beneficiaryId/authorize", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const params = request.params as { beneficiaryId: string };
    const parsed = publishedBeneficiaryApprovalSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary authorization payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.authorizePublishedBeneficiary(
      params.beneficiaryId,
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
          message: "Only an approved checker can authorize beneficiaries through this API"
        });
      }

      if (result.error === "beneficiary_not_found") {
        return reply.status(404).send({
          message: "Beneficiary not found"
        });
      }

      return reply.status(409).send({
        message: "This beneficiary is not waiting for approval",
        currentState: result.currentState
      });
    }

    return {
      message: "Beneficiary authorization applied",
      beneficiary: result.data
    };
  });

  app.post("/v1/beneficiaries/:beneficiaryId/actions", async (request, reply) => {
    const params = request.params as { beneficiaryId: string };
    const parsed = beneficiaryApprovalActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary approval payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.applyApprovalAction(
      params.beneficiaryId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved checker can review beneficiaries"
        });
      }

      if (result.error === "beneficiary_not_found") {
        return reply.status(404).send({
          message: "Beneficiary not found"
        });
      }

      return reply.status(409).send({
        message: "This beneficiary is not waiting for approval",
        currentState: result.currentState
      });
    }

    return result.data;
  });

  app.post("/v1/beneficiaries/:beneficiaryId/status", async (request, reply) => {
    const params = request.params as { beneficiaryId: string };
    const parsed = beneficiaryStatusActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary status payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.applyStatusAction(
      params.beneficiaryId,
      parsed.data
    );

    if ("error" in result) {
      if (result.error === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can activate or deactivate beneficiaries"
        });
      }

      if (result.error === "beneficiary_not_found") {
        return reply.status(404).send({
          message: "Beneficiary not found"
        });
      }

      return reply.status(409).send({
        message: "Only approved beneficiaries can be activated or deactivated",
        currentState: result.currentState
      });
    }

    return result.data;
  });

  app.put("/v1/beneficiaries/:beneficiaryId", async (request, reply) => {
    const params = request.params as { beneficiaryId: string };
    const parsed = beneficiaryUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid beneficiary payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await beneficiaryManagementService.updateBeneficiary(
      params.beneficiaryId,
      parsed.data
    );

    if ("error" in result) {
      return reply.status(404).send({
        message: "Beneficiary not found"
      });
    }

    return result.data;
  });

  app.delete("/v1/beneficiaries/:beneficiaryId", async (request, reply) => {
    const params = request.params as { beneficiaryId: string };
    const result = await beneficiaryManagementService.deleteBeneficiary(
      params.beneficiaryId
    );

    if (!result.deleted) {
      return reply.status(404).send({
        message: "Beneficiary not found"
      });
    }

    return {
      deleted: true
    };
  });
};
