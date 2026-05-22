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

export function DeveloperPortalPageClient() {
  const [selectedSection, setSelectedSection] = useState("create-beneficiary");
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
      <section className="hero">
        <div>
          <p className="eyebrow">Bank Ops Web</p>
          <h1>Developer Portal</h1>
          <p className="lead">
            Publish partner-facing beneficiary and payment APIs, issue API keys, and manage
            webhook subscriptions from a first-class bank operations surface.
          </p>
          <div className="hero-tags">
            <span>Partner APIs</span>
            <span>API key protected</span>
            <span>Webhook management</span>
          </div>
        </div>

        <aside className="hero-side">
          <div className="hero-card">
            <span className="hero-card-label">Published products</span>
            <strong>Beneficiary + Payments</strong>
            <p>Document the maker-checker lifecycle and manage partner access from one place.</p>
          </div>
        </aside>
      </section>

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
            <div className="panel-head">
              <div>
                <p className="section-kicker">Partner API</p>
                <h2>{definition.title}</h2>
                <p className="api-meta">
                  {definition.method} {definition.path}
                </p>
              </div>
              <div className="docs-actions">
                <a className="mini-button docs-link" href="/bank/dev-portal/openapi/catalog" target="_blank" rel="noreferrer">
                  Open API catalog
                </a>
                <a className="mini-button docs-link" href="/bank/dev-portal/openapi/swagger-download">
                  Download Swagger
                </a>
              </div>
            </div>

            <p className="lead compact-lead">{definition.summary}</p>

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
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {definition.fields.map(([field, required, description]) => (
                    <tr key={field}>
                      <td><code>{field}</code></td>
                      <td>{required}</td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="detail-card">
              <strong>Request Example</strong>
              <pre className="response-box">{definition.example}</pre>
            </section>

            <div className="detail-grid response-grid">
              <section className="detail-card">
                <strong>Sample Success Response</strong>
                <pre className="response-box response-box-compact">{definition.successResponse}</pre>
              </section>
              <section className="detail-card">
                <strong>Sample Error Response</strong>
                <pre className="response-box response-box-compact">{definition.errorResponse}</pre>
              </section>
            </div>
          </article>
        ) : null}

        {selectedSection === "api-keys" ? (
          <article className="docs-panel">
            <div className="panel-head">
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

            <pre className="response-box">{apiKeyOutput}</pre>

            <div className="docs-block">
              <h3>Active keys</h3>
              <div className="queue-list">
                {apiKeys.length === 0 ? (
                  <div className="empty-state">No active keys yet.</div>
                ) : (
                  apiKeys.map((item) => (
                    <article key={item.keyId} className="key-card">
                      <div className="key-card-row">
                        <strong>{item.label}</strong>
                        <span className="state-pill">{item.status}</span>
                      </div>
                      <p className="queue-meta">{item.maskedKey}</p>
                      <p className="queue-meta">
                        Scope: {item.productScope} | Created by: {item.createdBy ?? "system"}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </article>
        ) : null}

        {selectedSection === "webhooks" ? (
          <article className="docs-panel">
            <div className="panel-head">
              <div>
                <p className="section-kicker">Webhooks</p>
                <h2>Register and manage webhooks</h2>
                <p className="api-meta">
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

            <pre className="response-box">{webhookOutput}</pre>

            <div className="detail-grid">
              <section className="detail-card">
                <strong>Registered webhooks</strong>
                <div className="queue-list">
                  {webhooks.length === 0 ? (
                    <div className="empty-state">No webhooks registered yet.</div>
                  ) : (
                    webhooks.map((item) => (
                      <article key={item.webhookId} className="key-card">
                        <div className="key-card-row">
                          <strong>{item.label}</strong>
                          <span className="state-pill">{item.status}</span>
                        </div>
                        <p className="queue-meta">{item.webhookUrl}</p>
                        <p className="queue-meta">
                          Subscriptions: {summarizeWebhookSubscriptions(item.eventTypes)}
                        </p>
                        <p className="queue-meta">Secret: {item.maskedSigningSecret}</p>
                        <p className="queue-meta">
                          Last delivery:{" "}
                          {item.lastDeliveryStatus
                            ? `${item.lastDeliveryStatus}${
                                item.lastDeliveryHttpStatus
                                  ? ` (${item.lastDeliveryHttpStatus})`
                                  : ""
                              }`
                            : "No delivery yet"}
                        </p>
                        <div className="action-buttons compact-actions">
                          <button
                            className="mini-button"
                            onClick={() =>
                              void toggleWebhookStatus(
                                item.webhookId,
                                item.status === "active" ? "inactive" : "active"
                              )
                            }
                            type="button"
                          >
                            {item.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
              <section className="detail-card">
                <strong>Recent delivery logs</strong>
                <div className="queue-list">
                  {deliveries.length === 0 ? (
                    <div className="empty-state">No delivery attempts yet.</div>
                  ) : (
                    deliveries.map((item) => (
                      <article key={item.deliveryId} className="key-card">
                        <div className="key-card-row">
                          <strong>{item.eventType}</strong>
                          <span className="state-pill">{item.status}</span>
                        </div>
                        <p className="queue-meta">{item.targetUrl}</p>
                        <p className="queue-meta">Webhook: {item.webhookId}</p>
                        <p className="queue-meta">
                          Response: {item.responseStatus ?? "N/A"}
                          {item.responseBody ? ` | ${item.responseBody}` : ""}
                        </p>
                        <p className="queue-meta">
                          Attempted: {item.attemptedAt ? new Date(item.attemptedAt).toLocaleString() : "Unknown"}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
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
