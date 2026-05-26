import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API_BASE_URL = process.env.CMS_API_URL || "http://localhost:3101";

// Active user session token stored in-memory
let activeJwtToken: string | null = null;

// Helper to base64 decode JWT payload without verification
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// Create MCP Server
const server = new Server(
  {
    name: "cms-payout-tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Schemas using Zod
const AuthenticateSchema = z.object({
  username: z.string().describe("Corporate account username"),
  password: z.string().describe("Corporate account password"),
});

const CreateTransactionSchema = z.object({
  packageCode: z.string().describe("Code of the subscription package, e.g. ZELPAY"),
  txnTitle: z.string().describe("Short descriptive title of the transaction"),
  beneficiaryId: z.string().describe("Target beneficiary identifier"),
  amount: z.number().positive().describe("Payout amount in INR"),
  tag: z.string().optional().describe("Tag identifying the source, e.g. partner_api"),
  remark: z.string().optional().describe("Internal payout description/remark"),
});

const ApproveTransactionSchema = z.object({
  batchId: z.string().describe("Unique payout transaction batch identifier"),
  action: z.enum(["approve", "reject"]).default("approve").describe("Approval action: approve or reject"),
  comment: z.string().optional().describe("Checker review feedback comment"),
});

const GetTransactionStatusSchema = z.object({
  batchId: z.string().describe("Unique payout transaction batch identifier"),
});

// Register Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "cms_authenticate",
        description: "Establishes a user session context by authenticating with username and password. This must be run before using other tools.",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Corporate account username" },
            password: { type: "string", description: "Corporate account password" },
          },
          required: ["username", "password"],
        },
      },
      {
        name: "cms_create_transaction",
        description: "Creates a new payout transaction for checker approval. Requires active maker session.",
        inputSchema: {
          type: "object",
          properties: {
            packageCode: { type: "string", description: "Code of the subscription package, e.g. ZELPAY" },
            txnTitle: { type: "string", description: "Short descriptive title of the transaction" },
            beneficiaryId: { type: "string", description: "Target beneficiary identifier" },
            amount: { type: "number", description: "Payout amount in INR" },
            tag: { type: "string", description: "Tag identifying the source, e.g. partner_api" },
            remark: { type: "string", description: "Internal payout description/remark" },
          },
          required: [
            "packageCode",
            "txnTitle",
            "beneficiaryId",
            "amount",
          ],
        },
      },
      {
        name: "cms_approve_transaction",
        description: "Authorizes/Approves a pending payout transaction as a Checker. Requires active checker session.",
        inputSchema: {
          type: "object",
          properties: {
            batchId: { type: "string", description: "Unique payout transaction batch identifier" },
            action: { type: "string", enum: ["approve", "reject"], description: "Approval action: approve or reject" },
            comment: { type: "string", description: "Checker review feedback comment" },
          },
          required: ["batchId"],
        },
      },
      {
        name: "cms_get_transaction_status",
        description: "Retrieves the current state, amount, UTR, and metadata of a payout transaction batch. Requires active session.",
        inputSchema: {
          type: "object",
          properties: {
            batchId: { type: "string", description: "Unique payout transaction batch identifier" },
          },
          required: ["batchId"],
        },
      },
    ],
  };
});

// Tool Handler Execution
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "cms_authenticate") {
      const parsed = AuthenticateSchema.parse(args);

      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: parsed.username,
          password: parsed.password,
        }),
      });

      const body = await response.json() as any;
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Authentication failed: ${body.message || JSON.stringify(body)}` }],
          isError: true,
        };
      }

      activeJwtToken = body.token;
      const decoded = decodeJwtPayload(body.token);
      return {
        content: [{
          type: "text",
          text: `Successfully authenticated as ${decoded?.displayName || parsed.username} (${decoded?.role || "user"}). Tenant context: ${decoded?.corporateTenantId || "default"}.`
        }],
      };
    }

    // All other tools require an active JWT session token
    if (!activeJwtToken) {
      return {
        content: [{ type: "text", text: "Error: No active session. Please authenticate first using the 'cms_authenticate' tool." }],
        isError: true,
      };
    }

    const decoded = decodeJwtPayload(activeJwtToken);
    if (!decoded) {
      return {
        content: [{ type: "text", text: "Error: Invalid or expired session token. Please re-authenticate." }],
        isError: true,
      };
    }

    if (name === "cms_create_transaction") {
      const parsed = CreateTransactionSchema.parse(args);
      const permissions = decoded.permissions || [];

      if (!permissions.includes("transaction.make")) {
        return {
          content: [{ type: "text", text: "Forbidden: Your user role does not have the 'transaction.make' permission required to create transactions." }],
          isError: true,
        };
      }

      const response = await fetch(`${API_BASE_URL}/v1/payouts/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeJwtToken}`,
          "X-Bank-Tenant-ID": decoded.bankTenantId || "",
          "X-Corporate-Tenant-ID": decoded.corporateTenantId || "",
        },
        body: JSON.stringify({
          batchId: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          bankTenantId: decoded.bankTenantId,
          corporateTenantId: decoded.corporateTenantId,
          corporateId: decoded.corporateId,
          packageCode: parsed.packageCode,
          createdByUserId: decoded.userId,
          title: parsed.txnTitle,
          items: [
            {
              itemId: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              beneficiaryId: parsed.beneficiaryId,
              amount: { value: parsed.amount, currency: "INR" },
              purpose: "vendor_payout",
            }
          ],
          tag: parsed.tag || "partner_api",
          remark: parsed.remark || "Created via MCP",
        }),
      });

      const body = await response.json() as any;
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Error ${response.status}: ${body.message || JSON.stringify(body)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      };
    }

    if (name === "cms_approve_transaction") {
      const parsed = ApproveTransactionSchema.parse(args);
      const permissions = decoded.permissions || [];

      if (!permissions.includes("transaction.checker")) {
        return {
          content: [{ type: "text", text: "Forbidden: Your user role does not have the 'transaction.checker' permission required to approve transactions." }],
          isError: true,
        };
      }

      const response = await fetch(`${API_BASE_URL}/v1/payouts/batches/${parsed.batchId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeJwtToken}`,
          "X-Bank-Tenant-ID": decoded.bankTenantId || "",
          "X-Corporate-Tenant-ID": decoded.corporateTenantId || "",
        },
        body: JSON.stringify({
          action: parsed.action,
          actedByUserId: decoded.userId,
          comment: parsed.comment || "Approved via MCP",
        }),
      });

      const body = await response.json() as any;
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Error ${response.status}: ${body.message || JSON.stringify(body)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      };
    }

    if (name === "cms_get_transaction_status") {
      const parsed = GetTransactionStatusSchema.parse(args);

      const response = await fetch(`${API_BASE_URL}/v1/payouts/batches/${parsed.batchId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${activeJwtToken}`,
          "X-Bank-Tenant-ID": decoded.bankTenantId || "",
          "X-Corporate-Tenant-ID": decoded.corporateTenantId || "",
        },
      });

      const body = await response.json() as any;
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Error ${response.status}: ${body.message || JSON.stringify(body)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: `Tool ${name} not found.` }],
      isError: true,
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
});

// Run server using stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CMS MCP Server started successfully on stdio");
}

main().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
});
