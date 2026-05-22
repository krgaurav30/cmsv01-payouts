"use client";

import { useEffect, useState } from "react";

type BankTenant = {
  tenantId: string;
  name: string;
};

type OnboardingApplication = {
  applicationId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateTenantName: string | null;
  legalEntityName: string;
  signatoryName: string;
  pan: string;
  gstin: string | null;
  primaryCorporateAdminEmail: string;
  registeredAddress: string;
  onboardingMode: string;
  state: string;
  reviewComment: string | null;
};

const DEFAULT_ACTION = {
  action: "approve",
  actedByUserId: "bank-ops-001",
  comment: ""
};

export function OnboardingReviewPageClient() {
  const [banks, setBanks] = useState<BankTenant[]>([]);
  const [applications, setApplications] = useState<OnboardingApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState("");
  const [actionState, setActionState] = useState(DEFAULT_ACTION);
  const [statusMessage, setStatusMessage] = useState("Loading queue...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void bootstrap();
  }, [bankFilter]);

  const selectedApplication =
    applications.find((item) => item.applicationId === selectedApplicationId) ?? null;

  async function bootstrap(preserveSelection = true) {
    setIsLoading(true);
    setStatusMessage("Loading queue...");

    try {
      const query = bankFilter ? `?bankTenantId=${encodeURIComponent(bankFilter)}` : "";
      const [banksResponse, applicationsResponse] = await Promise.all([
        fetchJson<{ items: BankTenant[] }>("/v1/tenants/banks"),
        fetchJson<{ items: OnboardingApplication[] }>(`/v1/onboarding/applications${query}`)
      ]);

      setBanks(banksResponse.items ?? []);

      const nextApplications = applicationsResponse.items ?? [];
      setApplications(nextApplications);

      if (nextApplications.length === 0) {
        setSelectedApplicationId(null);
      } else if (
        !preserveSelection ||
        !nextApplications.some((item) => item.applicationId === selectedApplicationId)
      ) {
        setSelectedApplicationId(nextApplications[0]?.applicationId ?? null);
      }

      setStatusMessage("Ready.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load onboarding applications."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedApplication) {
      setStatusMessage("Select an application first.");
      return;
    }

    setStatusMessage("Applying action...");

    try {
      const response = await fetch(
        `/v1/onboarding/applications/${encodeURIComponent(selectedApplication.applicationId)}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(actionState)
        }
      );

      const data = await response.json().catch(() => ({}));
      setStatusMessage(JSON.stringify({ status: response.status, data }, null, 2));

      if (response.ok) {
        setActionState((current) => ({ ...current, comment: "" }));
        await bootstrap();
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to apply onboarding action."
      );
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Bank Ops Web</p>
          <h1>Onboarding Review Portal</h1>
          <p className="lead">
            Review incoming corporate onboarding requests, inspect their parent-tenant and
            child-corporate context, and move each application through bank approval decisions.
          </p>
          <div className="hero-tags">
            <span>Queue view</span>
            <span>Approval actions</span>
            <span>BFF-backed APIs</span>
          </div>
        </div>

        <aside className="hero-side">
          <div className="hero-card">
            <span className="hero-card-label">Today&apos;s scope</span>
            <strong>Onboarding approvals</strong>
            <p>Approve, reject, or send back live applications without leaving bank-ops-web.</p>
          </div>
        </aside>
      </section>

      <section className="layout">
        <aside className="queue-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Review Queue</p>
              <h2>Applications</h2>
            </div>
            <button className="mini-button" onClick={() => void bootstrap(false)} type="button">
              Refresh
            </button>
          </div>

          <label className="filter">
            <span>Bank tenant filter</span>
            <select value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}>
              <option value="">All bank tenants</option>
              {banks.map((bank) => (
                <option key={bank.tenantId} value={bank.tenantId}>
                  {bank.name} ({bank.tenantId})
                </option>
              ))}
            </select>
          </label>

          <div className="queue-list">
            {applications.length === 0 ? (
              <p className="empty-state">No onboarding applications match this filter.</p>
            ) : (
              applications.map((application) => (
                <button
                  key={application.applicationId}
                  className={`queue-card ${
                    application.applicationId === selectedApplicationId ? "active" : ""
                  }`}
                  onClick={() => setSelectedApplicationId(application.applicationId)}
                  type="button"
                >
                  <h3>{application.legalEntityName}</h3>
                  <p className="queue-meta">
                    {application.applicationId} | {application.state}
                    <br />
                    {application.onboardingMode}
                    <br />
                    Bank: {application.bankTenantId} | Tenant: {application.corporateTenantId}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="detail-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Application Detail</p>
              <h2>{selectedApplication?.legalEntityName ?? "Select an application"}</h2>
            </div>
            <span className="state-pill">{selectedApplication?.state ?? "No selection"}</span>
          </div>

          <div className={`detail-body ${selectedApplication ? "" : "empty-state"}`}>
            {selectedApplication ? (
              <>
                <div className="detail-grid">
                  <article className="detail-card">
                    <strong>Application</strong>
                    {selectedApplication.applicationId}
                  </article>
                  <article className="detail-card">
                    <strong>Journey</strong>
                    {selectedApplication.onboardingMode}
                  </article>
                  <article className="detail-card">
                    <strong>Bank tenant</strong>
                    {selectedApplication.bankTenantId}
                  </article>
                  <article className="detail-card">
                    <strong>Corporate tenant</strong>
                    {selectedApplication.corporateTenantId}
                  </article>
                  <article className="detail-card">
                    <strong>Corporate tenant name</strong>
                    {selectedApplication.corporateTenantName || "Derived from existing tenant"}
                  </article>
                  <article className="detail-card">
                    <strong>Signatory</strong>
                    {selectedApplication.signatoryName}
                  </article>
                  <article className="detail-card">
                    <strong>PAN</strong>
                    {selectedApplication.pan}
                  </article>
                  <article className="detail-card">
                    <strong>GSTIN</strong>
                    {selectedApplication.gstin || "Not provided"}
                  </article>
                  <article className="detail-card">
                    <strong>Primary admin</strong>
                    {selectedApplication.primaryCorporateAdminEmail}
                  </article>
                  <article className="detail-card">
                    <strong>Review comment</strong>
                    {selectedApplication.reviewComment || "No comment yet"}
                  </article>
                </div>
                <article className="detail-card">
                  <strong>Registered address</strong>
                  {selectedApplication.registeredAddress}
                </article>
              </>
            ) : (
              "Choose an onboarding request from the left to inspect it."
            )}
          </div>

          <form className="action-form" onSubmit={onSubmit}>
            <div className="action-grid">
              <label>
                <span>Bank action</span>
                <select
                  value={actionState.action}
                  onChange={(event) =>
                    setActionState((current) => ({ ...current, action: event.target.value }))
                  }
                >
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="send_back">Send back</option>
                </select>
              </label>
              <label>
                <span>Bank user ID</span>
                <input
                  required
                  value={actionState.actedByUserId}
                  onChange={(event) =>
                    setActionState((current) => ({
                      ...current,
                      actedByUserId: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label>
              <span>Comment</span>
              <textarea
                required
                rows={4}
                value={actionState.comment}
                onChange={(event) =>
                  setActionState((current) => ({ ...current, comment: event.target.value }))
                }
              />
            </label>

            <div className="action-buttons">
              <button className="button button-primary" disabled={!selectedApplication || isLoading}>
                Apply Action
              </button>
            </div>
          </form>

          <pre className="response-box">{statusMessage}</pre>
        </section>
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
