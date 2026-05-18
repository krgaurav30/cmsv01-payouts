const apiDefinitions = {
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
  "message": "Beneficiary accepted for checker approval",
  "beneficiary": {
    "beneficiaryId": "1234567890",
    "approvalState": "pending_approval",
    "status": "inactive"
  }
}`,
    errorResponse: `{
  "message": "A beneficiary with the same name and bank account number already exists",
  "beneficiaryId": "1234567890"
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
  "message": "Beneficiary authorization applied",
  "beneficiary": {
    "beneficiaryId": "1234567890",
    "approvalState": "approved",
    "status": "active"
  }
}`,
    errorResponse: `{
  "message": "This beneficiary is not waiting for approval",
  "currentState": "approved"
}`,
    notes: [
      "Header: x-api-key",
      "Checker only",
      "Applies the same approval lifecycle used in the product UI"
    ]
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
  },
  "tag": "vendor",
  "remark": "May invoice settlement"
}`,
    successResponse: `{
  "message": "Transaction created and submitted for checker approval",
  "transaction": {
    "batchId": "txn-1747485000000-001",
    "state": "pending_approval",
    "totalAmount": {
      "value": 12500,
      "currency": "INR"
    }
  }
}`,
    errorResponse: `{
  "message": "Beneficiary is inactive and cannot be used for transaction creation: 1234567890"
}`,
    notes: [
      "Header: x-api-key",
      "Maker only",
      "Transaction is created and immediately moved to pending_approval"
    ]
  },
  "auth-transaction": {
    title: "Auth Transaction",
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
  "message": "Transaction authorization applied",
  "transaction": {
    "batchId": "txn-1747485000000-001",
    "state": "approved"
  }
}`,
    errorResponse: `{
  "message": "Invalid transaction state transition",
  "currentState": "approved"
}`,
    notes: [
      "Header: x-api-key",
      "Checker only",
      "Uses the same approval logic as the product UI"
    ]
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
  "message": "Transaction status fetched successfully",
  "transaction": {
    "batchId": "txn-1747485000000-001",
    "transactionReference": "Vendor payout for Orbit",
    "state": "pending_approval",
    "amount": {
      "value": 12500,
      "currency": "INR"
    },
    "beneficiaryId": "1234567890",
    "beneficiaryName": "Orbit Vendor Services",
    "approvalLevelsRequired": 2,
    "currentApprovalLevel": 1,
    "approvalRoles": ["checker"],
    "bankReference": null,
    "failureReason": null,
    "createdAt": "2026-05-18T13:10:00.000Z",
    "submittedAt": "2026-05-18T13:10:10.000Z",
    "approvedAt": null,
    "rejectedAt": null,
    "sentToBankAt": null,
    "paidAt": null
  }
}`,
    errorResponse: `{
  "message": "Transaction not found"
}`,
    notes: [
      "Header: x-api-key",
      "Read-only transaction tracking API",
      "Useful for partner systems polling payment state after creation"
    ]
  }
};

const apiMenu = document.getElementById("api-menu");
const apiTitle = document.getElementById("api-title");
const apiMeta = document.getElementById("api-meta");
const apiSummary = document.getElementById("api-summary");
const apiFields = document.getElementById("api-fields");
const apiExample = document.getElementById("api-example");
const apiSuccessResponse = document.getElementById("api-success-response");
const apiErrorResponse = document.getElementById("api-error-response");
const apiNotes = document.getElementById("api-notes");
const apiKeyList = document.getElementById("api-key-list");
const apiKeyForm = document.getElementById("api-key-form");
const apiKeyOutput = document.getElementById("api-key-output");
const apiDetailPanel = document.querySelector('[data-dev-section="api-detail"]');
const apiKeysPanel = document.querySelector('[data-dev-section="api-keys"]');

function renderSection(sectionKey) {
  document.querySelectorAll("[data-api-link]").forEach((link) => {
    link.classList.toggle("api-link-active", link.dataset.apiLink === sectionKey);
  });

  if (sectionKey === "api-keys") {
    if (apiDetailPanel) {
      apiDetailPanel.hidden = true;
    }
    if (apiKeysPanel) {
      apiKeysPanel.hidden = false;
    }
    return;
  }

  if (apiDetailPanel) {
    apiDetailPanel.hidden = false;
  }
  if (apiKeysPanel) {
    apiKeysPanel.hidden = true;
  }

  const definition = apiDefinitions[sectionKey];
  if (!definition) {
    return;
  }

  apiTitle.textContent = definition.title;
  apiMeta.textContent = `${definition.method} ${definition.path}`;
  apiSummary.textContent = definition.summary;
  apiExample.textContent = definition.example;
  apiSuccessResponse.textContent = definition.successResponse;
  apiErrorResponse.textContent = definition.errorResponse;

  apiFields.innerHTML = definition.fields
    .map(
      ([field, required, description]) => `
        <tr>
          <td><code>${field}</code></td>
          <td>${required}</td>
          <td>${description}</td>
        </tr>`
    )
    .join("");

  apiNotes.innerHTML = definition.notes.map((note) => `<li>${note}</li>`).join("");
}

async function loadApiKeys() {
  apiKeyList.innerHTML = `<div class="empty-state">Loading active keys...</div>`;

  const response = await fetch("/bank/dev-portal/api-keys");
  const data = await response.json();

  if (!response.ok) {
    apiKeyList.innerHTML = `<div class="empty-state">Unable to load active keys.</div>`;
    return;
  }

  if (!data.items?.length) {
    apiKeyList.innerHTML = `<div class="empty-state">No active keys yet.</div>`;
    return;
  }

  apiKeyList.innerHTML = data.items
    .map(
      (item) => `
        <article class="key-card">
          <div class="key-card-row">
            <strong>${item.label}</strong>
            <span class="state-pill">${item.status}</span>
          </div>
          <p class="queue-meta">${item.maskedKey}</p>
          <p class="queue-meta">Scope: ${item.productScope} | Created by: ${item.createdBy ?? "system"}</p>
        </article>`
    )
    .join("");
}

async function generateApiKey(event) {
  event.preventDefault();

  const formData = new FormData(apiKeyForm);
  const payload = {
    label: String(formData.get("label") ?? "").trim(),
    productScope: String(formData.get("productScope") ?? "all").trim(),
    createdBy: String(formData.get("createdBy") ?? "bank-ops-001").trim()
  };

  apiKeyOutput.textContent = "Generating key...";

  const response = await fetch("/bank/dev-portal/api-keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    apiKeyOutput.textContent = JSON.stringify(data, null, 2);
    return;
  }

  apiKeyOutput.textContent = JSON.stringify(data, null, 2);
  apiKeyForm.reset();
  await loadApiKeys();
}

apiMenu?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const link = target.closest("[data-api-link]");
  if (!link) {
    return;
  }

  event.preventDefault();
  renderSection(link.dataset.apiLink);
});

apiKeyForm?.addEventListener("submit", generateApiKey);

renderSection("create-beneficiary");
loadApiKeys();
