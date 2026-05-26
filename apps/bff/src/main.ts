import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";

import { loadConfig } from "@cmsv01/shared/config";
import { verifyJwt, signJwt } from "@cmsv01/shared/crypto";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((pair) => {
    const parts = pair.split("=");
    const key = parts[0].trim();
    if (key) {
      cookies[key] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return cookies;
}

function getVerifiedSession(request: FastifyRequest): { headers: Record<string, string>; user: Record<string, any> } | null {
  const cookies = parseCookies(request.headers.cookie);
  const sessionStr = cookies["cmsCorporateSession"];
  if (!sessionStr) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionStr);
    if (!session) {
      return null;
    }
    
    // Developer convenience fallback for pre-saved/legacy cookies
    if (!session.token && process.env.NODE_ENV !== "production") {
      session.token = signJwt(session);
    }
    
    if (!session.token) {
      return null;
    }
    
    const decoded = verifyJwt<Record<string, any>>(session.token);
    if (!decoded) {
      return null;
    }
    
    return {
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "X-Bank-Tenant-ID": decoded.bankTenantId || "",
        "X-Corporate-Tenant-ID": decoded.corporateTenantId || "",
        "Content-Type": "application/json"
      },
      user: decoded
    };
  } catch {
    return null;
  }
}

function getVerifiedSessionHeaders(request: FastifyRequest): Record<string, string> | null {
  return getVerifiedSession(request)?.headers || null;
}


type CorporateOperationsInitialData = {
  selectedCorporateId: string;
  bankTenants: unknown[];
  corporateTenants: unknown[];
  corporates: unknown[];
  subscriptions: unknown[];
  activeSubscription: {
    subscription: unknown;
    effectiveSettings: unknown | null;
  } | null;
  beneficiaries: unknown[];
  transactions: unknown[];
  fileUploads: unknown[];
  approvalMatrices: unknown[];
  roles: unknown[];
  users: unknown[];
  settings: unknown | null;
  debitAccounts: unknown[];
};

type OperationsInitialDataQuery = {
  bankTenantId?: string;
  corporateTenantId?: string;
  userId?: string;
  selectedCorporateId?: string;
  sessionCorporateId?: string;
  packageCode?: string;
  includeSettings?: string;
};

const config = loadConfig();
const app = Fastify({
  logger: {
    level: "info"
  }
});

app.decorateRequest("correlationId", "");

app.addHook("onRequest", async (request, reply) => {
  const correlationId = (request.headers["x-correlation-id"] as string) || `corr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  request.correlationId = correlationId;
  reply.header("X-Correlation-ID", correlationId);
});

const coreApiBase = resolveCoreApiBase();

app.get('/bff-debug', () => ({ coreApiBase, env: process.env.NODE_ENV }));
app.get('/health', async () => {
  const coreHealth = await fetchJson<Record<string, unknown>>("/health", {
    fallback: { status: "unreachable" }
  });

  return {
    status: "ok",
    app: `${config.appName} BFF`,
    coreApi: coreHealth
  };
});

app.post("/bff/auth/login", async (request, reply) => {
  try {
    const response = await fetch(`${coreApiBase}/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.body ?? {}),
      redirect: "manual"
    });

    reply.code(response.status);
    reply.header("content-type", response.headers.get("content-type") ?? "application/json");

    const buffer = Buffer.from(await response.arrayBuffer());
    return reply.send(buffer);
  } catch (error) {
    request.log.error(
      {
        err: error,
        body: request.body
      },
      "bff login proxy failed"
    );

    return reply.status(500).send({
      message: error instanceof Error ? error.message : "Unknown BFF login proxy failure"
    });
  }
});

app.get("/bff/corporate/operations/initial-data", async (request, reply) => {
  const session = getVerifiedSession(request);
  if (!session) {
    return reply.status(401).send({ message: "Unauthorized" });
  }
  const secureHeaders = session.headers;
  secureHeaders["X-Correlation-ID"] = request.correlationId;

  const query = request.query as OperationsInitialDataQuery;

  if (!query.bankTenantId || !query.corporateTenantId || !query.userId) {
    return reply.status(400).send({
      message:
        "bankTenantId, corporateTenantId, and userId are required to load operations data"
    });
  }

  // Enforce Tenant Context Isolation
  if (query.corporateTenantId !== session.user.corporateTenantId) {
    return reply.status(403).send({ message: "Forbidden: Corporate tenant context mismatch" });
  }
  if (query.bankTenantId !== session.user.bankTenantId) {
    return reply.status(403).send({ message: "Forbidden: Bank tenant context mismatch" });
  }
  if (query.userId !== session.user.userId) {
    return reply.status(403).send({ message: "Forbidden: User ID context mismatch" });
  }

  const bankTenantsPromise = fetchJson<{ items?: unknown[] }>("/v1/tenants/banks", {
    fallback: { items: [] },
    headers: secureHeaders
  });
  const corporateTenantsPromise = fetchJson<{ items?: unknown[] }>(
    `/v1/tenants/corporates?status=active&bankTenantId=${encodeURIComponent(query.bankTenantId)}`,
    {
      fallback: { items: [] },
      headers: secureHeaders
    }
  );
  const corporatesPromise = fetchJson<{ items?: unknown[] }>(
    `/v1/corporates?status=active&corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
    {
      fallback: { items: [] },
      headers: secureHeaders
    }
  );

  const [bankTenants, corporateTenants, corporates] = await Promise.all([
    bankTenantsPromise,
    corporateTenantsPromise,
    corporatesPromise
  ]);

  const availableCorporates = corporates.items ?? [];
  const selectedCorporateId =
    normalizeQueryValue(query.selectedCorporateId) ??
    normalizeQueryValue(query.sessionCorporateId) ??
    getFirstCorporateId(availableCorporates);

  if (!selectedCorporateId) {
    const response: CorporateOperationsInitialData = {
      selectedCorporateId: "",
      bankTenants: bankTenants.items ?? [],
      corporateTenants: corporateTenants.items ?? [],
      corporates: availableCorporates,
      subscriptions: [],
      activeSubscription: null,
      beneficiaries: [],
      transactions: [],
      fileUploads: [],
      approvalMatrices: [],
      roles: [],
      users: [],
      settings: null,
      debitAccounts: []
    };

    return reply.send(response);
  }

  const includeSettings = query.includeSettings === "true";
  const settingsPath = `/v1/settings/corporate-tenant?corporateTenantId=${encodeURIComponent(
    query.corporateTenantId
  )}&actedByUserId=${encodeURIComponent(query.userId)}`;
  const subscriptionsPath = new URLSearchParams({
    corporateTenantId: query.corporateTenantId,
    corporateId: selectedCorporateId,
    status: "active"
  });

  const packageCode = normalizeQueryValue(query.packageCode);
  if (packageCode) {
    subscriptionsPath.set("packageCode", packageCode);
  }

  const [
    transactions,
    fileUploads,
    beneficiaries,
    approvalMatrices,
    roles,
    users,
    settings,
    subscriptions,
    debitAccounts
  ] = await Promise.all([
    fetchJson<{ items?: unknown[] }>(
      `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/payouts/file-uploads?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/approval-matrices?corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(query.corporateTenantId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    fetchJson<{ items?: unknown[] }>(
      `/v1/auth/users?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    ),
    includeSettings
      ? fetchJson<unknown | null>(settingsPath, {
          fallback: null,
          headers: secureHeaders
        })
      : Promise.resolve(null),
    fetchJson<{ items?: unknown[] }>(`/v1/subscriptions?${subscriptionsPath.toString()}`, {
      fallback: { items: [] },
      headers: secureHeaders
    }),
    fetchJson<{ items?: unknown[] }>(
      `/v1/debit-accounts?corporateTenantId=${encodeURIComponent(
        query.corporateTenantId
      )}&corporateId=${encodeURIComponent(selectedCorporateId)}`,
      {
        fallback: { items: [] },
        headers: secureHeaders
      }
    )
  ]);

  const availableSubscriptions = subscriptions.items ?? [];
  const selectedSubscription = selectSubscription(availableSubscriptions, packageCode);
  const selectedSubscriptionId = selectedSubscription
    ? getSubscriptionId(selectedSubscription)
    : "";
  const activeSubscription = selectedSubscription
    && selectedSubscriptionId
    ? {
        subscription: selectedSubscription,
        effectiveSettings: await fetchJson<unknown | null>(
          `/v1/effective-settings/subscriptions/${encodeURIComponent(selectedSubscriptionId)}`,
          {
            fallback: null,
            headers: secureHeaders
          }
        )
      }
    : null;

  const response: CorporateOperationsInitialData = {
    selectedCorporateId,
    bankTenants: bankTenants.items ?? [],
    corporateTenants: corporateTenants.items ?? [],
    corporates: availableCorporates,
    subscriptions: availableSubscriptions,
    activeSubscription,
    beneficiaries: beneficiaries.items ?? [],
    transactions: transactions.items ?? [],
    fileUploads: fileUploads.items ?? [],
    approvalMatrices: approvalMatrices.items ?? [],
    roles: roles.items ?? [],
    users: users.items ?? [],
    settings,
    debitAccounts: debitAccounts.items ?? []
  };

  return reply.send(response);
});

function mapGeminiHistoryToOpenAI(geminiHistory: any[]): any[] {
  const openAIMessages: any[] = [];
  const activeToolCalls = new Map<string, string>();
  let callCounter = 0;

  for (const turn of geminiHistory) {
    if (turn.role === "user") {
      const toolResponsePart = turn.parts?.find((p: any) => p.functionResponse !== undefined);
      if (toolResponsePart) {
        const name = toolResponsePart.functionResponse.name;
        const toolCallId = activeToolCalls.get(name) || `call_${name}_${callCounter++}`;
        openAIMessages.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: JSON.stringify(toolResponsePart.functionResponse.response?.result || {})
        });
      } else {
        const textPart = turn.parts?.find((p: any) => p.text !== undefined);
        if (textPart) {
          openAIMessages.push({
            role: "user",
            content: textPart.text
          });
        }
      }
    } else if (turn.role === "model") {
      const functionCallParts = turn.parts?.filter((p: any) => p.functionCall !== undefined) || [];
      if (functionCallParts.length > 0) {
        const toolCalls = functionCallParts.map((part: any) => {
          const name = part.functionCall.name;
          const toolCallId = `call_${name}_${callCounter++}`;
          activeToolCalls.set(name, toolCallId);
          return {
            id: toolCallId,
            type: "function" as const,
            function: {
              name,
              arguments: JSON.stringify(part.functionCall.args || {})
            }
          };
        });
        openAIMessages.push({
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        });
      } else {
        const textPart = turn.parts?.find((p: any) => p.text !== undefined);
        if (textPart) {
          openAIMessages.push({
            role: "assistant",
            content: textPart.text
          });
        }
      }
    }
  }

  return openAIMessages;
}

  app.post("/bff/chat/message", async (request, reply) => {
    const startTime = Date.now();
    const session = getVerifiedSession(request);
    if (!session) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    const secureHeaders = session.headers;

    const { message, history } = request.body as { message: string; history?: any[] };
    if (!message) {
      return reply.status(400).send({ message: "Message is required" });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return reply.status(500).send({
        message: "OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file."
      });
    }

    // Prune history to keep only the last 5 prompts and responses (turns)
    let prunedHistory = history || [];
    const promptIndices: number[] = [];
    for (let i = 0; i < prunedHistory.length; i++) {
      const turn = prunedHistory[i];
      if (turn.role === "user") {
        const hasText = turn.parts?.some((p: any) => p.text !== undefined);
        const hasResponse = turn.parts?.some((p: any) => p.functionResponse !== undefined);
        if (hasText && !hasResponse) {
          promptIndices.push(i);
        }
      }
    }
    if (promptIndices.length > 5) {
      const keepFromIndex = promptIndices[promptIndices.length - 5];
      prunedHistory = prunedHistory.slice(keepFromIndex);
      request.log.info({ originalLen: history?.length, prunedLen: prunedHistory.length }, "Pruned chat history to last 5 turns");
    }

    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const openAIMessages = mapGeminiHistoryToOpenAI(prunedHistory);

      const systemPrompt = `You are the CMS Banking Payout Assistant.
You help corporate makers and checkers view, create, and approve payout transaction batches.

CRITICAL SECURITY & CONTEXT DIRECTIVE:
You are interacting with the following ALREADY AUTHENTICATED user:
- Username: "${session.user.username}"
- Role: "${session.user.role}"
- Permissions: ${JSON.stringify(session.user.permissions || [])}

- SECURITY RULE 1: The user's role and permissions are 100% verified. You MUST NOT ask the user to confirm their role, permissions, or identity. NEVER ask "Are you a maker?", "Do you have permission?", "Please confirm your role", or anything similar.
- SECURITY RULE 2: Directly allow or deny tool calls based on the authenticated permissions listed above:
  * Only allow creating a transaction (calling 'create_transaction' tool) if the user has "transaction.make" permission. (Since the user has Role: "${session.user.role}", they are already authorized if their role is maker).
  * Only allow approving/rejecting a transaction (calling 'approve_transaction' tool) if the user has "transaction.checker" permission.
  * If they lack the required permission, politely say: "You do not have the required permission to perform this action." and do not call the tool. Do NOT ask them to confirm if they have it.

Always speak in a helpful, concise, and professional tone. Format numbers as currency in INR (e.g. ₹1,500.00).`;

      const loopMessages = [
        { role: "system" as const, content: systemPrompt },
        ...openAIMessages,
        { role: "user" as const, content: message }
      ];

      const openAITools = [
        {
          type: "function" as const,
          function: {
            name: "list_transactions",
            description: "Fetch recent payout transaction batches for this corporate account.",
            parameters: {
              type: "object",
              properties: {
                limit: { type: "integer", description: "Maximum number of transactions to return" }
              }
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_transaction",
            description: "Creates a new payout transaction for a beneficiary. This will be created in draft state and automatically submitted for approval.",
            parameters: {
              type: "object",
              properties: {
                packageCode: { type: "string", description: "The package code, e.g. ZELPAY" },
                txnTitle: { type: "string", description: "Short description of the transaction" },
                beneficiaryId: { type: "string", description: "The beneficiary account identifier" },
                amount: { type: "number", description: "Payout amount in INR" },
                remark: { type: "string", description: "Optional remark" }
              },
              required: ["packageCode", "txnTitle", "beneficiaryId", "amount"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "approve_transaction",
            description: "Authorizes/Approves a pending payout transaction batch as a Checker.",
            parameters: {
              type: "object",
              properties: {
                batchId: { type: "string", description: "The unique ID of the batch to approve" },
                comment: { type: "string", description: "Optional checker approval comment" }
              },
              required: ["batchId"]
            }
          }
        }
      ];

      const openaiStart = Date.now();
      let completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: loopMessages,
        tools: openAITools,
        tool_choice: "auto"
      });
      request.log.info({ durationMs: Date.now() - openaiStart }, "Initial OpenAI completion received");

      let responseMessage = completion.choices[0].message;
      const maxLoops = 5;
      let loops = 0;

      // We will record the Gemini style new turns on the fly
      const newTurns: any[] = [
        { role: "user", parts: [{ text: message }] }
      ];

      while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0 && loops < maxLoops) {
        loops++;
        request.log.info({ loopIndex: loops, toolCallsCount: responseMessage.tool_calls.length }, "Processing OpenAI tool calls");

        // Record the tool calls in Gemini style
        newTurns.push({
          role: "model",
          parts: responseMessage.tool_calls.map((tc) => ({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}")
            }
          }))
        });

        // Push assistant's message with tool calls to loopMessages
        loopMessages.push({
          role: "assistant",
          content: responseMessage.content,
          tool_calls: responseMessage.tool_calls
        } as any);

        const currentToolResponses: any[] = [];

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
          const { name, arguments: argsString } = toolCall.function;
          const args = JSON.parse(argsString || "{}");

          let toolResult: any;
          try {
            if (name === "list_transactions") {
              const limit = args.limit || 10;
              const corporateTenantId = session.user.corporateTenantId;
              const corporateId = session.user.corporateId;
              const queryParams = new URLSearchParams({
                corporateTenantId: corporateTenantId || "",
                corporateId: corporateId || ""
              });
              const res = await fetch(`${coreApiBase}/v1/payouts/batches?${queryParams.toString()}`, {
                headers: secureHeaders
              });
              const data = await res.json() as any;
              toolResult = data.items ? data.items.slice(0, limit) : [];
            } else if (name === "create_transaction") {
              const permissions = session.user.permissions || [];
              if (!permissions.includes("transaction.make")) {
                toolResult = { error: "Forbidden: You do not have the transaction.make permission required to create transactions." };
              } else {
                const createdByUserId = session.user.userId;
                const corporateId = session.user.corporateId;
                const corporateTenantId = session.user.corporateTenantId;
                const bankTenantId = session.user.bankTenantId;

                const res = await fetch(`${coreApiBase}/v1/payouts/transactions`, {
                  method: "POST",
                  headers: secureHeaders,
                  body: JSON.stringify({
                    batchId: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    bankTenantId,
                    corporateTenantId,
                    corporateId,
                    packageCode: args.packageCode,
                    createdByUserId,
                    title: args.txnTitle,
                    items: [
                      {
                        itemId: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        beneficiaryId: args.beneficiaryId,
                        amount: { value: args.amount, currency: "INR" },
                        purpose: "vendor_payout"
                      }
                    ],
                    tag: "partner_api",
                    remark: args.remark || "Created via Chatbot"
                  })
                });

                if (!res.ok) {
                  const errBody = await res.json() as any;
                  toolResult = { error: errBody.message || "Failed to create transaction" };
                } else {
                  toolResult = await res.json();
                }
              }
            } else if (name === "approve_transaction") {
              const permissions = session.user.permissions || [];
              if (!permissions.includes("transaction.checker")) {
                toolResult = { error: "Forbidden: You do not have the transaction.checker permission required to approve transactions." };
              } else {
                const actedByUserId = session.user.userId;

                const res = await fetch(`${coreApiBase}/v1/payouts/batches/${args.batchId}/actions`, {
                  method: "POST",
                  headers: secureHeaders,
                  body: JSON.stringify({
                    action: "approve",
                    actedByUserId,
                    comment: args.comment || "Approved via Chatbot"
                  })
                });

                if (!res.ok) {
                  const errBody = await res.json() as any;
                  toolResult = { error: errBody.message || "Failed to approve transaction" };
                } else {
                  toolResult = await res.json();
                }
              }
            }
          } catch (err: any) {
            toolResult = { error: err.message || String(err) };
          }

          // Push to OpenAI loop messages
          loopMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });

          // Track response to record in Gemini style
          currentToolResponses.push({
            name,
            result: toolResult
          });
        }

        // Record the tool responses in Gemini style
        newTurns.push({
          role: "user",
          parts: currentToolResponses.map((tr) => ({
            functionResponse: {
              name: tr.name,
              response: { result: tr.result }
            }
          }))
        });

        // Request next completion from OpenAI
        const nextStart = Date.now();
        completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: loopMessages,
          tools: openAITools
        });
        request.log.info({ durationMs: Date.now() - nextStart }, "Next OpenAI completion received");
        responseMessage = completion.choices[0].message;
      }

      // Record final model answer in Gemini style
      const finalContent = responseMessage.content || "I have processed your request.";
      newTurns.push({
        role: "model",
        parts: [{ text: finalContent }]
      });

      request.log.info({ totalDurationMs: Date.now() - startTime }, "BFF chat message successfully processed");
      return {
        text: finalContent,
        history: newTurns
      };
    } catch (err: any) {
      request.log.error(err, "OpenAI chat failed");
      const errStr = String(err.message || err);
      if (err.status === 429 || errStr.includes("429") || errStr.includes("insufficient_quota") || errStr.includes("rate_limit")) {
        return reply.status(429).send({
          message: "OpenAI API quota or rate limit exceeded. Please check your OpenAI billing plan and API key."
        });
      }
      return reply.status(500).send({
        message: err.message || "An error occurred while communicating with OpenAI."
      });
    }
  });

  app.all("/v1/*", async (request, reply) => {
    return proxyToCore(request, reply, request.url);
  });

app.all("/bank/*", async (request, reply) => {
  return proxyToCore(request, reply, request.url);
});

async function proxyToCore(request: FastifyRequest, reply: FastifyReply, path: string) {
  let headers: Record<string, string> = {};
  let body: unknown;
  try {
    const cleanPath = path.split("?")[0];
    const isPublic =
      cleanPath === "/health" ||
      cleanPath === "/context" ||
      cleanPath === "/v1/auth/login" ||
      cleanPath === "/bff/auth/login" ||
      cleanPath.startsWith("/v1/cbs/") ||
      cleanPath.startsWith("/v1/payment-hub/") ||
      cleanPath.startsWith("/v1/partner/") ||
      cleanPath.startsWith("/bank/dev-portal/") ||
      cleanPath.startsWith("/v1/checkout/");

    let secureHeaders: Record<string, string> | null = null;
    let sessionUser: Record<string, any> | null = null;
    if (!isPublic) {
      const session = getVerifiedSession(request);
      if (!session) {
        return reply.status(401).send({ message: "Unauthorized" });
      }
      secureHeaders = session.headers;
      sessionUser = session.user;
    }

    // Enforce Tenant Context Isolation on query parameters and request body
    if (!isPublic && sessionUser) {
      const query = request.query as Record<string, any>;
      if (query) {
        if (query.corporateTenantId && query.corporateTenantId !== sessionUser.corporateTenantId) {
          return reply.status(403).send({ message: "Forbidden: Corporate tenant context mismatch in query" });
        }
        if (query.bankTenantId && query.bankTenantId !== sessionUser.bankTenantId) {
          return reply.status(403).send({ message: "Forbidden: Bank tenant context mismatch in query" });
        }
        if (query.corporateId && query.corporateId !== sessionUser.corporateId) {
          return reply.status(403).send({ message: "Forbidden: Corporate context mismatch in query" });
        }
      }

      if (request.body && typeof request.body === "object") {
        const bodyObj = request.body as Record<string, any>;
        if (bodyObj.corporateTenantId && bodyObj.corporateTenantId !== sessionUser.corporateTenantId) {
          return reply.status(403).send({ message: "Forbidden: Corporate tenant context mismatch in body" });
        }
        if (bodyObj.bankTenantId && bodyObj.bankTenantId !== sessionUser.bankTenantId) {
          return reply.status(403).send({ message: "Forbidden: Bank tenant context mismatch in body" });
        }
        if (bodyObj.corporateId && bodyObj.corporateId !== sessionUser.corporateId) {
          return reply.status(403).send({ message: "Forbidden: Corporate context mismatch in body" });
        }
      }
    }

    headers = buildProxyHeaders(request);
    headers["X-Correlation-ID"] = request.correlationId;

    if (secureHeaders) {
      // Strip client-submitted tenant and auth headers to prevent spoofing
      for (const key of Object.keys(headers)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === "x-bank-tenant-id" ||
          lowerKey === "x-corporate-tenant-id" ||
          lowerKey === "authorization"
        ) {
          delete headers[key];
        }
      }

      // Re-inject verified tenant and auth headers
      headers["Authorization"] = secureHeaders["Authorization"];
      headers["X-Bank-Tenant-ID"] = secureHeaders["X-Bank-Tenant-ID"];
      headers["X-Corporate-Tenant-ID"] = secureHeaders["X-Corporate-Tenant-ID"];
    }

    body = buildProxyBody(request);
    
    const response = await fetch(`${coreApiBase}${path}`, {
      method: request.method,
      headers,
      body: body as any,
      redirect: "manual"
    });

    reply.code(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") {
        return;
      }
      reply.header(key, value);
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return reply.send(buffer);
  } catch (error: any) {
    return reply.status(500).send({ 
      error: String(error), 
      stack: error?.stack, 
      cause: error?.cause,
      debugArgs: { url: `${coreApiBase}${path}`, method: request.method, headers, bodyType: typeof body }
    });
  }
}
function buildProxyHeaders(request: FastifyRequest) {
  const headers: Record<string, string> = {};

  Object.entries(request.headers).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (["host", "connection", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      return;
    }

    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
      return;
    }

    headers[key] = value;
  });

  return headers;
}

function buildProxyBody(request: FastifyRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body;
  }

  if (request.body === undefined || request.body === null) {
    return undefined;
  }

  return JSON.stringify(request.body);
}

async function fetchJson<T>(path: string, options: { fallback: T; headers?: Record<string, string> }): Promise<T> {
  try {
    const response = await fetch(`${coreApiBase}${path}`, {
      cache: "no-store",
      headers: options.headers
    });

    if (!response.ok) {
      return options.fallback;
    }

    return (await response.json()) as T;
  } catch {
    return options.fallback;
  }
}

function getFirstCorporateId(items: unknown[]) {
  const first = items[0] as { corporateId?: string } | undefined;
  return first?.corporateId ?? "";
}

function selectSubscription(items: unknown[], preferredPackageCode?: string | null) {
  if (items.length === 0) {
    return null;
  }

  if (preferredPackageCode) {
    const matching = items.find((item) => {
      const entry = item as { packageCode?: string } | undefined;
      return entry?.packageCode === preferredPackageCode;
    });

    if (matching) {
      return matching;
    }
  }

  return items[0] ?? null;
}

function getSubscriptionId(item: unknown) {
  const entry = item as { subscriptionId?: string } | undefined;
  return entry?.subscriptionId ?? "";
}

function normalizeQueryValue(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveCoreApiBase() {
  const configured =
    process.env.CORE_API_URL ||
    process.env.API_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3101" : null);

  if (!configured) {
    throw new Error(
      "Core API base URL is not configured. Set CORE_API_URL for the BFF runtime."
    );
  }

  return configured.replace(/\/+$/, "");
}

try {
  await app.listen({
    host: "0.0.0.0",
    port: config.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
