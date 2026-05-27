import { getDatabasePool } from "@cmsv01/shared/db";
import { loadConfig } from "@cmsv01/shared/config";

export type ApiActivityInput = {
  activityId: string;
  category: "beneficiary" | "payment";
  apiName: string;
  method: string;
  path: string;
  requestHeaders: any;
  requestBody: any;
  responseStatus: number;
  responseHeaders: any;
  responseBody: any;
  ipAddress?: string;
};

export class PartnerApiActivityService {
  private readonly db = getDatabasePool(loadConfig());

  async logActivity(input: ApiActivityInput) {
    try {
      await this.db.query(
        `insert into partner_api_activities (
          activity_id, category, api_name, method, path,
          request_headers, request_body, response_status, response_headers, response_body,
          ip_address, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, (extract(epoch from now()) * 1000)::bigint)`,
        [
          input.activityId,
          input.category,
          input.apiName,
          input.method,
          input.path,
          JSON.stringify(input.requestHeaders),
          input.requestBody ? JSON.stringify(input.requestBody) : null,
          input.responseStatus,
          JSON.stringify(input.responseHeaders),
          input.responseBody ? JSON.stringify(input.responseBody) : null,
          input.ipAddress || null
        ]
      );
    } catch (err) {
      console.error("Failed to log partner API activity:", err);
    }
  }

  async listActivities(category: "beneficiary" | "payment", limit = 50, page?: number) {
    const isPaginated = typeof page === "number";
    let totalCount = 0;

    if (isPaginated) {
      const countRes = await this.db.query(
        `select count(*) from partner_api_activities where category = $1`,
        [category]
      );
      totalCount = parseInt(countRes.rows[0].count, 10);
    }

    let queryText = `
      select activity_id, category, api_name, method, path, response_status, created_at, request_headers, request_body, response_body
      from partner_api_activities
      where category = $1
      order by created_at desc
    `;

    const queryParams: any[] = [category];
    if (isPaginated) {
      const offset = (page! - 1) * limit;
      queryParams.push(limit, offset);
      queryText += ` limit $2 offset $3`;
    } else {
      queryParams.push(limit);
      queryText += ` limit $2`;
    }

    const result = await this.db.query(queryText, queryParams);

    const items = result.rows.map((row: any) => ({
      activityId: row.activity_id,
      category: row.category,
      apiName: row.api_name,
      method: row.method,
      path: row.path,
      responseStatus: row.response_status,
      createdAt: row.created_at,
      maskedKey: maskApiKeyHeader(row.request_headers),
      requestBody: row.request_body,
      responseBody: row.response_body
    }));

    if (isPaginated) {
      return {
        items,
        pagination: {
          page: page!,
          limit,
          totalCount,
          hasMore: (page! - 1) * limit + items.length < totalCount
        }
      };
    }

    return { items };
  }

  async getActivityDetails(activityId: string) {
    const activityResult = await this.db.query(
      `select activity_id, category, api_name, method, path,
              request_headers, request_body, response_status, response_headers, response_body,
              ip_address, created_at
       from partner_api_activities
       where activity_id = $1`,
      [activityId]
    );

    if (activityResult.rows.length === 0) {
      return null;
    }

    const row = activityResult.rows[0];

    // Query associated webhook deliveries
    const webhooksResult = await this.db.query(
      `select delivery_id, webhook_id, event_type, target_url, response_status, response_body, status, attempted_at
       from partner_webhook_deliveries
       where activity_id = $1
       order by attempted_at asc`,
      [activityId]
    );

    return {
      activity: {
        activityId: row.activity_id,
        category: row.category,
        apiName: row.api_name,
        method: row.method,
        path: row.path,
        requestHeaders: maskHeaders(row.request_headers),
        requestBody: row.request_body,
        responseStatus: row.response_status,
        responseHeaders: row.response_headers,
        responseBody: row.response_body,
        ipAddress: row.ip_address,
        createdAt: row.created_at},
      webhookDeliveries: webhooksResult.rows.map((d: any) => ({
        deliveryId: d.delivery_id,
        webhookId: d.webhook_id,
        eventType: d.event_type,
        targetUrl: d.target_url,
        responseStatus: d.response_status,
        responseBody: d.response_body,
        status: d.status,
        attemptedAt: d.attempted_at ? d.attempted_at: null
      }))
    };
  }
}

function maskHeaders(headers: any): any {
  if (!headers || typeof headers !== "object") return {};
  const masked: any = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "x-api-key") {
      masked[key] = maskKey(String(value));
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function maskApiKeyHeader(headers: any): string {
  if (!headers || typeof headers !== "object") return "";
  const apiKey = headers["x-api-key"] || headers["X-Api-Key"] || "";
  return maskKey(String(apiKey));
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "****";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
