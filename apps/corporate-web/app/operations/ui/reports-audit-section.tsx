"use client";

import type { PayoutBatch } from "../../../lib/types";

type SetupAuditEntry = {
  id: string;
  entity: "role" | "user";
  itemName: string;
  action: "created" | "updated" | "approved" | "rejected";
  happenedAt: string | null;
  actorRole: string | null;
  state: string;
  remark: string | null;
};

type ReportMetrics = {
  approvalPendingCount: number;
  approvedBeneficiaryCount: number;
  totalUploadedRows: number;
  totalProcessedAmount: number;
  transactionStatusRows: Array<{ state: string; count: number; share: number }>;
  beneficiaryTypeRows: Array<{ beneficiaryType: string; count: number }>;
  uploadStatusRows: Array<{ status: string; count: number }>;
  recentTransactions: PayoutBatch[];
};

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAmount(value: number) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateTime(value: string | null) {
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

export function ReportsSection({
  fileUploadCount,
  transactionCount,
  reportMetrics
}: {
  fileUploadCount: number;
  transactionCount: number;
  reportMetrics: ReportMetrics;
}) {
  return (
    <section className="ops-page active">
      <div className="ops-summary">
        <article className="ops-stat">
          <strong>{transactionCount}</strong>
          <span>Total transactions</span>
        </article>
        <article className="ops-stat">
          <strong>INR {formatAmount(reportMetrics.totalProcessedAmount)}</strong>
          <span>Approved and processed amount</span>
        </article>
        <article className="ops-stat">
          <strong>{reportMetrics.approvedBeneficiaryCount}</strong>
          <span>Approved active beneficiaries</span>
        </article>
        <article className="ops-stat">
          <strong>{reportMetrics.approvalPendingCount}</strong>
          <span>Pending approvals</span>
        </article>
      </div>

      <div className="ops-grid">
        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Transaction status mix</h3>
              <p className="ops-meta">
                Live distribution of transactions by current lifecycle state.
              </p>
            </div>
          </div>
          <div className="ops-stack">
            {reportMetrics.transactionStatusRows.length > 0 ? (
              reportMetrics.transactionStatusRows.map((row) => (
                <div className="ops-report-row" key={row.state}>
                  <div className="ops-report-row-head">
                    <strong>{humanize(row.state)}</strong>
                    <span className="ops-meta">
                      {row.count} transactions · {row.share}%
                    </span>
                  </div>
                  <div className="ops-report-bar">
                    <span className="ops-report-bar-fill" style={{ width: `${row.share}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="ops-empty">No transaction activity yet.</p>
            )}
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Beneficiary type mix</h3>
              <p className="ops-meta">
                Where the current beneficiary base is concentrated by type.
              </p>
            </div>
          </div>
          <div className="ops-stack">
            {reportMetrics.beneficiaryTypeRows.length > 0 ? (
              reportMetrics.beneficiaryTypeRows.map((row) => (
                <div className="ops-report-row" key={row.beneficiaryType}>
                  <div className="ops-report-row-head">
                    <strong>{row.beneficiaryType}</strong>
                    <span className="ops-meta">{row.count} beneficiaries</span>
                  </div>
                  <div className="ops-report-bar">
                    <span
                      className="ops-report-bar-fill"
                      style={{
                        width: `${Math.max(
                          12,
                          Math.round(
                            (row.count /
                              Math.max(reportMetrics.beneficiaryTypeRows[0]?.count ?? 1, 1)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="ops-empty">No beneficiary types available yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="ops-grid">
        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Bulk upload performance</h3>
              <p className="ops-meta">File upload outcomes and total rows processed so far.</p>
            </div>
          </div>
          <div className="ops-summary">
            <article className="ops-stat">
              <strong>{fileUploadCount}</strong>
              <span>Total uploaded files</span>
            </article>
            <article className="ops-stat">
              <strong>{reportMetrics.totalUploadedRows}</strong>
              <span>Total rows processed</span>
            </article>
          </div>
          <div className="ops-stack">
            {reportMetrics.uploadStatusRows.length > 0 ? (
              reportMetrics.uploadStatusRows.map((row) => (
                <div className="ops-report-row-head" key={row.status}>
                  <strong>{humanize(row.status)}</strong>
                  <span className={`ops-status ${row.status}`}>{row.count}</span>
                </div>
              ))
            ) : (
              <p className="ops-empty">No file uploads recorded yet.</p>
            )}
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Recent transactions</h3>
              <p className="ops-meta">The latest payout instructions moving through the system.</p>
            </div>
          </div>
          <div className="ops-table-shell">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {reportMetrics.recentTransactions.length > 0 ? (
                  reportMetrics.recentTransactions.map((transaction) => (
                    <tr key={transaction.batchId}>
                      <td>
                        <strong>{transaction.title}</strong>
                        <br />
                        <span className="ops-meta">{transaction.batchId}</span>
                      </td>
                      <td>INR {formatAmount(transaction.totalAmount.value)}</td>
                      <td>
                        <span className={`ops-status ${transaction.state}`}>
                          {humanize(transaction.state)}
                        </span>
                      </td>
                      <td>{formatDateTime(transaction.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="ops-empty-row" colSpan={4}>
                      No recent transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

export function AuditSection({
  activeSectionLabel,
  setupAuditEntries
}: {
  activeSectionLabel: string;
  setupAuditEntries: SetupAuditEntry[];
}) {
  return (
    <section className="ops-page active">
      <section className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h3>{activeSectionLabel}</h3>
            <p className="ops-meta">
              Setup-only audit trail for roles and users. Payment and beneficiary activity is
              intentionally excluded here.
            </p>
          </div>
        </div>

        <div className="ops-table-shell">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Name</th>
                <th>Action</th>
                <th>When</th>
                <th>Actor Role</th>
                <th>State</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {setupAuditEntries.length > 0 ? (
                setupAuditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{capitalize(entry.entity)}</td>
                    <td>{entry.itemName}</td>
                    <td>{capitalize(entry.action)}</td>
                    <td>{formatDateTime(entry.happenedAt)}</td>
                    <td>{entry.actorRole ?? "System"}</td>
                    <td>
                      <span className={`ops-status ${entry.state}`}>{humanize(entry.state)}</span>
                    </td>
                    <td>{entry.remark ?? "No remarks"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="ops-empty-row" colSpan={7}>
                    No setup audit activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
