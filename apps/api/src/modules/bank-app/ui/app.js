const queueList = document.getElementById("queue-list");
const detailTitle = document.getElementById("detail-title");
const detailState = document.getElementById("detail-state");
const detailBody = document.getElementById("detail-body");
const actionForm = document.getElementById("action-form");
const actionOutput = document.getElementById("action-output");
const bankFilter = document.getElementById("bank-filter");

document
  .getElementById("refresh-applications")
  .addEventListener("click", () => bootstrap(true));
bankFilter.addEventListener("change", () => bootstrap(true));
actionForm.addEventListener("submit", onActionSubmit);

let applications = [];
let selectedApplicationId = null;

bootstrap();

async function bootstrap(preserveSelection = false) {
  actionOutput.textContent = "Loading queue...";
  const [banksResponse, applicationsResponse] = await Promise.all([
    fetchJson("/v1/tenants/banks"),
    fetchJson(
      `/v1/onboarding/applications${
        bankFilter.value ? `?bankTenantId=${encodeURIComponent(bankFilter.value)}` : ""
      }`
    )
  ]);

  if (bankFilter.options.length === 0) {
    renderBankFilter(banksResponse.items ?? []);
  }

  applications = applicationsResponse.items ?? [];
  renderQueue();

  if (applications.length === 0) {
    selectedApplicationId = null;
    renderEmptyDetail("No onboarding applications match this filter.");
    actionOutput.textContent = "Ready.";
    return;
  }

  if (!preserveSelection || !applications.some((item) => item.applicationId === selectedApplicationId)) {
    selectedApplicationId = applications[0].applicationId;
  }

  renderQueue();
  renderDetail(getSelectedApplication());
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
    applications
      .map(
        (application) => `
          <button class="queue-card ${application.applicationId === selectedApplicationId ? "active" : ""}"
                  data-application-id="${escapeHtml(application.applicationId)}"
                  type="button">
            <h3>${escapeHtml(application.legalEntityName)}</h3>
            <p class="queue-meta">
              ${escapeHtml(application.applicationId)} • ${escapeHtml(application.state)}<br />
              ${escapeHtml(application.onboardingMode)}<br />
              Bank: ${escapeHtml(application.bankTenantId)} • Tenant: ${escapeHtml(application.corporateTenantId)}
            </p>
          </button>
        `
      )
      .join("") || `<p class="empty-state">No applications in the queue.</p>`;

  queueList.querySelectorAll("[data-application-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedApplicationId = button.getAttribute("data-application-id");
      renderQueue();
      renderDetail(getSelectedApplication());
    });
  });
}

function renderDetail(application) {
  if (!application) {
    renderEmptyDetail("Choose an application from the queue.");
    return;
  }

  detailTitle.textContent = application.legalEntityName;
  detailState.textContent = application.state;
  detailBody.classList.remove("empty-state");
  detailBody.innerHTML = `
    <div class="detail-grid">
      <article class="detail-card">
        <strong>Application</strong>
        ${escapeHtml(application.applicationId)}
      </article>
      <article class="detail-card">
        <strong>Journey</strong>
        ${escapeHtml(application.onboardingMode)}
      </article>
      <article class="detail-card">
        <strong>Bank tenant</strong>
        ${escapeHtml(application.bankTenantId)}
      </article>
      <article class="detail-card">
        <strong>Corporate tenant</strong>
        ${escapeHtml(application.corporateTenantId)}
      </article>
      <article class="detail-card">
        <strong>Corporate tenant name</strong>
        ${escapeHtml(application.corporateTenantName || "Derived from existing tenant")}
      </article>
      <article class="detail-card">
        <strong>Signatory</strong>
        ${escapeHtml(application.signatoryName)}
      </article>
      <article class="detail-card">
        <strong>PAN</strong>
        ${escapeHtml(application.pan)}
      </article>
      <article class="detail-card">
        <strong>GSTIN</strong>
        ${escapeHtml(application.gstin || "Not provided")}
      </article>
      <article class="detail-card">
        <strong>Primary admin</strong>
        ${escapeHtml(application.primaryCorporateAdminEmail)}
      </article>
      <article class="detail-card">
        <strong>Review comment</strong>
        ${escapeHtml(application.reviewComment || "No comment yet")}
      </article>
    </div>
    <article class="detail-card">
      <strong>Registered address</strong>
      ${escapeHtml(application.registeredAddress)}
    </article>
  `;
}

function renderEmptyDetail(message) {
  detailTitle.textContent = "Select an application";
  detailState.textContent = "No selection";
  detailBody.classList.add("empty-state");
  detailBody.textContent = message;
}

function getSelectedApplication() {
  return applications.find((item) => item.applicationId === selectedApplicationId) ?? null;
}

async function onActionSubmit(event) {
  event.preventDefault();

  const application = getSelectedApplication();
  if (!application) {
    actionOutput.textContent = "Select an application first.";
    return;
  }

  const formData = new FormData(actionForm);
  const payload = {
    action: String(formData.get("action")),
    actedByUserId: String(formData.get("actedByUserId")),
    comment: String(formData.get("comment"))
  };

  actionOutput.textContent = "Applying action...";

  try {
    const response = await fetch(
      `/v1/onboarding/applications/${encodeURIComponent(application.applicationId)}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
