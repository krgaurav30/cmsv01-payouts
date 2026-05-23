"use client";

import { useEffect, useState } from "react";

type ApiDefinition = {
  title: string;
  method: string;
  path: string;
  summary: string;
  fields: Array<[string, string, string]>;
  example: string;
  successResponse: string;
  errorResponse: string;
  notes: string[];
};

type ApiKeyItem = {
  keyId: string;
  label: string;
  productScope: string;
  status: string;
  createdBy: string | null;
  maskedKey: string;
};

type WebhookItem = {
  webhookId: string;
  label: string;
  webhookUrl: string;
  eventTypes: string[];
  status: "active" | "inactive";
  maskedSigningSecret: string;
  lastDeliveryStatus: string | null;
  lastDeliveryHttpStatus: number | null;
};

type WebhookDelivery = {
  deliveryId: string;
  webhookId: string;
  eventType: string;
  targetUrl: string;
  responseStatus: number | null;
  responseBody: string | null;
  status: string;
  attemptedAt: string | null;
};

const webhookEventPresets = [
  {
    key: "beneficiary",
    label: "Beneficiary",
    eventTypes: ["beneficiary.created", "beneficiary.authorized"]
  },
  {
    key: "payments",
    label: "Payments",
    eventTypes: [
      "transaction.created",
      "transaction.authorized",
      "transaction.sent_to_bank",
      "transaction.paid",
      "transaction.failed"
    ]
  },
  {
    key: "file-upload",
    label: "File Upload",
    eventTypes: ["file.upload.processed"]
  }
] as const;

const apiDefinitions: Record<string, ApiDefinition> = {
  "create-beneficiary": {
    title: "Create Beneficiary",
    method: "POST",
    path: "/v1/partner/beneficiaries",
    summary:
      "Creates a beneficiary in pending approval state for the selected child corporate.",
    fields: [
      ["bankTenantId", "Yes", "Bank tenant identifier, for example bank-alpha."],
      ["corporateTenantId", "Yes", "Parent corporate tenant identifier."],
      ["corporateId", "Yes", "Child corporate identifier under the selected tenant."],
      ["actorUsername", "Yes", "Approved maker username who is creating the beneficiary."],
      ["beneName", "Yes", "Beneficiary legal or trading name."],
      ["beneBankAccountNumber", "Yes", "Beneficiary bank account number."],
      ["beneIfscCode", "Yes", "Beneficiary IFSC code."],
      ["benePhoneNumber", "Yes", "Beneficiary contact phone number."],
      ["beneCategory", "No", "Optional beneficiary grouping such as vendor."],
      ["tags", "No", "Optional string tags for internal segmentation."]
    ],
    example: `POST /v1/partner/beneficiaries
x-api-key: bank-alpha-dev-key
Content-Type: application/json

{
  "bankTenantId": "bank-alpha",
  "corporateTenantId": "corp-maya-pharama-028616",
  "corporateId": "co-maya-pharama-106925",
  "actorUsername": "grvmaker",
  "beneName": "Orbit Vendor Services",
  "beneBankAccountNumber": "409876543210",
  "beneIfscCode": "HDFC0001234",
  "benePhoneNumber": "9876543210",
  "beneCategory": "vendor",
  "tags": ["preferred", "ops"]
}`,
    successResponse: `{
  "message": "Beneficiary accepted for checker approval"
}`,
    errorResponse: `{
  "message": "A beneficiary with the same name and bank account number already exists"
}`,
    notes: [
      "Header: x-api-key",
      "Creates the beneficiary in pending_approval state",
      "Beneficiary becomes usable only after checker approval"
    ]
  },
  "auth-beneficiary": {
    title: "Auth Bene",
    method: "POST",
    path: "/v1/partner/beneficiaries/:beneficiaryId/authorize",
    summary:
      "Lets an approved checker approve or reject a beneficiary created through UI or partner API.",
    fields: [
      ["actorUsername", "Yes", "Approved checker username authorizing the beneficiary."],
      ["action", "Yes", "approve or reject."],
      ["comment", "No", "Optional review comment captured with the decision."]
    ],
    example: `POST /v1/partner/beneficiaries/1234567890/authorize
x-api-key: bank-alpha-dev-key
Content-Type: application/json

{
  "actorUsername": "grvchecker",
  "action": "approve",
  "comment": "Verified beneficiary details"
}`,
    successResponse: `{
  "message": "Beneficiary authorization applied"
}`,
    errorResponse: `{
  "message": "This beneficiary is not waiting for approval"
}`,
    notes: ["Header: x-api-key", "Checker only", "Applies the same approval lifecycle used in the product UI"]
  },
  "create-transaction": {
    title: "Create Transaction",
    method: "POST",
    path: "/v1/partner/payments/transactions",
    summary:
      "Creates a transaction and auto-submits it into pending approval for checker review.",
    fields: [
      ["bankTenantId", "Yes", "Bank tenant identifier."],
      ["corporateTenantId", "Yes", "Parent corporate tenant identifier."],
      ["corporateId", "Yes", "Child corporate identifier raising the payout."],
      ["actorUsername", "Yes", "Approved maker username submitting the transaction."],
      ["txnTitle", "Yes", "Human-readable transaction title."],
      ["beneficiaryId", "Yes", "Approved and active beneficiary to pay out."],
      ["amount", "Yes", "Transaction amount object with value and INR currency."],
      ["tag", "No", "Optional operational tag."],
      ["remark", "No", "Optional transaction note."]
    ],
    example: `POST /v1/partner/payments/transactions
x-api-key: bank-alpha-dev-key
Content-Type: application/json

{
  "bankTenantId": "bank-alpha",
  "corporateTenantId": "corp-maya-pharama-028616",
  "corporateId": "co-maya-pharama-106925",
  "actorUsername": "grvmaker",
  "txnTitle": "Vendor payout for Orbit",
  "beneficiaryId": "1234567890",
  "amount": {
    "value": 12500,
    "currency": "INR"
  }
}`,
    successResponse: `{
  "message": "Transaction created and submitted for checker approval"
}`,
    errorResponse: `{
  "message": "Beneficiary is inactive and cannot be used for transaction creation"
}`,
    notes: ["Header: x-api-key", "Maker only", "Transaction is created and immediately moved to pending_approval"]
  },
  "auth-transaction": {
    title: "Auth Payment",
    method: "POST",
    path: "/v1/partner/payments/transactions/:batchId/authorize",
    summary:
      "Lets an approved checker authorize or reject a pending transaction created by maker or partner API.",
    fields: [
      ["actorUsername", "Yes", "Approved checker username authorizing the transaction."],
      ["action", "Yes", "approve or reject."],
      ["comment", "No", "Optional checker note stored on the approval trail."]
    ],
    example: `POST /v1/partner/payments/transactions/txn-1747485000000-001/authorize
x-api-key: bank-alpha-dev-key
Content-Type: application/json

{
  "actorUsername": "grvchecker",
  "action": "approve",
  "comment": "Budget and beneficiary verified"
}`,
    successResponse: `{
  "message": "Transaction authorization applied"
}`,
    errorResponse: `{
  "message": "Invalid transaction state transition"
}`,
    notes: ["Header: x-api-key", "Checker only", "Uses the same approval logic as the product UI"]
  },
  "get-transaction-status": {
    title: "Get Transaction Status",
    method: "GET",
    path: "/v1/partner/payments/transactions/:batchId/status",
    summary:
      "Fetches the current state and key timestamps of a previously created transaction.",
    fields: [
      ["batchId", "Yes", "Transaction batch identifier used as the path parameter."],
      ["x-api-key", "Yes", "Partner API key passed in the request header."],
      ["Request body", "No", "No request body is required for this API."]
    ],
    example: `GET /v1/partner/payments/transactions/txn-1747485000000-001/status
x-api-key: bank-alpha-dev-key`,
    successResponse: `{
  "message": "Transaction status fetched successfully"
}`,
    errorResponse: `{
  "message": "Transaction not found"
}`,
    notes: ["Header: x-api-key", "Read-only transaction tracking API", "Useful for partner systems polling payment state after creation"]
  }
};

export function DeveloperPortalPageClient({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [selectedSection, setSelectedSection] = useState("create-beneficiary");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function handleCopy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({
    label: "",
    productScope: "all",
    createdBy: "bank-ops-001"
  });
  const [apiKeyOutput, setApiKeyOutput] = useState("Ready.");
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [supportedWebhookEvents, setSupportedWebhookEvents] = useState<string[]>([]);
  const [selectedWebhookPresets, setSelectedWebhookPresets] = useState<string[]>([]);
  const [webhookForm, setWebhookForm] = useState({
    label: "",
    webhookUrl: "",
    description: ""
  });
  const [webhookOutput, setWebhookOutput] = useState("Ready.");

  useEffect(() => {
    void loadApiKeys();
    void loadWebhooks();
  }, []);

  const definition = apiDefinitions[selectedSection];

  async function loadApiKeys() {
    try {
      const response = await fetchJson<{ items: ApiKeyItem[] }>("/bank/dev-portal/api-keys");
      setApiKeys(response.items ?? []);
    } catch (error) {
      setApiKeyOutput(error instanceof Error ? error.message : "Unable to load active keys.");
    }
  }

  async function loadWebhooks() {
    try {
      const [webhooksResponse, deliveriesResponse] = await Promise.all([
        fetchJson<{ items: WebhookItem[]; supportedEvents: string[] }>("/bank/dev-portal/webhooks"),
        fetchJson<{ items: WebhookDelivery[] }>("/bank/dev-portal/webhook-deliveries")
      ]);

      setWebhooks(webhooksResponse.items ?? []);
      setSupportedWebhookEvents(webhooksResponse.supportedEvents ?? []);
      setDeliveries(deliveriesResponse.items ?? []);
    } catch (error) {
      setWebhookOutput(error instanceof Error ? error.message : "Unable to load webhooks.");
    }
  }

  async function onGenerateApiKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiKeyOutput("Generating key...");

    try {
      const response = await fetch("/bank/dev-portal/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(apiKeyForm)
      });

      const data = await response.json().catch(() => ({}));
      setApiKeyOutput(JSON.stringify(data, null, 2));

      if (response.ok) {
        setApiKeyForm({
          label: "",
          productScope: "all",
          createdBy: "bank-ops-001"
        });
        await loadApiKeys();
      }
    } catch (error) {
      setApiKeyOutput(error instanceof Error ? error.message : "Unable to generate API key.");
    }
  }

  async function onRegisterWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebhookOutput("Registering webhook...");

    try {
      const eventTypes = selectedWebhookPresets.flatMap((key) => {
        const preset = webhookEventPresets.find((item) => item.key === key);
        return preset ? [...preset.eventTypes] : [];
      });

      const response = await fetch("/bank/dev-portal/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...webhookForm,
          eventTypes: [...new Set(eventTypes)]
        })
      });

      const data = await response.json().catch(() => ({}));
      setWebhookOutput(JSON.stringify(data, null, 2));

      if (response.ok) {
        setWebhookForm({
          label: "",
          webhookUrl: "",
          description: ""
        });
        setSelectedWebhookPresets([]);
        await loadWebhooks();
      }
    } catch (error) {
      setWebhookOutput(error instanceof Error ? error.message : "Unable to register webhook.");
    }
  }

  async function toggleWebhookStatus(webhookId: string, status: "active" | "inactive") {
    const response = await fetch(`/bank/dev-portal/webhooks/${encodeURIComponent(webhookId)}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const data = await response.json().catch(() => ({}));
    setWebhookOutput(JSON.stringify(data, null, 2));
    await loadWebhooks();
  }

  const visiblePresets =
    supportedWebhookEvents.length > 0
      ? webhookEventPresets.filter((preset) =>
          preset.eventTypes.every((eventType) => supportedWebhookEvents.includes(eventType))
        )
      : webhookEventPresets;

  return (
    <>
      <section className="docs-layout">
        <aside className="api-nav-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Products</p>
              <h2>Navigation</h2>
            </div>
          </div>

          <div className="api-menu">
            <section className="api-group">
              <h3>Beneficiary</h3>
              <button className={selectedSection === "create-beneficiary" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("create-beneficiary")} type="button">Create Bene</button>
              <button className={selectedSection === "auth-beneficiary" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("auth-beneficiary")} type="button">Auth Bene</button>
            </section>

            <section className="api-group">
              <h3>Payments</h3>
              <button className={selectedSection === "create-transaction" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("create-transaction")} type="button">Make Payment</button>
              <button className={selectedSection === "auth-transaction" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("auth-transaction")} type="button">Auth Payment</button>
              <button className={selectedSection === "get-transaction-status" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("get-transaction-status")} type="button">Get Transaction Status</button>
            </section>

            <section className="api-group">
              <h3>Platform</h3>
              <button className={selectedSection === "api-keys" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("api-keys")} type="button">Generate API Key</button>
              <button className={selectedSection === "webhooks" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("webhooks")} type="button">Register Webhook</button>
            </section>
          </div>
        </aside>

        {definition ? (
          <article className="docs-panel">
            {/* Left Column: API Documentation details */}
            <div className="docs-panel-left" style={{ width: "100%", maxWidth: "none" }}>
              <div className="panel-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <p className="section-kicker">Partner API</p>
                  <h2>{definition.title}</h2>
                  <div className="api-path-badge-container">
                    <span className={`method-badge ${definition.method.toLowerCase()}`}>{definition.method}</span>
                    <code className="path-text">{definition.path}</code>
                  </div>
                </div>
                <div className="docs-actions" style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "8px" }}>
                  <a className="cta-text-link" href="/bank/dev-portal/openapi/swagger-download">
                    <span className="cta-icon">↓</span>
                    <span>Download Swagger</span>
                  </a>
                </div>
              </div>

              <p className="lead compact-lead" style={{ marginTop: "14px", marginBottom: "20px" }}>{definition.summary}</p>

              <div className="detail-grid">
                <div className="detail-card">
                  <strong>Auth</strong>
                  <p>Header: <code>x-api-key</code></p>
                  <p>Use the bank-provisioned partner API key for authentication.</p>
                </div>
                <div className="detail-card">
                  <strong>Usage Notes</strong>
                  <ul className="docs-list">
                    {definition.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="docs-block">
                <h3>Request Fields</h3>
                <div className="property-list">
                  {definition.fields.map(([field, required, description]) => (
                    <div key={field} className="property-item">
                      <div className="property-header">
                        <code className="property-name">{field}</code>
                        <span className="property-type">string</span>
                        <span className={`property-req ${required.toLowerCase() === 'yes' ? 'required' : 'optional'}`}>
                          {required.toLowerCase() === 'yes' ? 'required' : 'optional'}
                        </span>
                      </div>
                      <p className="property-desc">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section: API Playground (Full Width, split into two halves) */}
            <div className="playground-bottom-grid">
              {/* Left Column: Request Example */}
              <div className="playground-column-left">
                <div className="code-container" style={{ height: "100%" }}>
                  <div className="code-header">
                    <span>Request Example</span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => handleCopy(definition.example, 'req')}
                    >
                      {copiedKey === 'req' ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre style={{ height: "calc(100% - 32px)", maxHeight: "none" }}>{definition.example}</pre>
                </div>
              </div>

              {/* Right Column: Success & Error Responses */}
              <div className="playground-column-right">
                <div className="code-container">
                  <div className="code-header">
                    <span>Sample Success Response</span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => handleCopy(definition.successResponse, 'success')}
                    >
                      {copiedKey === 'success' ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>{definition.successResponse}</pre>
                </div>

                <div className="code-container">
                  <div className="code-header">
                    <span>Sample Error Response</span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => handleCopy(definition.errorResponse, 'error')}
                    >
                      {copiedKey === 'error' ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>{definition.errorResponse}</pre>
                </div>
              </div>
            </div>
          </article>
        ) : null}

        {selectedSection === "api-keys" ? (
          <article className="docs-panel">
            <div className="docs-panel-grid">
              {/* Left Column: Form Controls */}
              <div className="docs-panel-left">
                <div className="panel-head" style={{ marginBottom: "20px" }}>
                  <div>
                    <p className="section-kicker">API Keys</p>
                    <h2>Generate and manage keys</h2>
                  </div>
                </div>

                <form className="action-form" onSubmit={onGenerateApiKey}>
                  <div className="action-grid">
                    <label>
                      <span>Label</span>
                      <input value={apiKeyForm.label} onChange={(event) => setApiKeyForm((current) => ({ ...current, label: event.target.value }))} placeholder="Maya Pharma production key" />
                    </label>
                    <label>
                      <span>Scope</span>
                      <select value={apiKeyForm.productScope} onChange={(event) => setApiKeyForm((current) => ({ ...current, productScope: event.target.value }))}>
                        <option value="all">All products</option>
                        <option value="beneficiary">Beneficiary</option>
                        <option value="payments">Payments</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Generated by</span>
                    <input value={apiKeyForm.createdBy} onChange={(event) => setApiKeyForm((current) => ({ ...current, createdBy: event.target.value }))} />
                  </label>

                  <div className="action-buttons">
                    <button className="button button-primary">Generate API Key</button>
                  </div>
                </form>

                {apiKeyOutput !== "Ready." && (
                  <div className="code-container" style={{ marginTop: "24px" }}>
                    <div className="code-header">
                      <span>Result Console</span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopy(apiKeyOutput, 'apiKeyResult')}
                      >
                        {copiedKey === 'apiKeyResult' ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <pre style={{ maxHeight: "200px" }}>{apiKeyOutput}</pre>
                  </div>
                )}
              </div>

              {/* Right Column: Active Keys */}
              <div className="key-management-list">
                <h3 className="ops-widget-title" style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 600 }}>
                  Active keys
                </h3>
                <div className="queue-list" style={{ marginTop: 0 }}>
                  {apiKeys.length === 0 ? (
                    <div className="empty-state">No active keys yet.</div>
                  ) : (
                    apiKeys.map((item) => (
                      <article key={item.keyId} className="key-card">
                        <div className="key-card-row">
                          <strong>{item.label}</strong>
                          <span className="state-pill">{item.status}</span>
                        </div>
                        <div className="key-copy-row">
                          <span className="key-copy-text">{item.maskedKey}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            style={{ padding: "2px 6px", background: "var(--surface)", border: "1px solid var(--border)" }}
                            onClick={() => handleCopy(item.maskedKey, item.keyId)}
                          >
                            {copiedKey === item.keyId ? "✓" : "Copy"}
                          </button>
                        </div>
                        <p className="queue-meta" style={{ marginTop: "8px" }}>
                          Scope: {item.productScope} | Created by: {item.createdBy ?? "system"}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </article>
        ) : null}

        {selectedSection === "webhooks" ? (
          <article className="docs-panel">
            <div className="docs-panel-grid">
              {/* Left Column: Register webhook form */}
              <div className="docs-panel-left">
                <div className="panel-head" style={{ marginBottom: "20px" }}>
                  <div>
                    <p className="section-kicker">Webhooks</p>
                    <h2>Register webhooks</h2>
                    <p className="api-meta" style={{ marginTop: "4px" }}>
                      Create callback endpoints for partner events and monitor recent deliveries.
                    </p>
                  </div>
                </div>

                <form className="action-form" onSubmit={onRegisterWebhook}>
                  <label>
                    <span>Label</span>
                    <input value={webhookForm.label} onChange={(event) => setWebhookForm((current) => ({ ...current, label: event.target.value }))} placeholder="Maya Pharma production webhook" />
                  </label>

                  <label>
                    <span>Webhook URL</span>
                    <input required value={webhookForm.webhookUrl} onChange={(event) => setWebhookForm((current) => ({ ...current, webhookUrl: event.target.value }))} placeholder="https://partner.example.com/future-pay/webhooks" />
                  </label>

                  <label>
                    <span>Description</span>
                    <textarea value={webhookForm.description} onChange={(event) => setWebhookForm((current) => ({ ...current, description: event.target.value }))} />
                  </label>

                  <fieldset className="action-fieldset">
                    <legend>Subscriptions</legend>
                    <div className="selected-chip-list">
                      {visiblePresets.map((preset) => {
                        const selected = selectedWebhookPresets.includes(preset.key);
                        return (
                          <button
                            key={preset.key}
                            className="selected-chip"
                            onClick={() =>
                              setSelectedWebhookPresets((current) =>
                                selected
                                  ? current.filter((item) => item !== preset.key)
                                  : [...current, preset.key]
                              )
                            }
                            type="button"
                          >
                            <span>{preset.label}</span>
                            <strong>{selected ? "Selected" : "Add"}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="action-buttons">
                    <button className="button button-primary">Register webhook</button>
                  </div>
                </form>

                {webhookOutput !== "Ready." && (
                  <div className="code-container" style={{ marginTop: "24px" }}>
                    <div className="code-header">
                      <span>Result Console</span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopy(webhookOutput, 'webhookResult')}
                      >
                        {copiedKey === 'webhookResult' ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <pre style={{ maxHeight: "200px" }}>{webhookOutput}</pre>
                  </div>
                )}
              </div>

              {/* Right Column: Webhooks and delivery logs */}
              <div className="key-management-list">
                <h3 className="ops-widget-title" style={{ margin: 0, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 600 }}>
                  Registered webhooks
                </h3>
                <div className="queue-list" style={{ marginTop: 0 }}>
                  {webhooks.length === 0 ? (
                    <div className="empty-state">No webhooks registered yet.</div>
                  ) : (
                    webhooks.map((item) => (
                      <article key={item.webhookId} className="key-card">
                        <div className="key-card-row">
                          <strong>{item.label}</strong>
                          <span className="state-pill">{item.status}</span>
                        </div>
                        <p className="queue-meta" style={{ fontWeight: 500, color: "var(--ink)", wordBreak: "break-all", marginTop: "4px" }}>{item.webhookUrl}</p>
                        <p className="queue-meta" style={{ marginTop: "4px" }}>
                          Subscriptions: {summarizeWebhookSubscriptions(item.eventTypes)}
                        </p>
                        <div className="key-copy-row" style={{ marginTop: "6px" }}>
                          <span className="key-copy-text" style={{ fontSize: "11px" }}>Secret: {item.maskedSigningSecret}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            style={{ padding: "2px 6px", background: "var(--surface)", border: "1px solid var(--border)" }}
                            onClick={() => handleCopy(item.maskedSigningSecret, item.webhookId)}
                          >
                            {copiedKey === item.webhookId ? "✓" : "Copy"}
                          </button>
                        </div>
                        <p className="queue-meta" style={{ marginTop: "6px" }}>
                          Last delivery:{" "}
                          {item.lastDeliveryStatus
                            ? `${item.lastDeliveryStatus}${
                                item.lastDeliveryHttpStatus
                                  ? ` (${item.lastDeliveryHttpStatus})`
                                  : ""
                              }`
                            : "No delivery yet"}
                        </p>
                        <div className="action-buttons compact-actions" style={{ marginTop: "8px" }}>
                          <button
                            className="mini-button"
                            onClick={() =>
                              void toggleWebhookStatus(
                                item.webhookId,
                                item.status === "active" ? "inactive" : "active"
                              )
                            }
                            type="button"
                            style={{ width: "100%", height: "30px", fontSize: "12px" }}
                          >
                            {item.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <h3 className="ops-widget-title" style={{ margin: "16px 0 0 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 600 }}>
                  Recent delivery logs
                </h3>
                <div className="queue-list" style={{ marginTop: 0 }}>
                  {deliveries.length === 0 ? (
                    <div className="empty-state">No delivery attempts yet.</div>
                  ) : (
                    deliveries.slice(0, 5).map((item) => (
                      <article key={item.deliveryId} className="key-card">
                        <div className="key-card-row">
                          <strong>{item.eventType}</strong>
                          <span className="state-pill">{item.status}</span>
                        </div>
                        <p className="queue-meta" style={{ wordBreak: "break-all", marginTop: "4px" }}>{item.targetUrl}</p>
                        <p className="queue-meta" style={{ marginTop: "4px" }}>
                          Response: {item.responseStatus ?? "N/A"}
                          {item.responseBody ? ` | ${item.responseBody}` : ""}
                        </p>
                        <p className="queue-meta" style={{ fontSize: "11px", marginTop: "4px" }}>
                          {item.attemptedAt ? new Date(item.attemptedAt).toLocaleString() : "Unknown"}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </article>
        ) : null}
      </section>
    </>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function summarizeWebhookSubscriptions(eventTypes: string[]) {
  const activeLabels = webhookEventPresets
    .filter((preset) => preset.eventTypes.every((eventType) => eventTypes.includes(eventType)))
    .map((preset) => preset.label);

  return activeLabels.join(", ") || "None selected";
}
