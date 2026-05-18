import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyPluginAsync } from "fastify";

import { loadConfig } from "@cmsv01/shared/config";

import { PartnerApiKeyService } from "../partner-api-keys/service.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(moduleDir, "ui");

async function loadAsset(fileName: string) {
  return readFile(path.join(assetsDir, fileName), "utf8");
}

function buildSwaggerSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "CMS Banking Developer Portal",
      version: "1.0.0",
      description:
        "Partner-facing beneficiary and payment APIs for the CMS banking payouts platform."
    },
    paths: {
      "/v1/partner/beneficiaries": {
        post: {
          tags: ["Beneficiary"],
          summary: "Create beneficiary",
          description:
            "Creates a beneficiary in pending approval state for the selected child corporate.",
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "bankTenantId",
                    "corporateTenantId",
                    "corporateId",
                    "actorUsername",
                    "beneName",
                    "beneBankAccountNumber",
                    "beneIfscCode",
                    "benePhoneNumber"
                  ],
                  properties: {
                    bankTenantId: { type: "string", example: "bank-alpha" },
                    corporateTenantId: { type: "string", example: "corp-maya-pharama-028616" },
                    corporateId: { type: "string", example: "co-maya-pharama-106925" },
                    actorUsername: { type: "string", example: "grvmaker" },
                    beneName: { type: "string", example: "Orbit Vendor Services" },
                    beneBankAccountNumber: { type: "string", example: "409876543210" },
                    beneIfscCode: { type: "string", example: "HDFC0001234" },
                    benePhoneNumber: { type: "string", example: "9876543210" },
                    beneCategory: { type: "string", example: "vendor" },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                      example: ["preferred", "ops"]
                    }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Beneficiary accepted for checker approval"
            },
            "401": { description: "Invalid API key" },
            "403": { description: "Only an approved maker can create beneficiaries" },
            "404": { description: "Actor or tenant context not found" },
            "409": { description: "Duplicate beneficiary" }
          }
        }
      },
      "/v1/partner/beneficiaries/{beneficiaryId}/authorize": {
        post: {
          tags: ["Beneficiary"],
          summary: "Authorize beneficiary",
          description:
            "Lets an approved checker approve or reject a beneficiary created through UI or partner API.",
          security: [{ apiKeyAuth: [] }],
          parameters: [
            {
              name: "beneficiaryId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actorUsername", "action"],
                  properties: {
                    actorUsername: { type: "string", example: "grvchecker" },
                    action: { type: "string", enum: ["approve", "reject"] },
                    comment: { type: "string", example: "Verified beneficiary details" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Beneficiary authorization applied" },
            "401": { description: "Invalid API key" },
            "403": { description: "Only an approved checker can authorize beneficiaries" },
            "404": { description: "Actor or beneficiary not found" },
            "409": { description: "Beneficiary not waiting for approval" }
          }
        }
      },
      "/v1/partner/payments/transactions": {
        post: {
          tags: ["Payments"],
          summary: "Create transaction",
          description:
            "Creates a transaction and auto-submits it into pending approval for checker review.",
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "bankTenantId",
                    "corporateTenantId",
                    "corporateId",
                    "actorUsername",
                    "txnTitle",
                    "beneficiaryId",
                    "amount"
                  ],
                  properties: {
                    bankTenantId: { type: "string", example: "bank-alpha" },
                    corporateTenantId: { type: "string", example: "corp-maya-pharama-028616" },
                    corporateId: { type: "string", example: "co-maya-pharama-106925" },
                    actorUsername: { type: "string", example: "grvmaker" },
                    txnTitle: { type: "string", example: "Vendor payout for Orbit" },
                    beneficiaryId: { type: "string", example: "1234567890" },
                    amount: {
                      type: "object",
                      required: ["value", "currency"],
                      properties: {
                        value: { type: "number", example: 12500 },
                        currency: { type: "string", enum: ["INR"], example: "INR" }
                      }
                    },
                    tag: { type: "string", example: "vendor" },
                    remark: { type: "string", example: "May invoice settlement" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Transaction created and submitted for checker approval" },
            "401": { description: "Invalid API key" },
            "403": { description: "Only an approved maker can create transactions" },
            "404": { description: "Actor or transaction context not found" },
            "409": { description: "Beneficiary state or corporate context invalid" }
          }
        }
      },
      "/v1/partner/payments/transactions/{batchId}/authorize": {
        post: {
          tags: ["Payments"],
          summary: "Authorize transaction",
          description:
            "Lets an approved checker authorize or reject a pending transaction created by maker or partner API.",
          security: [{ apiKeyAuth: [] }],
          parameters: [
            {
              name: "batchId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actorUsername", "action"],
                  properties: {
                    actorUsername: { type: "string", example: "grvchecker" },
                    action: { type: "string", enum: ["approve", "reject"] },
                    comment: { type: "string", example: "Budget and beneficiary verified" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Transaction authorization applied" },
            "401": { description: "Invalid API key" },
            "403": { description: "Only an approved checker can authorize transactions" },
            "404": { description: "Actor or transaction not found" },
            "409": { description: "Transaction not waiting for approval" }
          }
        }
      },
      "/v1/partner/payments/transactions/{batchId}/status": {
        get: {
          tags: ["Payments"],
          summary: "Get transaction status",
          description:
            "Fetches the current state and important timestamps of a previously created transaction.",
          security: [{ apiKeyAuth: [] }],
          parameters: [
            {
              name: "batchId",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Transaction status fetched successfully" },
            "401": { description: "Invalid API key" },
            "404": { description: "Transaction not found" }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key"
        }
      }
    }
  };
}

export const bankAppRoutes: FastifyPluginAsync = async (app) => {
  const partnerApiKeyService = new PartnerApiKeyService(loadConfig());

  app.get("/bank/dev-portal", async (_request, reply) => {
    const html = await loadAsset("dev-portal.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/bank/dev-portal/styles.css", async (_request, reply) => {
    const css = await loadAsset("styles.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/bank/dev-portal/app.js", async (_request, reply) => {
    const js = await loadAsset("dev-portal.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/bank/dev-portal/api-keys", async () => {
    return {
      items: await partnerApiKeyService.listActiveKeys()
    };
  });

  app.post("/bank/dev-portal/api-keys", async (request, reply) => {
    const body = (request.body ?? {}) as {
      label?: string;
      productScope?: string;
      createdBy?: string;
    };

    const apiKey = await partnerApiKeyService.generateKey({
      label: body.label,
      productScope: body.productScope,
      createdBy: body.createdBy
    });

    return reply.status(201).send(apiKey);
  });

  app.get("/bank/onboarding-review", async (_request, reply) => {
    const html = await loadAsset("index.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/bank/onboarding-review/styles.css", async (_request, reply) => {
    const css = await loadAsset("styles.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/bank/onboarding-review/app.js", async (_request, reply) => {
    const js = await loadAsset("app.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/bank/payout-operations", async (_request, reply) => {
    const html = await loadAsset("payout-operations.html");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/bank/payout-operations/styles.css", async (_request, reply) => {
    const css = await loadAsset("styles.css");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/bank/payout-operations/app.js", async (_request, reply) => {
    const js = await loadAsset("payout-operations.js");
    return reply.type("application/javascript; charset=utf-8").send(js);
  });

  app.get("/bank/dev-portal/openapi/beneficiaries", async (_request) => {
    const swagger = buildSwaggerSpec();
    return {
      ...swagger,
      paths: {
        "/v1/partner/beneficiaries": swagger.paths["/v1/partner/beneficiaries"],
        "/v1/partner/beneficiaries/{beneficiaryId}/authorize":
          swagger.paths["/v1/partner/beneficiaries/{beneficiaryId}/authorize"]
      }
    };
  });

  app.get("/bank/dev-portal/openapi/swagger.json", async () => {
    return buildSwaggerSpec();
  });

  app.get("/bank/dev-portal/openapi/swagger-download", async (_request, reply) => {
    const swagger = buildSwaggerSpec();
    return reply
      .header("Content-Disposition", 'attachment; filename="cms-banking-partner-apis.swagger.json"')
      .type("application/json; charset=utf-8")
      .send(JSON.stringify(swagger, null, 2));
  });

  app.get("/bank/dev-portal/openapi/catalog", async (_request) => {
    return {
      products: [
        {
          name: "Beneficiary",
          apis: [
            {
              name: "Create Beneficiary",
              method: "POST",
              path: "/v1/partner/beneficiaries"
            },
            {
              name: "Auth Bene",
              method: "POST",
              path: "/v1/partner/beneficiaries/:beneficiaryId/authorize"
            }
          ]
        },
        {
          name: "Payments",
          apis: [
            {
              name: "Create Transaction",
              method: "POST",
              path: "/v1/partner/payments/transactions"
            },
            {
              name: "Auth Transaction",
              method: "POST",
              path: "/v1/partner/payments/transactions/:batchId/authorize"
            },
            {
              name: "Get Transaction Status",
              method: "GET",
              path: "/v1/partner/payments/transactions/:batchId/status"
            }
          ]
        }
      ]
    };
  });
};
