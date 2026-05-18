import type { FastifyPluginAsync } from "fastify";

import {
  onboardingApplicationCreateSchema,
  onboardingReviewActionSchema
} from "./contracts.js";
import { CorporateOnboardingService } from "./service.js";

export const corporateOnboardingRoutes: FastifyPluginAsync = async (app) => {
  const corporateOnboardingService = new CorporateOnboardingService();

  app.get("/v1/onboarding/health", async () => {
    return {
      module: "corporate-onboarding",
      status: "ready"
    };
  });

  app.get("/v1/onboarding/applications", async (request) => {
    const query = request.query as {
      bankTenantId?: string;
      corporateTenantId?: string;
    };

    return {
      items: await corporateOnboardingService.listApplications(
        query.bankTenantId,
        query.corporateTenantId
      )
    };
  });

  app.get("/v1/onboarding/applications/:applicationId", async (request, reply) => {
    const params = request.params as { applicationId: string };
    const application = await corporateOnboardingService.getApplication(
      params.applicationId
    );

    if (!application) {
      return reply.status(404).send({
        message: "Onboarding application not found"
      });
    }

    return application;
  });

  app.post("/v1/onboarding/applications", async (request, reply) => {
    const parsed = onboardingApplicationCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid onboarding application payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await corporateOnboardingService.createApplication(parsed.data);

    if ("error" in result) {
      return reply.status(404).send({
        message:
          result.error === "bank_not_found"
            ? "Linked bank tenant not found"
            : "Linked corporate tenant not found"
      });
    }

    return reply.status(201).send(result.data);
  });

  app.post(
    "/v1/onboarding/applications/:applicationId/actions",
    async (request, reply) => {
      const params = request.params as { applicationId: string };
      const parsed = onboardingReviewActionSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid onboarding action payload",
          issues: parsed.error.flatten()
        });
      }

      const result = await corporateOnboardingService.applyAction(
        params.applicationId,
        parsed.data
      );

      if ("error" in result) {
        if (result.error === "application_not_found") {
          return reply.status(404).send({
            message: "Onboarding application not found"
          });
        }

        return reply.status(409).send({
          message: "Invalid onboarding state transition",
          currentState: result.currentState
        });
      }

      return result.data;
    }
  );
};
