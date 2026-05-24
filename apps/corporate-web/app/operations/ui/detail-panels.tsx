"use client";

import { useState } from "react";
import type {
  CorporateDebitAccount,
  CorporateSubscription,
  PackageCatalogEntry,
  PayoutBatch,
  PayoutFileUpload,
  PayoutTimelineEvent,
  SubscriptionDebitAccountAccess
} from "../../../lib/types";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
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

function renderTimeline(timeline: PayoutTimelineEvent[]) {
  if (timeline.length === 0) {
    return <p className="ops-meta">No timeline available.</p>;
  }

  return (
    <div className="ops-stack">
      {timeline.map((event, index) => (
        <div key={`${event.event}-${event.at ?? "na"}-${index}`}>
          <strong>{capitalize(event.event)}</strong>
          <p className="ops-meta">
            {(event.userName ?? event.userId ?? "System") + " | " + (event.role ?? "unknown role")}
            <br />
            {formatDateTime(event.at)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TransactionDetailsBody({
  transaction,
  subscription,
  debitAccount
}: {
  transaction: PayoutBatch;
  subscription: CorporateSubscription | null;
  debitAccount: CorporateDebitAccount | SubscriptionDebitAccountAccess | null;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {transaction.state === "failed" && transaction.failureReason && (
        <div style={{
          background: "var(--danger-soft)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          color: "var(--danger)",
          fontSize: "13px",
          fontWeight: 500,
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 600 }}>Transaction Failed:</span>{" "}
            {transaction.failureReason}
          </div>
        </div>
      )}

      <div className="ops-fields two">
        <div className="ops-static-field">
          <span className="ops-context-label">Transaction Reference</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <strong>{transaction.title}</strong>
            <button
              type="button"
              onClick={() => handleCopy("title", transaction.title)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: copiedId === "title" ? "var(--success)" : "var(--text-tertiary)",
                display: "inline-flex",
                alignItems: "center"
              }}
              title="Copy Reference"
            >
              {copiedId === "title" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
            </button>
          </div>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Txn UUID</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <strong style={{ fontFamily: "monospace", fontSize: "13px" }}>{transaction.batchId}</strong>
            <button
              type="button"
              onClick={() => handleCopy("batchId", transaction.batchId)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: copiedId === "batchId" ? "var(--success)" : "var(--text-tertiary)",
                display: "inline-flex",
                alignItems: "center"
              }}
              title="Copy UUID"
            >
              {copiedId === "batchId" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
            </button>
          </div>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Package</span>
          <strong>
            {subscription
              ? `${subscription.displayName} (${subscription.packageCode})`
              : transaction.packageCode ?? "No package"}
          </strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Debit Account</span>
          <strong>
            {debitAccount
              ? `${debitAccount.accountNumber} - ${debitAccount.accountName}`
              : "Not captured"}
          </strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Payment Method</span>
          <strong>{transaction.paymentMethodCode ?? "Not captured"}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Beneficiary</span>
          <strong>
            {transaction.primaryBeneficiaryId
              ? `${transaction.primaryBeneficiaryId} - ${
                  transaction.primaryBeneficiaryName ?? "Unknown beneficiary"
                }`
              : transaction.primaryBeneficiaryName ?? "Unknown beneficiary"}
          </strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Amount</span>
          <strong>INR {formatAmount(transaction.totalAmount.value)}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Approval Progress</span>
          <strong>
            Level {transaction.currentApprovalLevel ?? 1} of{" "}
            {transaction.approvalLevelsRequired ?? 1}
          </strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Approval Roles</span>
          <strong>{transaction.approvalRoles.join(", ") || "Any checker"}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Tag</span>
          <strong>{transaction.tag ?? "Not tagged"}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Remark</span>
          <strong>{transaction.remark ?? "No remark"}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Created</span>
          <strong>{formatDateTime(transaction.createdAt)}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Submitted</span>
          <strong>{formatDateTime(transaction.submittedAt)}</strong>
        </div>
      </div>

      <div className="ops-static-field">
        <span className="ops-context-label">Line Items</span>
        {transaction.items.length > 0 ? (
          <div className="ops-table-shell">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Beneficiary ID</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item) => (
                  <tr key={item.itemId}>
                    <td>{item.beneficiaryId}</td>
                    <td>INR {formatAmount(item.amount.value)}</td>
                    <td>{item.purpose}</td>
                    <td>
                      <span className={`ops-status ${transaction.state === "failed" ? "failed" : item.state}`}>
                        {transaction.state === "failed" ? "Failed" : humanize(item.state)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ops-meta">No line items available.</p>
        )}
      </div>

      {transaction.timeline.length > 0 ? (
        <div className="ops-timeline ops-sidesheet-timeline">
          <p className="ops-kicker">Timeline</p>
          {renderTimeline(transaction.timeline)}
        </div>
      ) : null}
    </>
  );
}

export function BulkFileApprovalDetailsBody({
  bundle
}: {
  bundle: {
    uploadId: string;
    fileUpload: PayoutFileUpload;
    packageEntry: PackageCatalogEntry;
    childTransactions: PayoutBatch[];
    pendingTransactions: PayoutBatch[];
    totalAmount: number;
  };
}) {
  return (
    <>
      <div className="ops-fields two">
        <div className="ops-static-field">
          <span className="ops-context-label">Package</span>
          <strong>
            {bundle.packageEntry.name} ({bundle.packageEntry.packageCode})
          </strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Uploaded by</span>
          <strong>{bundle.fileUpload.uploadedByName ?? bundle.fileUpload.uploadedByUserId}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Pending transactions</span>
          <strong>{bundle.pendingTransactions.length}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Total transactions in file</span>
          <strong>{bundle.childTransactions.length}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Pending amount</span>
          <strong>INR {formatAmount(bundle.totalAmount)}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Failure handling</span>
          <strong>{humanize(bundle.packageEntry.defaultFileRejectionMode)}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Bulk approval</span>
          <strong>{bundle.packageEntry.bulkApproveEnabled ? "Enabled" : "Disabled"}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Uploaded at</span>
          <strong>{formatDateTime(bundle.fileUpload.uploadedAt)}</strong>
        </div>
      </div>

      <div className="ops-static-field">
        <span className="ops-context-label">Included transactions</span>
        {bundle.childTransactions.length > 0 ? (
          <div className="ops-table-shell">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Txn UUID</th>
                  <th>Payment method</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bundle.childTransactions.map((transaction) => (
                  <tr key={transaction.batchId}>
                    <td>{transaction.title}</td>
                    <td>{transaction.batchId}</td>
                    <td>{transaction.paymentMethodCode ?? "Not captured"}</td>
                    <td>INR {formatAmount(transaction.totalAmount.value)}</td>
                    <td>
                      <span className={`ops-status ${transaction.state}`}>
                        {humanize(transaction.state)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ops-meta">No transactions are linked to this file yet.</p>
        )}
      </div>
    </>
  );
}
