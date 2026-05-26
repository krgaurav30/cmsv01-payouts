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
      ["packageCode", "Yes", "Workspace package code (e.g., ZELPAY or MAINPAY)."],
      ["debitAccountId", "No", "Optional debit account identifier. If omitted, resolved via default debit account of the package/subscription."],
      ["paymentMethodCode", "No", "Optional payment method code (e.g., IMPS, NEFT, RTGS)."],
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
  },
  "packageCode": "ZELPAY",
  "debitAccountId": "debit-maya-main-001",
  "paymentMethodCode": "IMPS"
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

  // Interactive Playground states
  const [activeRequestTab, setActiveRequestTab] = useState<"example" | "playground">("example");
  const [activeResponseTab, setActiveResponseTab] = useState<"sample" | "live">("sample");
  const [playgroundKeys, setPlaygroundKeys] = useState<Array<{ label: string; key: string }>>([
    { label: "Demo Key (bank-alpha-dev-key)", key: "bank-alpha-dev-key" }
  ]);
  const [playgroundApiKey, setPlaygroundApiKey] = useState("bank-alpha-dev-key");
  const [customApiKeyVal, setCustomApiKeyVal] = useState("");
  const [playgroundPathParams, setPlaygroundPathParams] = useState<Record<string, string>>({});
  const [playgroundPayloadJson, setPlaygroundPayloadJson] = useState("");
  const [playgroundResponse, setPlaygroundResponse] = useState<{
    status: number;
    statusText: string;
    data: any;
  } | null>(null);
  const [playgroundIsLoading, setPlaygroundIsLoading] = useState(false);
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

  // Activity log states
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesIsLoading, setActivitiesIsLoading] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedActivityDetails, setSelectedActivityDetails] = useState<any | null>(null);
  const [selectedActivityIsLoading, setSelectedActivityIsLoading] = useState(false);
  const [activityFilterStatus, setActivityFilterStatus] = useState<"all" | "success" | "error">("all");
  const [activitySearchTerm, setActivitySearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    request: true,
    response: true
  });
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineIsLoading, setTimelineIsLoading] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const toggleStep = (stepKey: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  async function loadActivities(category: "beneficiary" | "payment") {
    setActivitiesIsLoading(true);
    try {
      const response = await fetchJson<{ items: any[] }>(
        `/bank/dev-portal/activities?category=${category}&limit=50`
      );
      setActivities(response.items ?? []);
    } catch (err) {
      console.error("Failed to load developer portal activities:", err);
    } finally {
      setActivitiesIsLoading(false);
    }
  }

  async function loadActivityDetails(activityId: string) {
    setSelectedActivityIsLoading(true);
    try {
      const response = await fetchJson<{ activity: any; webhookDeliveries: any[] }>(
        `/bank/dev-portal/activities/${encodeURIComponent(activityId)}`
      );
      setSelectedActivityDetails(response);
    } catch (err) {
      console.error("Failed to load activity details:", err);
    } finally {
      setSelectedActivityIsLoading(false);
    }
  }

  useEffect(() => {
    if (selectedSection === "activity-beneficiary") {
      void loadActivities("beneficiary");
      setSelectedActivityId(null);
      setSelectedActivityDetails(null);
      setSelectedGroup(null);
      setTimelineData([]);
    } else if (selectedSection === "activity-payment") {
      void loadActivities("payment");
      setSelectedActivityId(null);
      setSelectedActivityDetails(null);
      setSelectedGroup(null);
      setTimelineData([]);
    }
  }, [selectedSection]);

  useEffect(() => {
    if (selectedActivityId) {
      void loadActivityDetails(selectedActivityId);
    } else {
      setSelectedActivityDetails(null);
    }
  }, [selectedActivityId]);

  useEffect(() => {
    if (!selectedGroup) {
      setTimelineData([]);
      return;
    }

    async function loadTimeline() {
      setTimelineIsLoading(true);
      try {
        const promises = selectedGroup.allActivities.map((act: any) =>
          fetchJson<{ activity: any; webhookDeliveries: any[] }>(
            `/bank/dev-portal/activities/${encodeURIComponent(act.activityId)}`
          )
        );
        const detailsList = await Promise.all(promises);
        setTimelineData(detailsList);
      } catch (err) {
        console.error("Failed to load timeline details:", err);
      } finally {
        setTimelineIsLoading(false);
      }
    }

    void loadTimeline();
  }, [selectedGroup]);

  const filteredActivities = activities.filter((act) => {
    if (activityFilterStatus === "success") {
      if (act.responseStatus < 200 || act.responseStatus >= 300) return false;
    } else if (activityFilterStatus === "error") {
      if (act.responseStatus >= 200 && act.responseStatus < 300) return false;
    }

    if (activitySearchTerm.trim()) {
      const term = activitySearchTerm.toLowerCase();
      const matchesId = String(act.activityId).toLowerCase().includes(term);
      const matchesPath = String(act.path).toLowerCase().includes(term);
      const matchesName = String(act.apiName).toLowerCase().includes(term);
      return matchesId || matchesPath || matchesName;
    }

    return true;
  });

  useEffect(() => {
    void loadApiKeys();
    void loadWebhooks();
  }, []);

  const definition = apiDefinitions[selectedSection];

  useEffect(() => {
    if (!definition) return;
    setActiveRequestTab("example");
    setActiveResponseTab("sample");
    setPlaygroundResponse(null);

    const jsonBody = extractJsonFromExample(definition.example);
    setPlaygroundPayloadJson(jsonBody);

    const paramRegex = /:([a-zA-Z0-9_]+)/g;
    const params: Record<string, string> = {};
    let match;
    while ((match = paramRegex.exec(definition.path)) !== null) {
      params[match[1]] = "";
    }
    setPlaygroundPathParams(params);
  }, [selectedSection, definition]);

  async function handleSendPlaygroundRequest() {
    setPlaygroundIsLoading(true);
    setPlaygroundResponse(null);
    setActiveResponseTab("live");

    try {
      let key = playgroundApiKey;
      if (key === "custom") {
        key = customApiKeyVal;
      }

      let targetPath = definition.path;
      Object.entries(playgroundPathParams).forEach(([paramName, paramVal]) => {
        targetPath = targetPath.replace(`:${paramName}`, encodeURIComponent(paramVal));
      });

      let bodyVal: any = undefined;
      if (definition.method !== "GET" && playgroundPayloadJson) {
        try {
          bodyVal = JSON.parse(playgroundPayloadJson);
        } catch (jsonErr) {
          throw new Error("Invalid request JSON: " + (jsonErr instanceof Error ? jsonErr.message : String(jsonErr)));
        }
      }

      const response = await fetch(targetPath, {
        method: definition.method,
        headers: {
          "x-api-key": key,
          "Content-Type": "application/json"
        },
        body: bodyVal ? JSON.stringify(bodyVal) : undefined
      });

      const text = await response.text();
      let jsonData: any = null;
      try {
        jsonData = JSON.parse(text);
      } catch {
        jsonData = { rawResponse: text };
      }

      setPlaygroundResponse({
        status: response.status,
        statusText: response.statusText,
        data: jsonData
      });
    } catch (err) {
      setPlaygroundResponse({
        status: 0,
        statusText: "Error",
        data: { error: err instanceof Error ? err.message : String(err) }
      });
    } finally {
      setPlaygroundIsLoading(false);
    }
  }

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
        if (data.apiKey) {
          const newKey = { label: data.label || "Generated Key", key: data.apiKey };
          setPlaygroundKeys((current) => [...current.filter((k) => k.key !== data.apiKey), newKey]);
          setPlaygroundApiKey(data.apiKey);
        }
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

  const groupedActivities = groupActivities(filteredActivities);

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

            <section className="api-group">
              <h3>Activity</h3>
              <button className={selectedSection === "activity-beneficiary" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("activity-beneficiary")} type="button">Beneficiary Logs</button>
              <button className={selectedSection === "activity-payment" ? "api-link api-link-active" : "api-link"} onClick={() => setSelectedSection("activity-payment")} type="button">Payment Logs</button>
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
              {/* Left Column: Request tabs & content */}
              <div className="playground-column-left">
                <div className="code-container" style={{ height: "100%" }}>
                  <div className="code-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: activeRequestTab === "example" ? "#F1F5F9" : "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          padding: "4px 0",
                          borderBottom: activeRequestTab === "example" ? "2px solid #10B981" : "2px solid transparent"
                        }}
                        onClick={() => setActiveRequestTab("example")}
                      >
                        Request Example
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: activeRequestTab === "playground" ? "#F1F5F9" : "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          padding: "4px 0",
                          borderBottom: activeRequestTab === "playground" ? "2px solid #10B981" : "2px solid transparent"
                        }}
                        onClick={() => setActiveRequestTab("playground")}
                      >
                        API Playground
                      </button>
                    </div>
                    {activeRequestTab === "example" && (
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopy(definition.example, 'req')}
                      >
                        {copiedKey === 'req' ? "✓ Copied" : "Copy"}
                      </button>
                    )}
                  </div>

                  {activeRequestTab === "example" ? (
                    <pre style={{ height: "calc(100% - 32px)", maxHeight: "none" }}>{definition.example}</pre>
                  ) : (
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", background: "#0B0F19", color: "#E2E8F0" }}>
                      {/* API Key Selection */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>x-api-key Header</span>
                        <select
                          value={playgroundApiKey}
                          onChange={(e) => setPlaygroundApiKey(e.target.value)}
                          style={{
                            background: "#1E293B",
                            color: "#E2E8F0",
                            border: "1px solid #334155",
                            height: "36px",
                            borderRadius: "6px",
                            padding: "0 10px",
                            width: "100%"
                          }}
                        >
                          {playgroundKeys.map((k) => (
                            <option key={k.key} value={k.key}>
                              {k.label} ({k.key.slice(0, 8)}...)
                            </option>
                          ))}
                          <option value="custom">Custom key...</option>
                        </select>
                        {playgroundApiKey === "custom" && (
                          <input
                            value={customApiKeyVal}
                            onChange={(e) => setCustomApiKeyVal(e.target.value)}
                            placeholder="Enter raw api key (e.g. cms_live_...)"
                            style={{
                              background: "#1E293B",
                              color: "#E2E8F0",
                              border: "1px solid #334155",
                              height: "36px",
                              borderRadius: "6px",
                              padding: "0 10px",
                              marginTop: "6px",
                              width: "100%"
                            }}
                          />
                        )}
                      </div>

                      {/* Path Parameters Section */}
                      {Object.keys(playgroundPathParams).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #1E293B", paddingTop: "14px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Path Parameters</span>
                          {Object.entries(playgroundPathParams).map(([paramName, paramVal]) => (
                            <div key={paramName} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <label style={{ fontSize: "12px", color: "#94A3B8" }}>
                                {paramName}
                              </label>
                              <input
                                value={paramVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPlaygroundPathParams((prev) => ({ ...prev, [paramName]: val }));
                                }}
                                placeholder={`Value for :${paramName}`}
                                style={{
                                  background: "#1E293B",
                                  color: "#E2E8F0",
                                  border: "1px solid #334155",
                                  height: "36px",
                                  borderRadius: "6px",
                                  padding: "0 10px",
                                  width: "100%"
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Request JSON Payload Editor */}
                      {definition.method !== "GET" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #1E293B", paddingTop: "14px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Request Body (JSON)</span>
                          <textarea
                            value={playgroundPayloadJson}
                            onChange={(e) => setPlaygroundPayloadJson(e.target.value)}
                            rows={10}
                            style={{
                              fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                              fontSize: "12px",
                              background: "#1E293B",
                              color: "#F8FAFC",
                              border: "1px solid #334155",
                              borderRadius: "6px",
                              padding: "12px",
                              resize: "vertical",
                              width: "100%",
                              lineHeight: "1.5"
                            }}
                          />
                        </div>
                      )}

                      {/* Send Request Button */}
                      <div style={{ borderTop: "1px solid #1E293B", paddingTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={handleSendPlaygroundRequest}
                          disabled={playgroundIsLoading}
                          style={{
                            background: "#10B981",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            height: "36px",
                            padding: "0 20px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            opacity: playgroundIsLoading ? 0.7 : 1
                          }}
                        >
                          {playgroundIsLoading ? (
                            <>
                              <span className="spinner" style={{ border: "2px solid #fff", borderTopColor: "transparent", width: "12px", height: "12px", borderRadius: "50%", display: "inline-block" }}></span>
                              Sending...
                            </>
                          ) : (
                            "Send Request"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Response tabs & content */}
              <div className="playground-column-right">
                <div className="code-container" style={{ height: "100%", minHeight: "350px" }}>
                  <div className="code-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: activeResponseTab === "sample" ? "#F1F5F9" : "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          padding: "4px 0",
                          borderBottom: activeResponseTab === "sample" ? "2px solid #10B981" : "2px solid transparent"
                        }}
                        onClick={() => setActiveResponseTab("sample")}
                      >
                        Sample Responses
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: activeResponseTab === "live" ? "#F1F5F9" : "#64748B",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          padding: "4px 0",
                          borderBottom: activeResponseTab === "live" ? "2px solid #10B981" : "2px solid transparent"
                        }}
                        onClick={() => setActiveResponseTab("live")}
                      >
                        Live Response
                      </button>
                    </div>
                    {activeResponseTab === "live" && playgroundResponse && (
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopy(JSON.stringify(playgroundResponse.data, null, 2), 'liveResp')}
                      >
                        {copiedKey === 'liveResp' ? "✓ Copied" : "Copy"}
                      </button>
                    )}
                  </div>

                  {activeResponseTab === "sample" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", background: "#0B0F19" }}>
                      <div className="code-container" style={{ border: "1px solid #1E293B" }}>
                        <div className="code-header" style={{ borderBottom: "1px solid #1E293B" }}>
                          <span>Sample Success Response</span>
                        </div>
                        <pre style={{ margin: 0, maxHeight: "150px" }}>{definition.successResponse}</pre>
                      </div>

                      <div className="code-container" style={{ border: "1px solid #1E293B" }}>
                        <div className="code-header" style={{ borderBottom: "1px solid #1E293B" }}>
                          <span>Sample Error Response</span>
                        </div>
                        <pre style={{ margin: 0, maxHeight: "150px" }}>{definition.errorResponse}</pre>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "#0B0F19", height: "100%", minHeight: "250px", display: "flex", flexDirection: "column" }}>
                      {playgroundIsLoading && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "250px", gap: "12px" }}>
                          <div className="spinner" style={{ width: "24px", height: "24px", border: "3px solid #10B981", borderTopColor: "transparent", borderRadius: "50%" }}></div>
                          <span style={{ color: "#64748B", fontSize: "13px" }}>Waiting for response...</span>
                        </div>
                      )}

                      {!playgroundIsLoading && !playgroundResponse && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "250px", padding: "24px", textAlign: "center" }}>
                          <span style={{ color: "#64748B", fontSize: "28px", marginBottom: "8px" }}>⚡</span>
                          <span style={{ color: "#64748B", fontSize: "13px", fontWeight: 500 }}>Live Response Console</span>
                          <span style={{ color: "#475569", fontSize: "12px", marginTop: "4px", maxWidth: "250px" }}>
                            Select a raw API Key, edit the parameters, and click "Send Request" to see real-time output.
                          </span>
                        </div>
                      )}

                      {!playgroundIsLoading && playgroundResponse && (
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 16px",
                            background: "#111827",
                            borderBottom: "1px solid #1E293B",
                            fontSize: "12px"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: "#64748B" }}>Status:</span>
                              <span style={{
                                color: playgroundResponse.status >= 200 && playgroundResponse.status < 300 ? "#34D399" : "#F87171",
                                fontWeight: 700
                              }}>
                                {playgroundResponse.status} {playgroundResponse.statusText}
                              </span>
                            </div>
                          </div>

                          <pre style={{
                            margin: 0,
                            padding: "16px",
                            maxHeight: "350px",
                            overflow: "auto",
                            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                            fontSize: "12px",
                            color: "#F1F5F9",
                            lineHeight: "1.6",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            background: "#0B0F19"
                          }}>
                            {JSON.stringify(playgroundResponse.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
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

        {selectedSection.startsWith("activity-") ? (
          <article className="docs-panel" style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", minHeight: "600px" }}>
            <div className="panel-head" style={{ marginBottom: "10px" }}>
              <div>
                <p className="section-kicker">Developer Console</p>
                <h2>API Activity Logs - {selectedSection === "activity-beneficiary" ? "Beneficiary" : "Payment"}</h2>
              </div>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "#0F172A", padding: "12px 16px", borderRadius: "8px", border: "1px solid #1E293B" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Search Request ID / Path</span>
                <input 
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                  placeholder="Filter by req_... or path"
                  style={{ background: "#1E293B", color: "#F8FAFC", border: "1px solid #334155", borderRadius: "6px", height: "32px", padding: "0 10px", fontSize: "13px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "150px" }}>
                <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Status Filter</span>
                <select
                  value={activityFilterStatus}
                  onChange={(e) => setActivityFilterStatus(e.target.value as any)}
                  style={{ background: "#1E293B", color: "#F8FAFC", border: "1px solid #334155", borderRadius: "6px", height: "32px", padding: "0 8px", fontSize: "13px" }}
                >
                  <option value="all">All statuses</option>
                  <option value="success">Success (2xx)</option>
                  <option value="error">Error (4xx/5xx)</option>
                </select>
              </div>
            </div>

            {/* Consolidated Full Width Table */}
            <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#1E293B", borderBottom: "1px solid #334155", fontWeight: 600, color: "#94A3B8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                API Requests Log History
              </div>
              <div style={{ overflowX: "auto" }}>
                {activitiesIsLoading ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
                    <div className="spinner" style={{ width: "20px", height: "20px", border: "2px solid #10B981", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", marginRight: "8px", verticalAlign: "middle" }}></div>
                    Loading activities...
                  </div>
                ) : groupedActivities.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748B" }}>No activity logs found.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155", background: "#111827" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8", width: "120px" }}>Status</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8", width: "180px" }}>Time</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8", width: "80px" }}>Method</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8" }}>Path</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8", width: "150px" }}>API Key</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "#94A3B8", width: "220px" }}>Request ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedActivities.map((group) => {
                        const act = group.parent;
                        const isSuccess = act.responseStatus >= 200 && act.responseStatus < 300;
                        const isHovered = hoveredRowId === group.resourceId;
                        return (
                          <tr
                            key={group.resourceId}
                            onMouseEnter={() => setHoveredRowId(group.resourceId)}
                            onMouseLeave={() => setHoveredRowId(null)}
                            onClick={() => {
                              setSelectedGroup(group);
                              setIsModalOpen(true);
                              setExpandedSteps({
                                [`${act.activityId}_req`]: true,
                                [`${act.activityId}_resp`]: true
                              });
                            }}
                            style={{
                              borderBottom: "1px solid #1E293B",
                              cursor: "pointer",
                              background: isHovered ? "#1E293B" : "transparent",
                              transition: "background 0.15s"
                            }}
                          >
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: isSuccess ? "#34D399" : "#F87171",
                                background: isSuccess ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)",
                                padding: "2px 6px",
                                borderRadius: "4px"
                              }}>
                                {act.responseStatus}
                              </span>
                              {group.allActivities.length > 1 && (
                                <span style={{ fontSize: "10px", color: "#64748B", marginLeft: "6px" }}>
                                  (+{group.allActivities.length - 1} calls)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#94A3B8" }}>
                              {new Date(act.createdAt).toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <code style={{ color: "#38BDF8", fontWeight: 700 }}>{act.method}</code>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <code style={{ color: "#E2E8F0" }}>{act.path}</code>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#64748B" }}>
                              {act.maskedKey || "None"}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#64748B" }}>
                              <code>{group.resourceId}</code>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Backdrop Overlay */}
            {isModalOpen && (
              <div 
                onClick={() => setIsModalOpen(false)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(15, 23, 42, 0.4)",
                  backdropFilter: "blur(4px)",
                  zIndex: 9999
                }}
              />
            )}

            {/* Timeline Side Sheet Drawer */}
            {isModalOpen && (
              <div style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                maxWidth: "680px",
                background: "#0F172A",
                borderLeft: "1px solid #1E293B",
                boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.3)",
                zIndex: 10000,
                display: "flex",
                flexDirection: "column"
              }}>
                {/* Drawer Header */}
                <div style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #1E293B",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#0F172A"
                }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#F1F5F9", fontSize: "16px", fontWeight: 600 }}>API Activity Detail</h3>
                    <code style={{ fontSize: "11px", color: "#64748B", marginTop: "2px", display: "block" }}>
                      Resource ID: {selectedGroup?.resourceId}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94A3B8",
                      fontSize: "20px",
                      cursor: "pointer",
                      padding: "4px 8px",
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Drawer Content - Scrollable */}
                <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: "#0B0F19" }}>
                  {timelineIsLoading ? (
                    <div style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>
                      <div className="spinner" style={{ width: "24px", height: "24px", border: "2px solid #10B981", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }}></div>
                      <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading trace timeline...</p>
                    </div>
                  ) : timelineData.length === 0 ? (
                    <div style={{ padding: "24px", color: "#64748B", textAlign: "center" }}>No activity logs found for this sequence.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      
                      {/* Summary metadata card (using parent/first activity info) */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", background: "#0F172A", padding: "14px 18px", borderRadius: "8px", border: "1px solid #1E293B" }}>
                        <div style={{ flex: 1, minWidth: "120px" }}>
                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Primary Resource ID</span>
                          <div style={{ fontSize: "13px", color: "#E2E8F0", marginTop: "4px", fontWeight: 600 }}>
                            <code>{selectedGroup?.resourceId}</code>
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Sequence Length</span>
                          <div style={{ marginTop: "4px", fontSize: "13px", color: "#38BDF8", fontWeight: 700 }}>
                            {timelineData.length} API Calls
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Initiated At</span>
                          <div style={{ marginTop: "4px", fontSize: "12px", color: "#94A3B8" }}>
                            {new Date(timelineData[0].activity.createdAt).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Timeline Trace Sequence */}
                      <div>
                        <h4 style={{ margin: "0 0 16px 0", color: "#94A3B8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          API Execution Sequence Timeline
                        </h4>

                        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                          {timelineData.flatMap((detail: any, detailIndex: number) => {
                            const act = detail.activity;
                            const isSuccess = act.responseStatus >= 200 && act.responseStatus < 300;
                            
                            const reqKey = `${act.activityId}_req`;
                            const respKey = `${act.activityId}_resp`;
                            const isReqExpanded = !!expandedSteps[reqKey];
                            const isRespExpanded = !!expandedSteps[respKey];

                            // Build the list of sub-nodes for this activity
                            const nodes = [];

                            // Node A: The API Request & Response
                            nodes.push(
                              <div key={`${act.activityId}_api`} style={{ display: "flex", gap: "16px", position: "relative" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <div style={{
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    background: isSuccess ? "#10B981" : "#EF4444",
                                    border: "2px solid #0F172A",
                                    zIndex: 2
                                  }} />
                                  {/* Line connecting to subsequent nodes */}
                                  <div style={{ width: "2px", flex: 1, background: "#1E293B", marginTop: "4px", marginBottom: "-12px" }} />
                                </div>
                                <div style={{ flex: 1, background: "#0F172A", border: "1px solid #1E293B", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                                  
                                  {/* Toggle Header */}
                                  <div 
                                    onClick={() => {
                                      setExpandedSteps(prev => ({
                                        ...prev,
                                        [reqKey]: !prev[reqKey],
                                        [respKey]: !prev[respKey]
                                      }));
                                    }}
                                    style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none", background: "#1E293B" }}
                                  >
                                    <div>
                                      <span className={`method-badge ${act.method.toLowerCase()}`} style={{ fontSize: "9px", padding: "1px 5px", marginRight: "8px" }}>
                                        {act.method}
                                      </span>
                                      <strong style={{ fontSize: "13px", color: "#F1F5F9" }}>{act.apiName}</strong>
                                      <code style={{ fontSize: "11px", color: "#64748B", marginLeft: "10px" }}>{act.path}</code>
                                    </div>
                                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                                      <span style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: isSuccess ? "#34D399" : "#F87171",
                                        background: isSuccess ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)",
                                        padding: "1px 5px",
                                        borderRadius: "3px",
                                        marginRight: "10px"
                                      }}>
                                        {act.responseStatus}
                                      </span>
                                      {isReqExpanded || isRespExpanded ? "Hide Trace ▲" : "Show Trace ▼"}
                                    </span>
                                  </div>

                                  {(isReqExpanded || isRespExpanded) && (
                                    <div style={{ padding: "16px", background: "#0B0F19", display: "flex", flexDirection: "column", gap: "12px" }}>
                                      {/* Request Details */}
                                      {isReqExpanded && (
                                        <div style={{ borderBottom: "1px solid #1E293B", paddingBottom: "12px" }}>
                                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Headers</span>
                                          <pre style={{ margin: "4px 0 8px 0", padding: "8px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "4px", fontSize: "11px", color: "#94A3B8", overflowX: "auto" }}>
                                            {JSON.stringify(act.requestHeaders, null, 2)}
                                          </pre>
                                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Request Body Payload</span>
                                          {act.requestBody ? (
                                            <pre style={{ margin: "4px 0 0 0", padding: "12px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "4px", fontSize: "12px", color: "#F1F5F9", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                                              {JSON.stringify(act.requestBody, null, 2)}
                                            </pre>
                                          ) : (
                                            <div style={{ color: "#475569", fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>No request body payload</div>
                                          )}
                                        </div>
                                      )}

                                      {/* Response Details */}
                                      {isRespExpanded && (
                                        <div>
                                          <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Response Body Payload</span>
                                          {act.responseBody ? (
                                            <pre style={{ margin: "4px 0 0 0", padding: "12px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "4px", fontSize: "12px", color: "#F1F5F9", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                                              {JSON.stringify(act.responseBody, null, 2)}
                                            </pre>
                                          ) : (
                                            <div style={{ color: "#475569", fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>No response body payload</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );

                            // Node B: Associated Outbound Webhooks (if any)
                            if (detail.webhookDeliveries && detail.webhookDeliveries.length > 0) {
                              detail.webhookDeliveries.forEach((wh: any) => {
                                const stepKey = `webhook_${wh.deliveryId}`;
                                const isExpanded = !!expandedSteps[stepKey];
                                const isWhSuccess = wh.status === "successful" || wh.responseStatus === 200;
                                
                                nodes.push(
                                  <div key={wh.deliveryId} style={{ display: "flex", gap: "16px", position: "relative" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                      <div style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: isWhSuccess ? "#10B981" : "#F59E0B",
                                        border: "2px solid #0F172A",
                                        zIndex: 2
                                      }} />
                                      <div style={{ width: "2px", flex: 1, background: "#1E293B", marginTop: "4px", marginBottom: "-12px" }} />
                                    </div>
                                    <div style={{ flex: 1, background: "#0F172A", border: "1px solid #1E293B", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                                      <div 
                                        onClick={() => toggleStep(stepKey)}
                                        style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                                      >
                                        <div>
                                          <span style={{
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            background: "rgba(245, 158, 11, 0.15)",
                                            color: "#F59E0B",
                                            padding: "1px 6px",
                                            borderRadius: "3px",
                                            marginRight: "8px",
                                            textTransform: "uppercase"
                                          }}>
                                            Webhook
                                          </span>
                                          <strong style={{ fontSize: "13px", color: "#F1F5F9" }}>
                                            Delivered: {wh.eventType}
                                          </strong>
                                          <span style={{ fontSize: "11px", color: isWhSuccess ? "#34D399" : "#F59E0B", marginLeft: "12px" }}>
                                            {wh.status.toUpperCase()} ({wh.responseStatus || "No Code"})
                                          </span>
                                        </div>
                                        <span style={{ fontSize: "11px", color: "#64748B" }}>{isExpanded ? "Hide Details ▲" : "Show Details ▼"}</span>
                                      </div>
                                      {isExpanded && (
                                        <div style={{ padding: "16px", borderTop: "1px solid #1E293B", background: "#0B0F19", display: "flex", flexDirection: "column", gap: "12px" }}>
                                          <div>
                                            <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Target URL</span>
                                            <div style={{ fontSize: "12px", color: "#38BDF8", marginTop: "4px", wordBreak: "break-all" }}>
                                              {wh.targetUrl}
                                            </div>
                                          </div>
                                          {wh.responseBody && (
                                            <div>
                                              <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Response Payload</span>
                                              <pre style={{ margin: "4px 0 0 0", padding: "8px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "4px", fontSize: "11px", color: "#94A3B8", overflowX: "auto" }}>
                                                {wh.responseBody}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            }

                            return nodes;
                          })}
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #1E293B",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#0F172A"
                }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="button button-secondary"
                    style={{ height: "32px", padding: "0 16px", fontSize: "12px", cursor: "pointer" }}
                  >
                    Close Trace Details
                  </button>
                </div>
              </div>
            )}
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

function extractJsonFromExample(example: string): string {
  if (!example) return "";
  const lines = example.split("\n");
  const firstBraceIndex = lines.findIndex(l => l.trim().startsWith("{") || l.trim().startsWith("["));
  if (firstBraceIndex === -1) return "";
  return lines.slice(firstBraceIndex).join("\n");
}

function groupActivities(activityList: any[]) {
  const groups: Record<string, any[]> = {};

  activityList.forEach((act) => {
    let resourceId: string | null = null;
    const path = act.path || "";

    if (act.category === "payment") {
      const pathMatch = path.match(/(txn-[a-zA-Z0-9_-]+)/);
      if (pathMatch) {
        resourceId = pathMatch[1];
      } else {
        const resp = act.responseBody || {};
        const req = act.requestBody || {};
        if (resp.batchId) {
          resourceId = resp.batchId;
        } else if (resp.command?.batchId) {
          resourceId = resp.command.batchId;
        } else if (resp.command?.commandId) {
          resourceId = resp.command.commandId;
        } else if (req.batchId) {
          resourceId = req.batchId;
        } else if (req.command?.batchId) {
          resourceId = req.command.batchId;
        }
      }
    } else if (act.category === "beneficiary") {
      const pathMatch = path.match(/\/beneficiaries\/([^\/]+)/);
      if (pathMatch && pathMatch[1] !== "authorize") {
        resourceId = pathMatch[1];
      } else {
        const resp = act.responseBody || {};
        const req = act.requestBody || {};
        if (resp.beneficiary?.beneficiaryId) {
          resourceId = resp.beneficiary.beneficiaryId;
        } else if (resp.beneficiaryId) {
          resourceId = resp.beneficiaryId;
        } else if (req.beneficiaryId) {
          resourceId = req.beneficiaryId;
        } else if (req.beneficiary?.beneficiaryId) {
          resourceId = req.beneficiary.beneficiaryId;
        }
      }
    }

    const key = resourceId || act.activityId;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(act);
  });

  const groupedResult = Object.entries(groups).map(([resourceId, items]) => {
    const sortedItems = [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let parent = sortedItems.find((item) => {
      const p = item.path || "";
      if (item.category === "payment") {
        return (
          item.method === "POST" &&
          (p === "/v1/partner/payments/transactions" || p.includes("/checkout/sessions") || p.endsWith("/pay"))
        );
      } else {
        return item.method === "POST" && p === "/v1/partner/beneficiaries";
      }
    });

    if (!parent) {
      parent = sortedItems[0];
    }

    return {
      resourceId,
      parent,
      allActivities: sortedItems
    };
  });

  return groupedResult.sort(
    (a, b) => new Date(b.parent.createdAt).getTime() - new Date(a.parent.createdAt).getTime()
  );
}
