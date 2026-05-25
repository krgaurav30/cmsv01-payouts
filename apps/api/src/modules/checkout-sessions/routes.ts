import type { FastifyPluginAsync } from "fastify";
import { loadConfig } from "@cmsv01/shared/config";
import { PartnerApiKeyService } from "../partner-api-keys/service.js";
import { checkoutSessionCreateSchema } from "./contracts.js";
import { CheckoutSessionService } from "./service.js";

export const registerCheckoutSessionRoutes: FastifyPluginAsync = async (app) => {
  const config = loadConfig();
  const checkoutSessionService = new CheckoutSessionService();
  const partnerApiKeyService = new PartnerApiKeyService(config);

  // 1. Create Checkout Session - Protected by x-api-key
  app.post("/v1/partner/checkout/sessions", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (typeof apiKey !== "string" || !(await partnerApiKeyService.isValidApiKey(apiKey))) {
      return reply.status(401).send({
        message: "Invalid API key"
      });
    }

    const parsed = checkoutSessionCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid checkout session payload",
        issues: parsed.error.flatten()
      });
    }

    const session = await checkoutSessionService.createCheckoutSession(parsed.data);
    return reply.status(201).send(session);
  });

  // 2. Retrieve Checkout Session - Public (for Iframe/Checkout page initialization)
  app.get("/v1/checkout/sessions/:sessionId", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const session = await checkoutSessionService.getCheckoutSession(params.sessionId);

    if (!session) {
      return reply.status(404).send({
        message: "Checkout session not found"
      });
    }

    return session;
  });

  // 3. Retrieve Checkout Options - Public (for Packages, Debit Accounts, Beneficiaries select list)
  app.get("/v1/checkout/sessions/:sessionId/options", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const options = await checkoutSessionService.getCheckoutSessionOptions(params.sessionId);

    if (!options) {
      return reply.status(404).send({
        message: "Checkout session options not found"
      });
    }

    return options;
  });

  // 4. Confirm and Pay Checkout Session - Public (called by Iframe UI)
  app.post("/v1/checkout/sessions/:sessionId/pay", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const body = request.body as { 
      actorUsername?: string;
      packageCode?: string;
      debitAccountId?: string;
      paymentMethodCode?: string;
      beneficiaryId?: string;
      remark?: string;
    };

    if (!body.actorUsername) {
      return reply.status(400).send({
        message: "actorUsername is required to authorize the checkout payment"
      });
    }

    const result = await checkoutSessionService.processPayment(params.sessionId, body.actorUsername, {
      packageCode: body.packageCode,
      debitAccountId: body.debitAccountId,
      paymentMethodCode: body.paymentMethodCode,
      beneficiaryId: body.beneficiaryId,
      remark: body.remark
    });

    if ("error" in result) {
      if (result.error === "session_not_found") {
        return reply.status(404).send({
          message: "Checkout session not found"
        });
      }

      if (result.error === "invalid_session_status") {
        return reply.status(400).send({
          message: `This checkout session is already ${result.status}`
        });
      }

      // Handle payout validation/creation errors
      if (result.details === "actor_not_found") {
        return reply.status(404).send({
          message: "Actor username not found"
        });
      }

      if (result.details === "forbidden") {
        return reply.status(403).send({
          message: "Only an approved maker can authorize checkout transactions"
        });
      }

      return reply.status(400).send({
        message: `Checkout payment failed: ${result.details}`
      });
    }

    return reply.status(200).send({
      message: "Checkout payment approved and submitted successfully",
      commandId: result.commandId,
      status: result.status,
      subscriptionId: result.subscriptionId,
      packageCode: result.packageCode
    });
  });
}
