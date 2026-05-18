const bankSelect = document.getElementById("bankTenantId");
const corporateSelect = document.getElementById("corporateTenantId");
const onboardingModeSelect = document.getElementById("onboardingMode");
const existingCorporateGroup = document.getElementById("existing-corporate-group");
const newTenantGroup = document.getElementById("new-tenant-group");
const applicationsList = document.getElementById("applications-list");
const tenantSummary = document.getElementById("tenant-summary");
const responseBox = document.getElementById("form-response");

document
  .getElementById("submit-review")
  .addEventListener("click", submitForm);
document
  .getElementById("refresh-applications")
  .addEventListener("click", refreshApplications);
bankSelect.addEventListener("change", onBankChanged);
onboardingModeSelect.addEventListener("change", syncOnboardingMode);

let bankTenants = [];
let corporateTenants = [];

bootstrap();

async function bootstrap() {
  responseBox.textContent = "Loading onboarding workspace...";
  await Promise.all([loadTenants(), refreshApplications()]);
  responseBox.textContent = "Ready.";
}

async function loadTenants() {
  const [banksResponse, corporatesResponse] = await Promise.all([
    fetchJson("/v1/tenants/banks"),
    fetchJson("/v1/tenants/corporates?status=active")
  ]);

  bankTenants = banksResponse.items ?? [];
  corporateTenants = corporatesResponse.items ?? [];

  renderBankOptions();
  renderCorporateOptions(bankSelect.value);
  syncOnboardingMode();
  renderTenantSummary();
}

function renderBankOptions() {
  bankSelect.innerHTML = bankTenants
    .map(
      (bank) =>
        `<option value="${escapeHtml(bank.tenantId)}">${escapeHtml(bank.name)} (${escapeHtml(bank.tenantId)})</option>`
    )
    .join("");
}

function renderCorporateOptions(bankTenantId) {
  const matchingCorporateTenants = corporateTenants.filter(
    (tenant) => tenant.bankTenantId === bankTenantId
  );

  corporateSelect.innerHTML = matchingCorporateTenants
    .map(
      (tenant) =>
        `<option value="${escapeHtml(tenant.tenantId)}">${escapeHtml(tenant.name)} (${escapeHtml(tenant.tenantId)})</option>`
    )
    .join("");
}

function renderTenantSummary() {
  const grouped = bankTenants.map((bank) => {
    const tenants = corporateTenants.filter((tenant) => tenant.bankTenantId === bank.tenantId);

    return `
      <article class="list-card">
        <h4>${escapeHtml(bank.name)}</h4>
        <p class="list-meta">
          ${escapeHtml(bank.subdomain)} • ${escapeHtml(bank.contactEmail)}<br />
          Corporate tenants: ${tenants.map((tenant) => escapeHtml(tenant.tenantId)).join(", ") || "None"}
        </p>
      </article>
    `;
  });

  tenantSummary.innerHTML = grouped.join("") || `<p class="empty">No tenants available.</p>`;
}

async function refreshApplications() {
  const applicationsResponse = await fetchJson("/v1/onboarding/applications");
  const items = applicationsResponse.items ?? [];

  applicationsList.innerHTML =
    items
      .map(
        (item) => `
          <article class="list-card">
            <h4>${escapeHtml(item.legalEntityName)}</h4>
            <p class="list-meta">
              ${escapeHtml(item.applicationId)} • ${escapeHtml(item.state)}<br />
              Journey: ${escapeHtml(item.onboardingMode)}<br />
              Bank: ${escapeHtml(item.bankTenantId)} • Tenant: ${escapeHtml(item.corporateTenantId)}<br />
              ${escapeHtml(item.primaryCorporateAdminEmail)}
            </p>
          </article>
        `
      )
      .join("") || `<p class="empty">No onboarding applications yet.</p>`;
}

function onBankChanged() {
  renderCorporateOptions(bankSelect.value);
}

function syncOnboardingMode() {
  const isExisting =
    onboardingModeSelect.value === "new_corporate_under_existing_tenant";
  existingCorporateGroup.style.display = isExisting ? "grid" : "none";
  newTenantGroup.style.display = isExisting ? "none" : "grid";
  corporateSelect.required = isExisting;

  const newTenantInput = newTenantGroup.querySelector("input");
  if (newTenantInput) {
    newTenantInput.required = !isExisting;
  }
}

async function submitForm() {
  const form = document.getElementById("onboarding-form");
  const data = new FormData(form);
  const onboardingMode = String(data.get("onboardingMode"));

  const payload = {
    onboardingMode,
    bankTenantId: String(data.get("bankTenantId")),
    corporateTenantId:
      onboardingMode === "new_corporate_under_existing_tenant"
        ? String(data.get("corporateTenantId"))
        : undefined,
    corporateTenantName:
      onboardingMode === "new_corporate_tenant"
        ? String(data.get("corporateTenantName"))
        : undefined,
    legalEntityName: String(data.get("legalEntityName")),
    signatoryName: String(data.get("signatoryName")),
    gstin: normalizeOptional(data.get("gstin")),
    pan: String(data.get("pan")),
    registeredAddress: String(data.get("registeredAddress")),
    primaryCorporateAdminEmail: String(data.get("primaryCorporateAdminEmail"))
  };

  responseBox.textContent = "Submitting request...";

  try {
    const createResponse = await fetch("/v1/onboarding/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const created = await createResponse.json();

    if (!createResponse.ok) {
      responseBox.textContent = JSON.stringify(
        {
          status: createResponse.status,
          data: created
        },
        null,
        2
      );
      return;
    }

    responseBox.textContent = JSON.stringify(
      {
        submitted: {
          status: createResponse.status,
          data: created
        }
      },
      null,
      2
    );

    await Promise.all([refreshApplications(), loadTenants()]);
  } catch (error) {
    responseBox.textContent = `Request failed:\n${String(error)}`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.json();
}

function normalizeOptional(value) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : undefined;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
