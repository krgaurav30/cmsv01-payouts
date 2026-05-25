import { randomUUID } from "node:crypto";
import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { PayoutManagementService } from "../payout-management/service.js";
import type { CheckoutSession, CheckoutSessionCreateRequest } from "./contracts.js";

type CheckoutSessionRow = {
  checkout_session_id: string;
  bank_tenant_id: string;
  corporate_tenant_id: string;
  corporate_id: string;
  transaction_reference: string;
  amount_value: string;
  amount_currency: string;
  package_code: string | null;
  beneficiary_id: string;
  payment_method_code: string | null;
  redirect_url: string | null;
  cancel_url: string | null;
  status: "open" | "completed" | "expired";
  created_at: Date;
  expires_at: Date;
  completed_at: Date | null;
  metadata_json: any;
};

export class CheckoutSessionService {
  private readonly db = getDatabasePool(loadConfig());
  private readonly payoutManagementService = new PayoutManagementService();

  async createCheckoutSession(payload: CheckoutSessionCreateRequest) {
    const checkoutSessionId = `cs_live_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes expiry

    // We can define base URL based on config, or use a default
    const config = loadConfig();
    const checkoutBaseUrl = process.env.NEXT_PUBLIC_BANK_OPS_WEB_URL || "https://cmsv01-bank-ops-web-kumar-gaurav-s-projects.vercel.app";
    const checkoutUrl = `${checkoutBaseUrl}/checkout/${checkoutSessionId}`;

    await this.db.query(
      `insert into checkout_sessions (
         checkout_session_id, bank_tenant_id, corporate_tenant_id, corporate_id,
         transaction_reference, amount_value, amount_currency, package_code,
         beneficiary_id, payment_method_code, redirect_url, cancel_url,
         status, created_at, expires_at, metadata_json
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open', now(), $13, $14)`,
      [
        checkoutSessionId,
        payload.bankTenantId,
        payload.corporateTenantId,
        payload.corporateId,
        payload.transactionReference,
        payload.amount.value,
        payload.amount.currency,
        payload.packageCode ?? null,
        payload.beneficiaryId,
        payload.paymentMethodCode ?? null,
        payload.redirectUrl ?? null,
        payload.cancelUrl ?? null,
        expiresAt,
        JSON.stringify(payload.metadata ?? {})
      ]
    );

    return {
      checkoutSessionId,
      checkoutUrl,
      expiresAt: expiresAt.toISOString()
    };
  }

  async getCheckoutSession(sessionId: string): Promise<CheckoutSession | null> {
    const result = await this.db.query<CheckoutSessionRow>(
      `select * from checkout_sessions where checkout_session_id = $1`,
      [sessionId]
    );

    const row = result.rows[0];
    if (!row) return null;

    // Check if expired and open
    if (row.status === "open" && new Date() > new Date(row.expires_at)) {
      await this.db.query(
        `update checkout_sessions set status = 'expired' where checkout_session_id = $1`,
        [sessionId]
      );
      row.status = "expired";
    }

    return {
      checkoutSessionId: row.checkout_session_id,
      bankTenantId: row.bank_tenant_id,
      corporateTenantId: row.corporate_tenant_id,
      corporateId: row.corporate_id,
      transactionReference: row.transaction_reference,
      amountValue: row.amount_value,
      amountCurrency: row.amount_currency,
      packageCode: row.package_code,
      beneficiaryId: row.beneficiary_id,
      paymentMethodCode: row.payment_method_code,
      redirectUrl: row.redirect_url,
      cancelUrl: row.cancel_url,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
      metadataJson: row.metadata_json || {}
    };
  }

  async processPayment(
    sessionId: string, 
    actorUsername: string,
    overrides?: {
      packageCode?: string;
      debitAccountId?: string;
      paymentMethodCode?: string;
      beneficiaryId?: string;
      remark?: string;
    }
  ) {
    const session = await this.getCheckoutSession(sessionId);
    if (!session) {
      return { error: "session_not_found" as const };
    }

    if (session.status !== "open") {
      return { error: "invalid_session_status" as const, status: session.status };
    }

    const finalPackageCode = overrides?.packageCode || session.packageCode;
    const finalBeneficiaryId = overrides?.beneficiaryId || session.beneficiaryId;
    const finalPaymentMethodCode = overrides?.paymentMethodCode || session.paymentMethodCode;
    const finalDebitAccountId = overrides?.debitAccountId;

    if (!finalPackageCode) {
      return { error: "transaction_creation_failed" as const, details: "packageCode is required" };
    }

    if (!finalBeneficiaryId) {
      return { error: "transaction_creation_failed" as const, details: "beneficiaryId is required" };
    }

    // Call createPublishedTransaction to execute the payout
    const result = await this.payoutManagementService.createPublishedTransaction({
      bankTenantId: session.bankTenantId,
      corporateTenantId: session.corporateTenantId,
      corporateId: session.corporateId,
      packageCode: finalPackageCode,
      debitAccountId: finalDebitAccountId ?? undefined,
      paymentMethodCode: finalPaymentMethodCode ?? undefined,
      actorUsername: actorUsername,
      txnTitle: session.transactionReference,
      beneficiaryId: finalBeneficiaryId,
      amount: {
        value: Number(session.amountValue),
        currency: session.amountCurrency as "INR"
      },
      tag: "checkout_sdk",
      remark: overrides?.remark || `Paid via Checkout Session ${sessionId}`
    });

    if (!("data" in result)) {
      return { error: "transaction_creation_failed" as const, details: result.error };
    }

    // Update session status to completed
    await this.db.query(
      `update checkout_sessions 
       set status = 'completed', completed_at = now() 
       where checkout_session_id = $1`,
      [sessionId]
    );

    const resultData = (result as { data: any }).data;
    return {
      success: true as const,
      commandId: resultData.commandId,
      batchId: resultData.batchId,
      status: resultData.status,
      subscriptionId: resultData.subscriptionId,
      packageCode: resultData.packageCode
    };
  }

  async getCheckoutSessionOptions(sessionId: string) {
    const session = await this.getCheckoutSession(sessionId);
    if (!session) return null;

    const corporateTenantId = session.corporateTenantId;

    // 1. Fetch active subscriptions/packages
    const subsResult = await this.db.query<{
      package_code: string;
      display_name: string;
      allowed_beneficiary_types: string[] | null;
    }>(
      `select cs.package_code, cs.display_name, p.allowed_beneficiary_types
       from corporate_subscriptions cs
       join packages p on p.package_id = cs.package_id
       where cs.corporate_tenant_id = $1 and cs.status = 'active'
       order by cs.package_code`,
      [corporateTenantId]
    );

    const packages = subsResult.rows.map(row => ({
      packageCode: row.package_code,
      name: row.display_name,
      allowedBeneficiaryTypes: row.allowed_beneficiary_types || []
    }));

    // 2. Fetch allowed debit accounts for those subscriptions
    const debitResult = await this.db.query<{
      subscription_id: string;
      package_code: string;
      debit_account_id: string;
      account_name: string;
      account_number: string;
      ifsc: string;
      allowed_payment_method_codes: string[] | null;
    }>(
      `select sda.subscription_id, cs.package_code, sda.debit_account_id, cda.account_name, cda.account_number, cda.ifsc, sda.allowed_payment_method_codes
       from subscription_debit_accounts sda
       join corporate_debit_accounts cda on cda.debit_account_id = sda.debit_account_id
       join corporate_subscriptions cs on cs.subscription_id = sda.subscription_id
       where cs.corporate_tenant_id = $1 and sda.status = 'active' and cs.status = 'active'
       order by cda.account_name`,
      [corporateTenantId]
    );

    const debitAccounts = debitResult.rows.map(row => ({
      debitAccountId: row.debit_account_id,
      accountName: row.account_name,
      accountNumber: row.account_number,
      ifsc: row.ifsc,
      packageCode: row.package_code,
      allowedPaymentMethods: row.allowed_payment_method_codes || []
    }));

    // 3. Fetch active and approved beneficiaries
    const benResult = await this.db.query<{
      beneficiary_id: string;
      name: string;
      type: string;
      account_number: string;
      ifsc: string;
    }>(
      `select beneficiary_id, name, type, account_number, ifsc
       from beneficiaries
       where corporate_tenant_id = $1 and status = 'active' and approval_state = 'approved'
       order by name`,
      [corporateTenantId]
    );

    const beneficiaries = benResult.rows.map(row => ({
      beneficiaryId: row.beneficiary_id,
      name: row.name,
      type: row.type,
      accountNumber: row.account_number,
      ifsc: row.ifsc
    }));

    return {
      packages,
      debitAccounts,
      beneficiaries
    };
  }
}
