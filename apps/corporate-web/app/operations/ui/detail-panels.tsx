"use client";

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
  return (
    <>
      <div className="ops-fields two">
        <div className="ops-static-field">
          <span className="ops-context-label">Transaction Reference</span>
          <strong>{transaction.title}</strong>
        </div>
        <div className="ops-static-field">
          <span className="ops-context-label">Txn UUID</span>
          <strong>{transaction.batchId}</strong>
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
                      <span className={`ops-status ${item.state}`}>{humanize(item.state)}</span>
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
