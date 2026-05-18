import { randomBytes } from "node:crypto";

import { getDatabasePool } from "@cmsv01/shared/db";

import type { AppConfig } from "@cmsv01/shared/config";

type PartnerApiKeyRow = {
  key_id: string;
  label: string;
  product_scope: string;
  api_key: string;
  status: string;
  created_by: string | null;
  created_at: Date | null;
};

export class PartnerApiKeyService {
  private readonly db;

  constructor(private readonly config: AppConfig) {
    this.db = getDatabasePool(config);
  }

  async isValidApiKey(apiKey: string) {
    if (apiKey === this.config.beneficiaryPublishApiKey) {
      return true;
    }

    const result = await this.db.query<{ key_id: string }>(
      `select key_id
       from partner_api_keys
       where api_key = $1
         and status = 'active'
       limit 1`,
      [apiKey]
    );

    return Boolean(result.rows[0]);
  }

  async listActiveKeys() {
    const result = await this.db.query<PartnerApiKeyRow>(
      `select key_id, label, product_scope, api_key, status, created_by, created_at
       from partner_api_keys
       where status = 'active'
       order by created_at desc nulls last, key_id desc`
    );

    const items = result.rows.map((row) => ({
      keyId: row.key_id,
      label: row.label,
      productScope: row.product_scope,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at?.toISOString() ?? null,
      maskedKey: maskKey(row.api_key)
    }));

    const hasConfiguredKey = result.rows.some(
      (row) => row.api_key === this.config.beneficiaryPublishApiKey
    );

    if (this.config.beneficiaryPublishApiKey && !hasConfiguredKey) {
      items.unshift({
        keyId: "default-config-key",
        label: "Default configured partner key",
        productScope: "all",
        status: "active",
        createdBy: "system",
        createdAt: null,
        maskedKey: maskKey(this.config.beneficiaryPublishApiKey)
      });
    }

    return items;
  }

  async generateKey(input?: { label?: string; productScope?: string; createdBy?: string }) {
    const keyId = `key-${Date.now()}`;
    const apiKey = `cms_live_${randomBytes(18).toString("hex")}`;
    const label = input?.label?.trim() || "Generated partner key";
    const productScope = input?.productScope?.trim() || "all";
    const createdBy = input?.createdBy?.trim() || "bank-ops-001";

    await this.db.query(
      `insert into partner_api_keys (
         key_id, label, product_scope, api_key, status, created_by, created_at, revoked_at
       )
       values ($1, $2, $3, $4, 'active', $5, now(), null)`,
      [keyId, label, productScope, apiKey, createdBy]
    );

    return {
      keyId,
      label,
      productScope,
      status: "active",
      createdBy,
      createdAt: new Date().toISOString(),
      apiKey,
      maskedKey: maskKey(apiKey)
    };
  }
}

function maskKey(apiKey: string) {
  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 8)}****${apiKey.slice(-4)}`;
}
