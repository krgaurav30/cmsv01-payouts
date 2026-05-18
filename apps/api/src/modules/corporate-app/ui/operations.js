const session = readSession();

if (!session) {
  window.location.href = "/corporate/login";
}

const isMaker = session.role === "maker";
const isChecker = session.role === "checker";

const bankSelect = document.getElementById("bankTenantId");
const corporateTenantSelect = document.getElementById("corporateTenantId");
const corporateSelect = document.getElementById("corporateId");
const transactionForm = document.getElementById("transaction-form");
const transactionCreatePanel = document.getElementById("transaction-create-panel");
const toggleTransactionCreateButton = document.getElementById("toggle-transaction-create");
const cancelTransactionCreateButton = document.getElementById("cancel-transaction-create");
const transactionFilterSearch = document.getElementById("transaction-filter-search");
const transactionFilterState = document.getElementById("transaction-filter-state");
const transactionFilterTag = document.getElementById("transaction-filter-tag");
const beneficiaryForm = document.getElementById("beneficiary-form");
const beneficiaryCreatePanel = document.getElementById("beneficiary-create-panel");
const toggleBeneficiaryCreateButton = document.getElementById("toggle-beneficiary-create");
const cancelBeneficiaryCreateButton = document.getElementById("cancel-beneficiary-create");
const beneficiaryFilterSearch = document.getElementById("beneficiary-filter-search");
const beneficiaryFilterStatus = document.getElementById("beneficiary-filter-status");
const beneficiaryFilterCategory = document.getElementById("beneficiary-filter-category");
const roleForm = document.getElementById("role-form");
const userForm = document.getElementById("user-form");
const transactionBeneficiarySelect = document.getElementById("transactionBeneficiaryId");
const userRoleSelect = document.getElementById("userRole");
const sessionBanner = document.getElementById("session-banner");
const workspaceTitle = document.getElementById("workspace-title");

const transactionResponse = document.getElementById("transaction-response");
const beneficiaryResponse = document.getElementById("beneficiary-response");
const roleResponse = document.getElementById("role-response");
const userResponse = document.getElementById("user-response");

const homeSummary = document.getElementById("home-summary");
const homeTransactions = document.getElementById("home-transactions");
const homeApprovals = document.getElementById("home-approvals");
const transactionsTableBody = document.getElementById("transactions-table-body");
const approvalsList = document.getElementById("approvals-list");
const beneficiariesTableBody = document.getElementById("beneficiaries-table-body");
const rolesList = document.getElementById("roles-list");
const usersList = document.getElementById("users-list");

const navItems = Array.from(document.querySelectorAll("[data-section-target]"));
const pageSections = Array.from(document.querySelectorAll(".page-section"));
const jumpButtons = Array.from(document.querySelectorAll("[data-jump-target]"));
const makerOnlyForms = [transactionForm, beneficiaryForm, roleForm, userForm];

document.getElementById("refresh-transactions").addEventListener("click", refreshTransactions);
document.getElementById("refresh-beneficiaries").addEventListener("click", refreshBeneficiaries);
document.getElementById("refresh-roles").addEventListener("click", refreshRoles);
document.getElementById("refresh-users").addEventListener("click", refreshUsers);
document.getElementById("logout-button").addEventListener("click", logout);
corporateSelect.addEventListener("change", onCorporateChanged);
transactionForm.addEventListener("submit", onTransactionSubmit);
transactionsTableBody.addEventListener("click", onTransactionTableAction);
beneficiaryForm.addEventListener("submit", onBeneficiarySubmit);
roleForm.addEventListener("submit", onRoleSubmit);
userForm.addEventListener("submit", onUserSubmit);
approvalsList.addEventListener("click", onApprovalAction);
beneficiariesTableBody.addEventListener("click", onBeneficiaryStatusAction);
toggleBeneficiaryCreateButton.addEventListener("click", toggleBeneficiaryCreatePanel);
cancelBeneficiaryCreateButton.addEventListener("click", closeBeneficiaryCreatePanel);
toggleTransactionCreateButton.addEventListener("click", toggleTransactionCreatePanel);
cancelTransactionCreateButton.addEventListener("click", closeTransactionCreatePanel);
transactionFilterSearch.addEventListener("input", renderTransactions);
transactionFilterState.addEventListener("change", renderTransactions);
transactionFilterTag.addEventListener("input", renderTransactions);
beneficiaryFilterSearch.addEventListener("input", renderBeneficiaries);
beneficiaryFilterStatus.addEventListener("change", renderBeneficiaries);
beneficiaryFilterCategory.addEventListener("input", renderBeneficiaries);

navItems.forEach((item) => {
  item.addEventListener("click", () => activateSection(item.dataset.sectionTarget));
});

jumpButtons.forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.jumpTarget));
});

let bankTenants = [];
let corporateTenants = [];
let corporates = [];
let beneficiaries = [];
let transactions = [];
let roles = [];
let users = [];

bootstrap();

async function bootstrap() {
  setAllResponses("Loading workspace...");
  renderSessionBanner();
  applyPermissionMode();
  await loadContext();
  await refreshWorkspaceData();
  setAllResponses("Ready.");
}

function setAllResponses(message) {
  transactionResponse.textContent = message;
  beneficiaryResponse.textContent = message;
  roleResponse.textContent = message;
  userResponse.textContent = message;
}

async function loadContext() {
  const [banksResponse, corporateTenantsResponse, corporatesResponse] = await Promise.all([
    fetchJson("/v1/tenants/banks"),
    fetchJson("/v1/tenants/corporates?status=active"),
    fetchJson("/v1/corporates?status=active")
  ]);

  bankTenants = banksResponse.items ?? [];
  corporateTenants = corporateTenantsResponse.items ?? [];
  corporates = corporatesResponse.items ?? [];

  renderLockedContext();
}

function applyPermissionMode() {
  if (!isMaker) {
    makerOnlyForms.forEach((form) => {
      form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = true;
      });
    });

    transactionResponse.textContent =
      "Checker access is view-and-approve only. Transaction creation is disabled.";
    beneficiaryResponse.textContent =
      "Checker access is view-and-approve only. Beneficiary creation is disabled.";
    roleResponse.textContent =
      "Checker access is view-and-approve only. Role creation is disabled.";
    userResponse.textContent =
      "Checker access is view-and-approve only. User creation is disabled.";

    toggleBeneficiaryCreateButton.disabled = true;
    toggleTransactionCreateButton.disabled = true;
  }
}

function renderSessionBanner() {
  const selectedCorporate = getSelectedCorporate();
  sessionBanner.textContent =
    `Logged in as ${session.displayName} (${session.username}) | role ${session.role} | ` +
    `tenant ${session.corporateTenantId}` +
    (selectedCorporate ? ` | corporate ${selectedCorporate.name}` : "");
}

function renderLockedContext() {
  const allowedBank = bankTenants.find((bank) => bank.tenantId === session.bankTenantId);
  const allowedTenant = corporateTenants.find(
    (tenant) => tenant.tenantId === session.corporateTenantId
  );
  const tenantCorporates = corporates.filter(
    (corporate) => corporate.corporateTenantId === session.corporateTenantId
  );

  const selectedCorporateId =
    readSelectedCorporateId() ??
    session.corporateId ??
    tenantCorporates[0]?.corporateId ??
    "";

  bankSelect.innerHTML = allowedBank
    ? `<option value="${escapeHtml(allowedBank.tenantId)}">${escapeHtml(allowedBank.name)} (${escapeHtml(allowedBank.tenantId)})</option>`
    : "";

  corporateTenantSelect.innerHTML = allowedTenant
    ? `<option value="${escapeHtml(allowedTenant.tenantId)}">${escapeHtml(allowedTenant.name)} (${escapeHtml(allowedTenant.tenantId)})</option>`
    : "";

  corporateSelect.innerHTML = tenantCorporates
    .map(
      (corporate) =>
        `<option value="${escapeHtml(corporate.corporateId)}" ${
          corporate.corporateId === selectedCorporateId ? "selected" : ""
        }>${escapeHtml(corporate.name)} (${escapeHtml(corporate.corporateId)})</option>`
    )
    .join("");

  if (selectedCorporateId) {
    persistSelectedCorporateId(selectedCorporateId);
  }

  bankSelect.disabled = true;
  corporateTenantSelect.disabled = true;
  corporateSelect.disabled = false;
  renderSessionBanner();
}

function activateSection(sectionId) {
  pageSections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.sectionTarget === sectionId);
  });

  const activeNav = navItems.find((item) => item.dataset.sectionTarget === sectionId);
  workspaceTitle.textContent = activeNav?.textContent?.trim() || "Workspace";
}

async function onCorporateChanged() {
  persistSelectedCorporateId(corporateSelect.value);
  renderSessionBanner();
  await refreshWorkspaceData();
}

function getSelectedCorporate() {
  return corporates.find((corporate) => corporate.corporateId === corporateSelect.value) ?? null;
}

async function refreshWorkspaceData() {
  await Promise.all([
    refreshTransactions(),
    refreshBeneficiaries(),
    refreshRoles(),
    refreshUsers()
  ]);
  renderHome();
}

async function refreshTransactions() {
  const response = await fetchJson(
    `/v1/payouts/batches?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(corporateSelect.value)}`
  );
  transactions = response.items ?? [];
  renderTransactions();
  renderApprovals();
}

async function refreshBeneficiaries() {
  const response = await fetchJson(
    `/v1/beneficiaries?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(corporateSelect.value)}`
  );
  beneficiaries = response.items ?? [];
  renderBeneficiaries();
  renderBeneficiaryOptions();
  renderApprovals();
}

async function refreshRoles() {
  const response = await fetchJson(
    `/v1/auth/corporate-roles?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}`
  );
  roles = (response.items ?? []).filter((role) => ["maker", "checker"].includes(role.name));
  renderRoles();
  renderRoleOptions();
  renderApprovals();
}

async function refreshUsers() {
  const response = await fetchJson(
    `/v1/auth/users?corporateTenantId=${encodeURIComponent(session.corporateTenantId)}&corporateId=${encodeURIComponent(corporateSelect.value)}`
  );
  users = (response.items ?? []).filter((user) => ["maker", "checker"].includes(user.role));
  renderUsers();
  renderApprovals();
}

function renderHome() {
  const transactionStates = summarizeByKey(transactions, "state");
  const pendingApprovalCount = getPendingApprovals().length;

  homeSummary.innerHTML = [
    summaryCard("Total transactions", transactions.length),
    summaryCard("Pending approvals", pendingApprovalCount),
    summaryCard("Approved beneficiaries", beneficiaries.filter((item) => item.approvalState === "approved").length),
    summaryCard("Active users", users.filter((item) => item.status === "active" && item.approvalState === "approved").length)
  ].join("");

  homeTransactions.innerHTML =
    transactions
      .slice()
      .sort((a, b) => b.batchId.localeCompare(a.batchId))
      .slice(0, 5)
      .map(renderTransactionCard)
      .join("") || `<p class="empty">No transactions yet.</p>`;

  homeApprovals.innerHTML =
    getPendingApprovals()
      .slice(0, 6)
      .map(renderApprovalCard)
      .join("") || `<p class="empty">No approvals waiting right now.</p>`;

  if (transactionStates.pending_approval && !isChecker) {
    homeApprovals.insertAdjacentHTML(
      "afterbegin",
      `<div class="callout-card">There are transactions waiting for checker approval.</div>`
    );
  }
}

function renderTransactions() {
  const filteredTransactions = transactions.filter((transaction) => {
    const searchTerm = transactionFilterSearch.value.trim().toLowerCase();
    const stateFilter = transactionFilterState.value;
    const tagFilter = transactionFilterTag.value.trim().toLowerCase();

    const matchesSearch =
      searchTerm.length === 0 ||
      transaction.title.toLowerCase().includes(searchTerm) ||
      transaction.batchId.toLowerCase().includes(searchTerm);

    const matchesState = stateFilter.length === 0 || transaction.state === stateFilter;
    const matchesTag =
      tagFilter.length === 0 || (transaction.tag || "").toLowerCase().includes(tagFilter);

    return matchesSearch && matchesState && matchesTag;
  });

  transactionsTableBody.innerHTML =
    filteredTransactions
      .map((transaction) => {
        const firstItem = transaction.items[0];
        const beneficiary = beneficiaries.find(
          (item) => item.beneficiaryId === firstItem?.beneficiaryId
        );

        return `
          <tr>
            <td>${escapeHtml(transaction.batchId)}</td>
            <td>
              <strong>${escapeHtml(transaction.title)}</strong><br />
              <span class="list-meta">${escapeHtml(transaction.remark || "No remark")}</span>
            </td>
            <td>${escapeHtml(beneficiary?.name || firstItem?.beneficiaryId || "Unknown beneficiary")}</td>
            <td>INR ${escapeHtml(formatAmount(transaction.totalAmount.value))}</td>
            <td>${escapeHtml(transaction.tag || "Not tagged")}</td>
            <td><span class="status-pill ${escapeHtml(transaction.state)}">${escapeHtml(transaction.state)}</span></td>
            <td>${escapeHtml(formatDateTime(transaction.createdAt))}</td>
            <td>
              <button class="mini-button kebab-button" data-transaction-timeline-id="${escapeHtml(transaction.batchId)}">⋯</button>
              <div id="timeline-${escapeHtml(transaction.batchId)}" class="timeline-popup hidden">${renderTimeline(transaction.timeline)}</div>
            </td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="8" class="empty">No transactions found for the selected filters.</td></tr>`;
}

function renderApprovals() {
  const pendingApprovals = getPendingApprovals();

  if (pendingApprovals.length === 0) {
    approvalsList.innerHTML = `<p class="empty">Nothing is waiting for approval.</p>`;
    return;
  }

  approvalsList.innerHTML = pendingApprovals.map(renderApprovalCard).join("");
}

function getPendingApprovals() {
  const items = [];

  transactions
    .filter((item) => item.state === "pending_approval")
    .forEach((item) => items.push({ entity: "transaction", item }));

  beneficiaries
    .filter((item) => item.approvalState === "pending_approval")
    .forEach((item) => items.push({ entity: "beneficiary", item }));

  roles
    .filter((item) => item.approvalState === "pending_approval")
    .forEach((item) => items.push({ entity: "role", item }));

  users
    .filter((item) => item.approvalState === "pending_approval")
    .forEach((item) => items.push({ entity: "user", item }));

  return items;
}

function renderBeneficiaries() {
  const filteredBeneficiaries = beneficiaries.filter((beneficiary) => {
    const searchTerm = beneficiaryFilterSearch.value.trim().toLowerCase();
    const statusFilter = beneficiaryFilterStatus.value;
    const categoryFilter = beneficiaryFilterCategory.value.trim().toLowerCase();

    const matchesSearch =
      searchTerm.length === 0 ||
      beneficiary.name.toLowerCase().includes(searchTerm) ||
      beneficiary.accountNumber.includes(searchTerm) ||
      beneficiary.beneficiaryId.includes(searchTerm);

    const matchesStatus = statusFilter.length === 0 || beneficiary.status === statusFilter;
    const matchesCategory =
      categoryFilter.length === 0 ||
      (beneficiary.category || "").toLowerCase().includes(categoryFilter);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  beneficiariesTableBody.innerHTML =
    filteredBeneficiaries
      .map(
        (beneficiary) => `
          <tr>
            <td>${escapeHtml(beneficiary.beneficiaryId)}</td>
            <td>
              <strong>${escapeHtml(beneficiary.name)}</strong><br />
              <span class="list-meta">${escapeHtml(beneficiary.phoneNumber || "Phone not provided")}</span>
            </td>
            <td>${escapeHtml(formatDateTime(beneficiary.lastUpdatedAt))}</td>
            <td>${escapeHtml(maskAccountNumber(beneficiary.accountNumber))}</td>
            <td>${escapeHtml(beneficiary.bankName)}</td>
            <td>${escapeHtml(beneficiary.ifsc)}</td>
            <td>${escapeHtml(beneficiary.category || "Uncategorized")}</td>
            <td>
              <span class="status-pill ${escapeHtml(beneficiary.status)}">${escapeHtml(beneficiary.status)}</span>
              <br />
              <span class="status-pill ${escapeHtml(beneficiary.approvalState)}">${escapeHtml(beneficiary.approvalState)}</span>
            </td>
            <td>
              ${
                isMaker && beneficiary.approvalState === "approved"
                  ? `<button class="mini-button" data-beneficiary-status-id="${escapeHtml(beneficiary.beneficiaryId)}" data-beneficiary-status-action="${beneficiary.status === "active" ? "deactivate" : "activate"}">${beneficiary.status === "active" ? "Deactivate" : "Activate"}</button>`
                  : `<span class="list-meta">${escapeHtml(resolveBeneficiaryActionLabel(beneficiary))}</span>`
              }
            </td>
          </tr>
        `
      )
      .join("") || `<tr><td colspan="9" class="empty">No beneficiaries found for the selected filters.</td></tr>`;
}

function renderRoles() {
  rolesList.innerHTML =
    roles
      .map(
        (role) => `
          <article class="list-card">
            <h4>${escapeHtml(role.name)}</h4>
            <p class="list-meta">
              ${escapeHtml(role.roleId)} | ${escapeHtml(role.approvalState)} | ${escapeHtml(role.status)}<br />
              ${escapeHtml(role.description || "No description")}<br />
              Permissions: ${escapeHtml(role.permissions.join(", ") || "None")}<br />
              Review: ${escapeHtml(role.reviewComment || "None")}
            </p>
          </article>
        `
      )
      .join("") || `<p class="empty">No roles found.</p>`;
}

function renderUsers() {
  usersList.innerHTML =
    users
      .map(
        (user) => `
          <article class="list-card">
            <h4>${escapeHtml(user.displayName)}</h4>
            <p class="list-meta">
              ${escapeHtml(user.username)} | ${escapeHtml(user.role)} | ${escapeHtml(user.approvalState)}<br />
              Status: ${escapeHtml(user.status)}<br />
              Corporate: ${escapeHtml(user.corporateId || "Parent tenant access")}<br />
              Review: ${escapeHtml(user.reviewComment || "None")}
            </p>
          </article>
        `
      )
      .join("") || `<p class="empty">No users yet.</p>`;
}

function renderBeneficiaryOptions() {
  const approvedBeneficiaries = beneficiaries.filter(
    (item) => item.approvalState === "approved" && item.status === "active"
  );
  transactionBeneficiarySelect.innerHTML = approvedBeneficiaries
    .map(
      (beneficiary) =>
        `<option value="${escapeHtml(beneficiary.beneficiaryId)}">${escapeHtml(beneficiary.name)} (${escapeHtml(beneficiary.beneficiaryId)})</option>`
    )
    .join("");
}

function renderRoleOptions() {
  const approvedRoles = roles.filter(
    (role) => role.status === "active" && role.approvalState === "approved"
  );
  const roleNames = approvedRoles.length > 0
    ? approvedRoles.map((role) => role.name)
    : ["maker", "checker"];

  userRoleSelect.innerHTML = [...new Set(roleNames)]
    .map((roleName) => `<option value="${escapeHtml(roleName)}">${escapeHtml(roleName)}</option>`)
    .join("");
}

async function onTransactionSubmit(event) {
  event.preventDefault();
  if (!isMaker) {
    return;
  }

  const formData = new FormData(transactionForm);
  const batchId = createTransactionUuid();
  const itemId = generateId("ITEM");

  const createPayload = {
    batchId,
    bankTenantId: session.bankTenantId,
    corporateTenantId: session.corporateTenantId,
    corporateId: corporateSelect.value,
    createdByUserId: session.userId,
    title: String(formData.get("title")),
    tag: normalizeOptional(formData.get("tag")),
    remark: normalizeOptional(formData.get("remark")),
    items: [
      {
        itemId,
        beneficiaryId: String(formData.get("beneficiaryId")),
        amount: {
          value: Number(formData.get("amount")),
          currency: "INR"
        },
        purpose: String(formData.get("remark") || formData.get("title"))
      }
    ]
  };

  transactionResponse.textContent = "Creating transaction...";

  try {
    const createResponse = await fetch("/v1/payouts/batches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createPayload)
    });

    const created = await createResponse.json();

    if (!createResponse.ok) {
      transactionResponse.textContent = JSON.stringify(
        {
          status: createResponse.status,
          data: created
        },
        null,
        2
      );
      return;
    }

    let output = { created };

    const submitResponse = await fetch(
      `/v1/payouts/batches/${encodeURIComponent(batchId)}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "submit",
          actedByUserId: session.userId,
          comment: `Submitted from corporate operations workspace by ${session.username}`
        })
      }
    );

    const submitted = await submitResponse.json();
    output = {
      created,
      submitted: {
        status: submitResponse.status,
        data: submitted
      }
    };

    transactionResponse.textContent = JSON.stringify(output, null, 2);
    transactionForm.reset();
    closeTransactionCreatePanel();
    await refreshTransactions();
    renderHome();
  } catch (error) {
    transactionResponse.textContent = `Request failed:\n${String(error)}`;
  }
}

async function onBeneficiarySubmit(event) {
  event.preventDefault();
  if (!isMaker) {
    return;
  }

  const formData = new FormData(beneficiaryForm);
  const payload = {
    createdByUserId: session.userId,
    bankTenantId: session.bankTenantId,
    corporateTenantId: session.corporateTenantId,
    corporateId: corporateSelect.value,
    name: String(formData.get("name")),
    accountNumber: String(formData.get("accountNumber")),
    ifsc: String(formData.get("ifsc")),
    phoneNumber: String(formData.get("phoneNumber")),
    category: normalizeOptional(formData.get("category")),
    tags: String(formData.get("tags"))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };

  beneficiaryResponse.textContent = "Creating beneficiary...";

  try {
    const response = await fetch("/v1/beneficiaries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    beneficiaryResponse.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      beneficiaryForm.reset();
      closeBeneficiaryCreatePanel();
      await refreshBeneficiaries();
      renderHome();
    }
  } catch (error) {
    beneficiaryResponse.textContent = `Request failed:\n${String(error)}`;
  }
}

async function onBeneficiaryStatusAction(event) {
  const button = event.target.closest("[data-beneficiary-status-id]");
  if (!button || !isMaker) {
    return;
  }

  const beneficiaryId = button.dataset.beneficiaryStatusId;
  const action = button.dataset.beneficiaryStatusAction;

  if (!beneficiaryId || !action) {
    return;
  }

  button.disabled = true;
  beneficiaryResponse.textContent = `${capitalize(action)}ing beneficiary...`;

  try {
    const response = await fetch(
      `/v1/beneficiaries/${encodeURIComponent(beneficiaryId)}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          actedByUserId: session.userId,
          comment: `${capitalize(action)}d by maker ${session.username}`
        })
      }
    );

    const data = await response.json();
    beneficiaryResponse.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      await refreshBeneficiaries();
      renderHome();
    } else {
      button.disabled = false;
    }
  } catch (error) {
    beneficiaryResponse.textContent = `Request failed:\n${String(error)}`;
    button.disabled = false;
  }
}

function onTransactionTableAction(event) {
  const button = event.target.closest("[data-transaction-timeline-id]");
  if (!button) {
    return;
  }

  const transactionId = button.dataset.transactionTimelineId;
  if (!transactionId) {
    return;
  }

  const popup = document.getElementById(`timeline-${transactionId}`);
  if (!popup) {
    return;
  }

  const isHidden = popup.classList.contains("hidden");
  document.querySelectorAll(".timeline-popup").forEach((item) => item.classList.add("hidden"));
  popup.classList.toggle("hidden", !isHidden);
}

async function onRoleSubmit(event) {
  event.preventDefault();
  if (!isMaker) {
    return;
  }

  const formData = new FormData(roleForm);
  const payload = {
    createdByUserId: session.userId,
    corporateTenantId: session.corporateTenantId,
    name: String(formData.get("name")),
    description: normalizeOptional(formData.get("description")),
    status: String(formData.get("status"))
  };

  roleResponse.textContent = "Creating role...";

  try {
    const response = await fetch("/v1/auth/corporate-roles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    roleResponse.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      roleForm.reset();
      await refreshRoles();
      renderHome();
    }
  } catch (error) {
    roleResponse.textContent = `Request failed:\n${String(error)}`;
  }
}

async function onUserSubmit(event) {
  event.preventDefault();
  if (!isMaker) {
    return;
  }

  const formData = new FormData(userForm);
  const payload = {
    userId: generateId("USR"),
    createdByUserId: session.userId,
    username: String(formData.get("username")),
    password: String(formData.get("password")),
    displayName: String(formData.get("displayName")),
    role: String(formData.get("role")),
    bankTenantId: session.bankTenantId,
    corporateTenantId: session.corporateTenantId,
    corporateId: corporateSelect.value || undefined,
    status: String(formData.get("status"))
  };

  userResponse.textContent = "Creating user...";

  try {
    const response = await fetch("/v1/auth/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    userResponse.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      userForm.reset();
      await refreshUsers();
      renderHome();
    }
  } catch (error) {
    userResponse.textContent = `Request failed:\n${String(error)}`;
  }
}

async function onApprovalAction(event) {
  const button = event.target.closest("[data-approval-entity]");
  if (!button || !isChecker) {
    return;
  }

  const entity = button.dataset.approvalEntity;
  const entityId = button.dataset.approvalId;
  const action = button.dataset.approvalAction;

  if (!entity || !entityId || !action) {
    return;
  }

  button.disabled = true;

  const endpoint =
    entity === "transaction"
      ? `/v1/payouts/batches/${encodeURIComponent(entityId)}/actions`
      : entity === "beneficiary"
        ? `/v1/beneficiaries/${encodeURIComponent(entityId)}/actions`
        : entity === "role"
          ? `/v1/auth/corporate-roles/${encodeURIComponent(entityId)}/actions`
          : `/v1/auth/users/${encodeURIComponent(entityId)}/actions`;

  const payload = {
    action,
    actedByUserId: session.userId,
    comment: `${capitalize(action)}d by checker ${session.username}`
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      approvalsList.insertAdjacentHTML(
        "afterbegin",
        `<div class="callout-card">Approval failed for ${escapeHtml(entity)} ${escapeHtml(entityId)}: ${escapeHtml(data.message || "Unknown error")}</div>`
      );
      button.disabled = false;
      return;
    }

    await refreshWorkspaceData();
  } catch (error) {
    approvalsList.insertAdjacentHTML(
      "afterbegin",
      `<div class="callout-card">Approval request failed: ${escapeHtml(String(error))}</div>`
    );
    button.disabled = false;
  }
}

function summaryCard(label, value) {
  return `
    <article class="summary-card">
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function renderTransactionCard(batch) {
  return `
    <article class="list-card">
      <h4>${escapeHtml(batch.title)}</h4>
      <p class="list-meta">
        ${escapeHtml(batch.batchId)} | ${escapeHtml(batch.state)}<br />
        Amount: INR ${formatAmount(batch.totalAmount.value)}<br />
        Reference: ${escapeHtml(batch.bankReference || "Pending")}
      </p>
    </article>
  `;
}

function renderApprovalCard(entry) {
  const config = approvalCardConfig(entry);
  const actionsMarkup = isChecker
    ? `
      <div class="action-row">
        <button class="button button-primary" data-approval-entity="${escapeHtml(config.entity)}" data-approval-id="${escapeHtml(config.id)}" data-approval-action="approve">Approve</button>
        <button class="button button-secondary" data-approval-entity="${escapeHtml(config.entity)}" data-approval-id="${escapeHtml(config.id)}" data-approval-action="reject">Reject</button>
      </div>
    `
    : `<div class="callout-card">Waiting for checker approval.</div>`;

  return `
    <article class="list-card">
      <h4>${escapeHtml(config.title)}</h4>
      <p class="list-meta">${config.meta}</p>
      ${actionsMarkup}
    </article>
  `;
}

function approvalCardConfig(entry) {
  if (entry.entity === "transaction") {
    return {
      entity: "transaction",
      id: entry.item.batchId,
      title: entry.item.title,
      meta: `${escapeHtml(entry.item.batchId)} | pending transaction approval<br />Amount: INR ${formatAmount(entry.item.totalAmount.value)}`
    };
  }

  if (entry.entity === "beneficiary") {
    return {
      entity: "beneficiary",
      id: entry.item.beneficiaryId,
      title: entry.item.name,
      meta: `${escapeHtml(entry.item.beneficiaryId)} | pending beneficiary approval<br />Account: ${escapeHtml(maskAccountNumber(entry.item.accountNumber))}`
    };
  }

  if (entry.entity === "role") {
    return {
      entity: "role",
      id: entry.item.roleId,
      title: entry.item.name,
      meta: `${escapeHtml(entry.item.roleId)} | pending role approval<br />Permissions: ${escapeHtml(entry.item.permissions.join(", ") || "None")}`
    };
  }

  return {
    entity: "user",
    id: entry.item.userId,
    title: entry.item.displayName,
    meta: `${escapeHtml(entry.item.username)} | pending user approval<br />Role: ${escapeHtml(entry.item.role)}`
  };
}

function summarizeByKey(items, key) {
  return items.reduce((accumulator, item) => {
    const value = item[key];
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function logout() {
  localStorage.removeItem("cmsCorporateSession");
  localStorage.removeItem("cmsSelectedCorporateId");
  window.location.href = "/corporate/login";
}

function toggleBeneficiaryCreatePanel() {
  beneficiaryCreatePanel.classList.toggle("hidden");
}

function closeBeneficiaryCreatePanel() {
  beneficiaryCreatePanel.classList.add("hidden");
}

function toggleTransactionCreatePanel() {
  transactionCreatePanel.classList.toggle("hidden");
}

function closeTransactionCreatePanel() {
  transactionCreatePanel.classList.add("hidden");
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("cmsCorporateSession") || "null");
  } catch (_error) {
    return null;
  }
}

function readSelectedCorporateId() {
  return localStorage.getItem("cmsSelectedCorporateId");
}

function persistSelectedCorporateId(corporateId) {
  if (corporateId) {
    localStorage.setItem("cmsSelectedCorporateId", corporateId);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }

  return response.json();
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function normalizeOptional(value) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : undefined;
}

function formatAmount(value) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderTimeline(timeline) {
  if (!timeline || timeline.length === 0) {
    return `<p class="list-meta">No timeline available.</p>`;
  }

  return timeline
    .map(
      (entry) => `
        <div class="list-meta">
          <strong>${escapeHtml(capitalize(entry.event))}</strong><br />
          ${escapeHtml(entry.userName || entry.userId || "System")} | ${escapeHtml(entry.role || "unknown role")}<br />
          ${escapeHtml(formatDateTime(entry.at))}
        </div>
      `
    )
    .join("<hr />");
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function maskAccountNumber(value) {
  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function resolveBeneficiaryActionLabel(beneficiary) {
  if (beneficiary.approvalState === "pending_approval") {
    return "Waiting for approval";
  }

  if (beneficiary.approvalState === "rejected") {
    return "Rejected";
  }

  return isMaker ? "No action" : "Maker action only";
}

function createTransactionUuid() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
