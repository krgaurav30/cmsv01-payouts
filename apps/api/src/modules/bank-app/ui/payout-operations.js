const queueList = document.getElementById("queue-list");
const detailTitle = document.getElementById("detail-title");
const detailState = document.getElementById("detail-state");
const detailBody = document.getElementById("detail-body");
const operationsForm = document.getElementById("operations-form");
const actionOutput = document.getElementById("action-output");
const bankFilter = document.getElementById("bank-filter");

document.getElementById("refresh-batches").addEventListener("click", () => bootstrap(true));
bankFilter.addEventListener("change", () => bootstrap(true));
operationsForm.addEventListener("submit", onOperationsSubmit);

let batches = [];
let selectedBatchId = null;

bootstrap();

async function bootstrap(preserveSelection = false) {
  actionOutput.textContent = "Loading payout queue...";

  const bankQuery = bankFilter.value
    ? `?bankTenantId=${encodeURIComponent(bankFilter.value)}`
    : "";

  const [banksResponse, batchesResponse] = await Promise.all([
    fetchJson("/v1/tenants/banks"),
    fetchJson(`/v1/payouts/batches${bankQuery}`)
  ]);

  if (bankFilter.options.length === 0) {
    renderBankFilter(banksResponse.items ?? []);
  }

  batches = batchesResponse.items ?? [];
  renderQueue();

  if (batches.length === 0) {
    selectedBatchId = null;
    renderEmptyDetail("No payout batches match this filter.");
    actionOutput.textContent = "Ready.";
    return;
  }

  if (!preserveSelection || !batches.some((item) => item.batchId === selectedBatchId)) {
    selectedBatchId = batches[0].batchId;
  }

  renderQueue();
  renderDetail(getSelectedBatch());
  actionOutput.textContent = "Ready.";
}

function renderBankFilter(banks) {
  bankFilter.innerHTML =
    `<option value="">All bank tenants</option>` +
    banks
      .map(
        (bank) =>
          `<option value="${escapeHtml(bank.tenantId)}">${escapeHtml(bank.name)} (${escapeHtml(bank.tenantId)})</option>`
      )
      .join("");
}

function renderQueue() {
  queueList.innerHTML =
    batches
      .map(
        (batch) => `
          <button class="queue-card ${batch.batchId === selectedBatchId ? "active" : ""}"
                  data-batch-id="${escapeHtml(batch.batchId)}"
                  type="button">
            <h3>${escapeHtml(batch.title)}</h3>
            <p class="queue-meta">
              ${escapeHtml(batch.batchId)} • ${escapeHtml(batch.state)}<br />
              Bank: ${escapeHtml(batch.bankTenantId)} • Tenant: ${escapeHtml(batch.corporateTenantId)}<br />
              Amount: INR ${formatAmount(batch.totalAmount.value)}
            </p>
          </button>
        `
      )
      .join("") || `<p class="empty-state">No payout batches in the queue.</p>`;

  queueList.querySelectorAll("[data-batch-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBatchId = button.getAttribute("data-batch-id");
      renderQueue();
      renderDetail(getSelectedBatch());
    });
  });
}

function renderDetail(batch) {
  if (!batch) {
    renderEmptyDetail("Choose a payout batch from the queue.");
    return;
  }

  detailTitle.textContent = batch.title;
  detailState.textContent = batch.state;
  detailBody.classList.remove("empty-state");

  const processedCount = batch.items.filter((item) => item.state === "processed").length;
  const failedCount = batch.items.filter((item) => item.state === "failed").length;

  detailBody.innerHTML = `
    <div class="detail-grid">
      <article class="detail-card">
        <strong>Batch ID</strong>
        ${escapeHtml(batch.batchId)}
      </article>
      <article class="detail-card">
        <strong>Bank tenant</strong>
        ${escapeHtml(batch.bankTenantId)}
      </article>
      <article class="detail-card">
        <strong>Corporate tenant</strong>
        ${escapeHtml(batch.corporateTenantId)}
      </article>
      <article class="detail-card">
        <strong>Total amount</strong>
        INR ${formatAmount(batch.totalAmount.value)}
      </article>
      <article class="detail-card">
        <strong>Bank reference</strong>
        ${escapeHtml(batch.bankReference || "Not sent to bank yet")}
      </article>
      <article class="detail-card">
        <strong>Approval / ops comment</strong>
        ${escapeHtml(batch.approvalComment || "No comment yet")}
      </article>
      <article class="detail-card">
        <strong>Sent to bank at</strong>
        ${escapeHtml(formatDate(batch.dispatchedAt))}
      </article>
      <article class="detail-card">
        <strong>Paid at</strong>
        ${escapeHtml(formatDate(batch.completedAt))}
      </article>
      <article class="detail-card">
        <strong>Processed items</strong>
        ${escapeHtml(String(processedCount))}
      </article>
      <article class="detail-card">
        <strong>Failed items</strong>
        ${escapeHtml(String(failedCount))}
      </article>
    </div>
    <article class="detail-card">
      <strong>Batch failure reason</strong>
      ${escapeHtml(batch.failureReason || "No failure reason recorded")}
    </article>
    <article class="detail-card">
      <strong>Payout items</strong>
      <div class="item-table">
        ${batch.items
          .map(
            (item) => `
              <div class="item-row">
                <div><strong>${escapeHtml(item.itemId)}</strong></div>
                <div>Beneficiary: ${escapeHtml(item.beneficiaryId)}</div>
                <div>Amount: INR ${formatAmount(item.amount.value)}</div>
                <div>Status: ${escapeHtml(item.state)}</div>
                <div>Reference: ${escapeHtml(item.bankReference || "Pending")}</div>
                <div>Failure: ${escapeHtml(item.failureReason || "None")}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderEmptyDetail(message) {
  detailTitle.textContent = "Select a payout batch";
  detailState.textContent = "No selection";
  detailBody.classList.add("empty-state");
  detailBody.textContent = message;
}

function getSelectedBatch() {
  return batches.find((item) => item.batchId === selectedBatchId) ?? null;
}

async function onOperationsSubmit(event) {
  event.preventDefault();

  const batch = getSelectedBatch();
  if (!batch) {
    actionOutput.textContent = "Select a payout batch first.";
    return;
  }

  const formData = new FormData(operationsForm);
  const operation = String(formData.get("operation"));
  const payload = {
    actedByUserId: String(formData.get("actedByUserId")),
    comment: String(formData.get("comment"))
  };

  const path =
    operation === "dispatch"
      ? `/v1/payouts/batches/${encodeURIComponent(batch.batchId)}/dispatch`
      : `/v1/payouts/batches/${encodeURIComponent(batch.batchId)}/simulate-bank-response`;

  actionOutput.textContent = "Running payout operation...";

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    actionOutput.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      await bootstrap(true);
    }
  } catch (error) {
    actionOutput.textContent = `Request failed:\n${String(error)}`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.json();
}

function formatAmount(value) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
