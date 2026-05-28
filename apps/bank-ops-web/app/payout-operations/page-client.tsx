"use client";

import { useEffect, useState } from "react";

type BankTenant = {
  tenantId: string;
  name: string;
};

type PayoutItem = {
  itemId: string;
  beneficiaryId: string;
  amount: { value: number };
  state: string;
  bankReference: string | null;
  failureReason: string | null;
};

type PayoutBatch = {
  batchId: string;
  title: string;
  state: string;
  bankTenantId: string;
  corporateTenantId: string;
  totalAmount: { value: number };
  bankReference: string | null;
  approvalComment: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  items: PayoutItem[];
  metadata?: Record<string, any> | null;
};

const DEFAULT_ACTION = {
  operation: "dispatch",
  actedByUserId: "bank-ops-001",
  comment: ""
};

export function PayoutOperationsPageClient() {
  const [banks, setBanks] = useState<BankTenant[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState("");
  const [actionState, setActionState] = useState(DEFAULT_ACTION);
  const [statusMessage, setStatusMessage] = useState("Loading payout queue...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void bootstrap();
  }, [bankFilter]);

  const selectedBatch = batches.find((item) => item.batchId === selectedBatchId) ?? null;

  async function bootstrap(preserveSelection = true) {
    setIsLoading(true);
    setStatusMessage("Loading payout queue...");

    try {
      const query = bankFilter ? `?bankTenantId=${encodeURIComponent(bankFilter)}` : "";
      const [banksResponse, batchesResponse] = await Promise.all([
        fetchJson<{ items: BankTenant[] }>("/v1/tenants/banks"),
        fetchJson<{ items: PayoutBatch[] }>(`/v1/payouts/batches${query}`)
      ]);

      setBanks(banksResponse.items ?? []);

      const nextBatches = batchesResponse.items ?? [];
      setBatches(nextBatches);

      if (nextBatches.length === 0) {
        setSelectedBatchId(null);
      } else if (
        !preserveSelection ||
        !nextBatches.some((item) => item.batchId === selectedBatchId)
      ) {
        setSelectedBatchId(nextBatches[0]?.batchId ?? null);
      }

      setStatusMessage("Ready.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load payout operations queue."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBatch) {
      setStatusMessage("Select a payout batch first.");
      return;
    }

    const path =
      actionState.operation === "dispatch"
        ? `/v1/payouts/batches/${encodeURIComponent(selectedBatch.batchId)}/dispatch`
        : `/v1/payouts/batches/${encodeURIComponent(
            selectedBatch.batchId
          )}/simulate-bank-response`;

    setStatusMessage("Running payout operation...");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          actedByUserId: actionState.actedByUserId,
          comment: actionState.comment
        })
      });

      const data = await response.json().catch(() => ({}));
      setStatusMessage(JSON.stringify({ status: response.status, data }, null, 2));

      if (response.ok) {
        setActionState((current) => ({ ...current, comment: "" }));
        await bootstrap();
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to run payout operation."
      );
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Bank Ops Web</p>
          <h1>Payout Operations Portal</h1>
          <p className="lead">
            Review payout batches, dispatch approved work to the mock bank, and simulate bank
            responses so operations can validate the full lifecycle in one place.
          </p>
          <div className="hero-tags">
            <span>Approval handoff</span>
            <span>Dispatch controls</span>
            <span>Item-level statuses</span>
          </div>
        </div>

        <aside className="hero-side">
          <div className="hero-card">
            <span className="hero-card-label">Today&apos;s scope</span>
            <strong>Mock bank dispatch</strong>
            <p>Operate the payout queue directly from the modern bank-ops web surface.</p>
          </div>
        </aside>
      </section>

      <section className="layout">
        <aside className="queue-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Payout Queue</p>
              <h2>Batches</h2>
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
            {batches.length === 0 ? (
              <p className="empty-state">No payout batches match this filter.</p>
            ) : (
              batches.map((batch) => (
                <button
                  key={batch.batchId}
                  className={`queue-card ${batch.batchId === selectedBatchId ? "active" : ""}`}
                  onClick={() => setSelectedBatchId(batch.batchId)}
                  type="button"
                >
                  <h3>{batch.title}</h3>
                  <p className="queue-meta">
                    {batch.batchId} | {batch.state}
                    <br />
                    Bank: {batch.bankTenantId} | Tenant: {batch.corporateTenantId}
                    <br />
                    Amount: INR {formatAmount(batch.totalAmount.value)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="detail-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Batch Detail</p>
              <h2>{selectedBatch?.title ?? "Select a payout batch"}</h2>
            </div>
            <span className="state-pill">{selectedBatch?.state ?? "No selection"}</span>
          </div>

          <div className={`detail-body ${selectedBatch ? "" : "empty-state"}`}>
            {selectedBatch ? (
              <>
                <div className="detail-grid">
                  <article className="detail-card">
                    <strong>Batch ID</strong>
                    {selectedBatch.batchId}
                  </article>
                  <article className="detail-card">
                    <strong>Bank tenant</strong>
                    {selectedBatch.bankTenantId}
                  </article>
                  <article className="detail-card">
                    <strong>Corporate tenant</strong>
                    {selectedBatch.corporateTenantId}
                  </article>
                  <article className="detail-card">
                    <strong>Total amount</strong>
                    INR {formatAmount(selectedBatch.totalAmount.value)}
                  </article>
                  <article className="detail-card">
                    <strong>Bank reference</strong>
                    {selectedBatch.bankReference || "Not sent to bank yet"}
                  </article>
                  <article className="detail-card">
                    <strong>Approval / ops comment</strong>
                    {selectedBatch.approvalComment || "No comment yet"}
                  </article>
                  <article className="detail-card">
                    <strong>Sent to bank at</strong>
                    {formatDate(selectedBatch.dispatchedAt)}
                  </article>
                  <article className="detail-card">
                    <strong>Paid at</strong>
                    {formatDate(selectedBatch.completedAt)}
                  </article>
                </div>
                <article className="detail-card">
                  <strong>Batch failure reason</strong>
                  {selectedBatch.failureReason || "No failure reason recorded"}
                </article>
                {selectedBatch.metadata && Object.keys(selectedBatch.metadata).length > 0 && (
                  <article className="detail-card">
                    <strong>Metadata</strong>
                    <pre style={{
                      background: "rgba(0, 0, 0, 0.03)",
                      border: "1px solid rgba(0, 0, 0, 0.08)",
                      borderRadius: "6px",
                      padding: "12px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      margin: "6px 0 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      textAlign: "left"
                    }}>
                      {JSON.stringify(selectedBatch.metadata, null, 2)}
                    </pre>
                  </article>
                )}
                <article className="detail-card">
                  <strong>Payout items</strong>
                  <div className="item-table">
                    {selectedBatch.items.map((item) => (
                      <div key={item.itemId} className="item-row">
                        <div>
                          <strong>{item.itemId}</strong>
                        </div>
                        <div>Beneficiary: {item.beneficiaryId}</div>
                        <div>Amount: INR {formatAmount(item.amount.value)}</div>
                        <div>Status: {item.state}</div>
                        <div>Reference: {item.bankReference || "Pending"}</div>
                        <div>Failure: {item.failureReason || "None"}</div>
                      </div>
                    ))}
                  </div>
                </article>
              </>
            ) : (
              "Choose a payout batch from the left to inspect it."
            )}
          </div>

          <form className="action-form" onSubmit={onSubmit}>
            <div className="action-grid">
              <label>
                <span>Operations action</span>
                <select
                  value={actionState.operation}
                  onChange={(event) =>
                    setActionState((current) => ({
                      ...current,
                      operation: event.target.value
                    }))
                  }
                >
                  <option value="dispatch">Dispatch to mock bank</option>
                  <option value="simulate">Simulate bank response</option>
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
              <button className="button button-primary" disabled={!selectedBatch || isLoading}>
                Run Action
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

function formatAmount(value: number) {
  return Number(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}
