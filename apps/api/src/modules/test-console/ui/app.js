const outputIds = {
  tenants: document.getElementById("tenant-output"),
  onboarding: document.getElementById("onboarding-output"),
  beneficiaries: document.getElementById("beneficiary-output"),
  payouts: document.getElementById("payout-output"),
  beneficiaryForm: document.getElementById("beneficiary-form-output"),
  payoutForm: document.getElementById("payout-form-output"),
  approvalForm: document.getElementById("approval-form-output")
};

document.getElementById("refresh-all").addEventListener("click", refreshAll);
document.getElementById("beneficiary-form").addEventListener("submit", onBeneficiarySubmit);
document.getElementById("payout-form").addEventListener("submit", onPayoutSubmit);
document.getElementById("approval-form").addEventListener("submit", onApprovalSubmit);

refreshAll();

async function refreshAll() {
  await Promise.all([
    loadInto("/v1/tenants/banks", outputIds.tenants, "Bank tenants"),
    loadInto("/v1/onboarding/applications", outputIds.onboarding, "Onboarding applications"),
    loadInto("/v1/beneficiaries", outputIds.beneficiaries, "Beneficiaries"),
    loadInto("/v1/payouts/batches", outputIds.payouts, "Payout batches")
  ]);
}

async function onBeneficiarySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    beneficiaryId: data.get("beneficiaryId"),
    bankTenantId: data.get("bankTenantId"),
    corporateTenantId: data.get("corporateTenantId"),
    name: data.get("name"),
    accountNumber: data.get("accountNumber"),
    ifsc: data.get("ifsc"),
    type: data.get("type"),
    pan: data.get("pan"),
    gstin: normalizeOptional(data.get("gstin")),
    category: data.get("category"),
    tags: String(data.get("tags") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };

  await postJson("/v1/beneficiaries", payload, outputIds.beneficiaryForm);
  await refreshAll();
}

async function onPayoutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    batchId: data.get("batchId"),
    bankTenantId: data.get("bankTenantId"),
    corporateTenantId: data.get("corporateTenantId"),
    createdByUserId: data.get("createdByUserId"),
    title: data.get("title"),
    items: [
      {
        itemId: data.get("itemId"),
        beneficiaryId: data.get("beneficiaryId"),
        amount: Number(data.get("amount")),
        currency: data.get("currency"),
        purpose: data.get("purpose")
      }
    ]
  };

  await postJson("/v1/payouts/batches", payload, outputIds.payoutForm);
  await refreshAll();
}

async function onApprovalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const batchId = data.get("batchId");

  const payload = {
    action: data.get("action"),
    actedByUserId: data.get("actedByUserId"),
    comment: normalizeOptional(data.get("comment"))
  };

  await postJson(`/v1/payouts/batches/${batchId}/actions`, payload, outputIds.approvalForm);
  await refreshAll();
}

async function loadInto(url, target, label) {
  target.textContent = `${label} loading...`;
  try {
    const response = await fetch(url);
    const json = await response.json();
    target.textContent = JSON.stringify(json, null, 2);
  } catch (error) {
    target.textContent = `${label} failed:\n${String(error)}`;
  }
}

async function postJson(url, payload, target) {
  target.textContent = "Sending request...";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    target.textContent = JSON.stringify(
      {
        status: response.status,
        data: json
      },
      null,
      2
    );
  } catch (error) {
    target.textContent = `Request failed:\n${String(error)}`;
  }
}

function normalizeOptional(value) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : undefined;
}
