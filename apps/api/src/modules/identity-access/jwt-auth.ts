import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { verifyJwt } from "@cmsv01/shared/crypto";
import { loadConfig } from "@cmsv01/shared/config";
import type { AuthenticatedUser } from "./contracts.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

const jwtAuthPluginImpl: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);
  const config = loadConfig();

  app.addHook("onRequest", async (request, reply) => {
    const url = request.url.split("?")[0];
    const method = request.method;

    // Exempt list matching the implementation plan:
    // - GET /health
    // - GET /context
    // - POST /v1/auth/login
    // - GET /ui* (non-production only)
    // - All /v1/cbs/ core banking simulator endpoints
    if (
      (url === "/health" && method === "GET") ||
      (url === "/context" && method === "GET") ||
      (url === "/v1/auth/login" && method === "POST") ||
      (config.nodeEnv !== "production" && url.startsWith("/ui") && method === "GET") ||
      url.startsWith("/v1/cbs/") ||
      url.startsWith("/v1/partner/") ||
      url.startsWith("/bank/dev-portal/")
    ) {
      return;
    }

    const authHeader = request.headers["authorization"];
    if (!authHeader || typeof authHeader !== "string") {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const token = parts[1];
    const decoded = verifyJwt<AuthenticatedUser>(token);
    if (!decoded) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    request.user = decoded;
  });
};

export const jwtAuthPlugin = fp(jwtAuthPluginImpl, {
  name: "jwt-auth"
});
