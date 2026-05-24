import type { FastifyPluginAsync } from "fastify";
import { loadConfig } from "@cmsv01/shared/config";
import { getDatabasePool } from "@cmsv01/shared/db";
import { randomUUID } from "node:crypto";

export const cbsSimulatorRoutes: FastifyPluginAsync = async (app) => {
  const db = getDatabasePool(loadConfig());

  // Self-heal/ensure table exists
  await db.query(`
    create table if not exists cbs_transactions (
      idempotency_key text primary key,
      account_number text not null,
      amount numeric(18,2) not null,
      cbs_reference_id text not null,
      status text not null,
      error_code text,
      error_message text,
      created_at timestamptz not null default now(),
      transaction_type text,
      narration text
    );
  `);

  await db.query(`
    alter table cbs_transactions add column if not exists transaction_type text;
    alter table cbs_transactions add column if not exists narration text;
  `);

  app.post("/v1/cbs/debit", async (request, reply) => {
    const idempotencyKey = request.headers["x-idempotency-key"] as string;
    if (!idempotencyKey) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_MISSING_IDEMPOTENCY_KEY",
        errorMessage: "X-Idempotency-Key header is required"
      });
    }

    const body = (request.body ?? {}) as {
      accountNumber: string;
      amount: string | number;
      currency?: string;
      narration?: string;
      transactionReference?: string;
    };

    const accountNumber = body.accountNumber;
    const amountVal = Number(body.amount);

    if (!accountNumber || isNaN(amountVal) || amountVal <= 0) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_INVALID_PARAMETERS",
        errorMessage: "Invalid accountNumber or amount"
      });
    }

    const existingTx = await db.query(
      `select cbs_reference_id, status, error_code, error_message, narration from cbs_transactions where idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existingTx.rowCount && existingTx.rows[0]) {
      const tx = existingTx.rows[0];
      if (tx.status === "SUCCESS") {
        return reply.status(200).send({
          status: "SUCCESS",
          cbsReferenceId: tx.cbs_reference_id,
          cachedResponse: true,
          narration: tx.narration || body.narration || "CMS Payout",
          processedAt: new Date().toISOString()
        });
      } else {
        return reply.status(422).send({
          status: "FAILED",
          errorCode: tx.error_code,
          errorMessage: tx.error_message,
          cachedResponse: true,
          processedAt: new Date().toISOString()
        });
      }
    }

    // 2. Fetch corporate debit account
    const accountResult = await db.query(
      `select debit_account_id, balance, status from corporate_debit_accounts where account_number = $1`,
      [accountNumber]
    );

    if (accountResult.rowCount === 0 || !accountResult.rows[0]) {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ACCOUNT_NOT_FOUND",
        errorMessage: `Account ${accountNumber} not found.`
      });
    }

    const account = accountResult.rows[0];
    if (account.status !== "active") {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ACCOUNT_INACTIVE",
        errorMessage: `Account ${accountNumber} is inactive.`
      });
    }

    const currentBalance = Number(account.balance);
    if (currentBalance < amountVal) {
      const errorCode = "ERR_INSUFFICIENT_BALANCE";
      const errorMessage = `Available balance (INR ${currentBalance.toFixed(2)}) is lower than debit request.`;
      
      // Save failed tx for idempotency
      await db.query(
        `insert into cbs_transactions (idempotency_key, account_number, amount, cbs_reference_id, status, error_code, error_message, transaction_type, narration)
         values ($1, $2, $3, $4, $5, $6, $7, 'debit', $8)`,
        [idempotencyKey, accountNumber, amountVal, "", "FAILED", errorCode, errorMessage, body.narration || "CMS Payout"]
      );

      return reply.status(422).send({
        status: "FAILED",
        errorCode,
        errorMessage,
        processedAt: new Date().toISOString()
      });
    }

    // 3. Process debit atomically
    const cbsRef = `CBS${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    
    try {
      await db.query("begin");
      
      // Update account balance
      await db.query(
        `update corporate_debit_accounts set balance = balance - $1 where account_number = $2`,
        [amountVal, accountNumber]
      );

      // Save transaction
      await db.query(
        `insert into cbs_transactions (idempotency_key, account_number, amount, cbs_reference_id, status, transaction_type, narration)
         values ($1, $2, $3, $4, $5, 'debit', $6)`,
        [idempotencyKey, accountNumber, amountVal, cbsRef, "SUCCESS", body.narration || "CMS Payout"]
      );

      await db.query("commit");

      // Fetch new balance
      const newBalResult = await db.query(
        `select balance from corporate_debit_accounts where account_number = $1`,
        [accountNumber]
      );
      const newBalance = newBalResult.rows[0]?.balance ?? 0;

      return reply.status(200).send({
        status: "SUCCESS",
        cbsReferenceId: cbsRef,
        availableBalance: String(newBalance),
        narration: body.narration || "CMS Payout",
        processedAt: new Date().toISOString()
      });
    } catch (err) {
      await db.query("rollback");
      return reply.status(500).send({
        status: "FAILED",
        errorCode: "ERR_SYSTEM_ERROR",
        errorMessage: "Database transaction failed in CBS simulator."
      });
    }
  });

  app.post("/v1/cbs/reverse-debit", async (request, reply) => {
    const body = (request.body ?? {}) as {
      originalCbsReferenceId: string;
      reversalIdempotencyKey: string;
      amount: string | number;
      reason?: string;
    };

    const { originalCbsReferenceId, reversalIdempotencyKey, amount } = body;
    const amountVal = Number(amount);

    if (!originalCbsReferenceId || !reversalIdempotencyKey || isNaN(amountVal) || amountVal <= 0) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_INVALID_PARAMETERS",
        errorMessage: "Invalid reversal parameters"
      });
    }

    // Check idempotency for reversal
    const existingTx = await db.query(
      `select cbs_reference_id, status from cbs_transactions where idempotency_key = $1`,
      [reversalIdempotencyKey]
    );

    if (existingTx.rowCount && existingTx.rows[0]) {
      const tx = existingTx.rows[0];
      return reply.status(200).send({
        status: "SUCCESS",
        reversalReferenceId: tx.cbs_reference_id,
        cachedResponse: true,
        processedAt: new Date().toISOString()
      });
    }

    // Locate original transaction to find account number
    const origTxResult = await db.query(
      `select account_number from cbs_transactions where cbs_reference_id = $1 and status = 'SUCCESS'`,
      [originalCbsReferenceId]
    );

    if (origTxResult.rowCount === 0 || !origTxResult.rows[0]) {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ORIGINAL_TX_NOT_FOUND",
        errorMessage: `Original transaction ${originalCbsReferenceId} not found or was not successful.`
      });
    }

    const accountNumber = origTxResult.rows[0].account_number;
    const revRef = `REV${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

    try {
      await db.query("begin");

      // Credit corporate account balance back
      await db.query(
        `update corporate_debit_accounts set balance = balance + $1 where account_number = $2`,
        [amountVal, accountNumber]
      );

      // Record reversal transaction
      await db.query(
        `insert into cbs_transactions (idempotency_key, account_number, amount, cbs_reference_id, status, transaction_type, narration)
         values ($1, $2, $3, $4, $5, 'credit', $6)`,
        [reversalIdempotencyKey, accountNumber, amountVal, revRef, "SUCCESS", body.reason || "Payout Reversal"]
      );

      await db.query("commit");

      const newBalResult = await db.query(
        `select balance from corporate_debit_accounts where account_number = $1`,
        [accountNumber]
      );
      const newBalance = newBalResult.rows[0]?.balance ?? 0;

      return reply.status(200).send({
        status: "SUCCESS",
        reversalReferenceId: revRef,
        availableBalance: String(newBalance),
        processedAt: new Date().toISOString()
      });
    } catch (err) {
      await db.query("rollback");
      return reply.status(500).send({
        status: "FAILED",
        errorCode: "ERR_SYSTEM_ERROR",
        errorMessage: "Database transaction failed in CBS simulator during reversal."
      });
    }
  });

  app.get("/v1/cbs/transactions/status/:idempotencyKey", async (request, reply) => {
    const params = request.params as { idempotencyKey: string };
    
    const result = await db.query(
      `select cbs_reference_id, account_number, amount, status, error_code, error_message, created_at
       from cbs_transactions
       where idempotency_key = $1`,
      [params.idempotencyKey]
    );

    if (result.rowCount === 0 || !result.rows[0]) {
      return reply.status(404).send({
        status: "NOT_FOUND",
        message: "No transaction found matching the provided idempotency key."
      });
    }

    const row = result.rows[0];
    return {
      status: row.status,
      cbsReferenceId: row.cbs_reference_id || null,
      accountNumber: row.account_number,
      amount: String(row.amount),
      errorCode: row.error_code || null,
      errorMessage: row.error_message || null,
      processedAt: row.created_at.toISOString()
    };
  });

  app.post("/v1/cbs/accounts/:accountNumber/deposit", async (request, reply) => {
    const params = request.params as { accountNumber: string };
    const body = (request.body ?? {}) as { amount: string | number };
    const amountVal = Number(body.amount);

    if (!params.accountNumber || isNaN(amountVal) || amountVal <= 0) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_INVALID_PARAMETERS",
        errorMessage: "Invalid accountNumber or amount"
      });
    }

    const accountResult = await db.query(
      `select debit_account_id, balance, status from corporate_debit_accounts where account_number = $1`,
      [params.accountNumber]
    );

    if (accountResult.rowCount === 0 || !accountResult.rows[0]) {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ACCOUNT_NOT_FOUND",
        errorMessage: `Account ${params.accountNumber} not found.`
      });
    }

    const cbsRef = `DEP${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const idempotencyKey = `cbs-deposit-${cbsRef}`;

    try {
      await db.query("begin");

      await db.query(
        `update corporate_debit_accounts set balance = balance + $1 where account_number = $2`,
        [amountVal, params.accountNumber]
      );

      await db.query(
        `insert into cbs_transactions (idempotency_key, account_number, amount, cbs_reference_id, status, transaction_type, narration)
         values ($1, $2, $3, $4, $5, 'credit', 'Funds Deposit')`,
        [idempotencyKey, params.accountNumber, amountVal, cbsRef, "SUCCESS"]
      );

      await db.query("commit");

      const newBalResult = await db.query(
        `select balance from corporate_debit_accounts where account_number = $1`,
        [params.accountNumber]
      );
      const newBalance = newBalResult.rows[0]?.balance ?? 0;

      return reply.status(200).send({
        status: "SUCCESS",
        cbsReferenceId: cbsRef,
        availableBalance: String(newBalance),
        processedAt: new Date().toISOString()
      });
    } catch (err) {
      await db.query("rollback");
      return reply.status(500).send({
        status: "FAILED",
        errorCode: "ERR_SYSTEM_ERROR",
        errorMessage: "Database transaction failed in CBS simulator."
      });
    }
  });

  app.post("/v1/cbs/accounts/:accountNumber/withdraw", async (request, reply) => {
    const params = request.params as { accountNumber: string };
    const body = (request.body ?? {}) as { amount: string | number };
    const amountVal = Number(body.amount);

    if (!params.accountNumber || isNaN(amountVal) || amountVal <= 0) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_INVALID_PARAMETERS",
        errorMessage: "Invalid accountNumber or amount"
      });
    }

    const accountResult = await db.query(
      `select debit_account_id, balance, status from corporate_debit_accounts where account_number = $1`,
      [params.accountNumber]
    );

    if (accountResult.rowCount === 0 || !accountResult.rows[0]) {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ACCOUNT_NOT_FOUND",
        errorMessage: `Account ${params.accountNumber} not found.`
      });
    }

    const account = accountResult.rows[0];
    if (account.status !== "active") {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_ACCOUNT_INACTIVE",
        errorMessage: `Account ${params.accountNumber} is inactive.`
      });
    }

    const currentBalance = Number(account.balance);
    if (currentBalance < amountVal) {
      return reply.status(422).send({
        status: "FAILED",
        errorCode: "ERR_INSUFFICIENT_BALANCE",
        errorMessage: `Available balance (INR ${currentBalance.toFixed(2)}) is lower than withdrawal request.`
      });
    }

    const cbsRef = `WTH${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const idempotencyKey = `cbs-withdraw-${cbsRef}`;

    try {
      await db.query("begin");

      await db.query(
        `update corporate_debit_accounts set balance = balance - $1 where account_number = $2`,
        [amountVal, params.accountNumber]
      );

      await db.query(
        `insert into cbs_transactions (idempotency_key, account_number, amount, cbs_reference_id, status, transaction_type, narration)
         values ($1, $2, $3, $4, $5, 'debit', 'Funds Withdrawal')`,
        [idempotencyKey, params.accountNumber, amountVal, cbsRef, "SUCCESS"]
      );

      await db.query("commit");

      const newBalResult = await db.query(
        `select balance from corporate_debit_accounts where account_number = $1`,
        [params.accountNumber]
      );
      const newBalance = newBalResult.rows[0]?.balance ?? 0;

      return reply.status(200).send({
        status: "SUCCESS",
        cbsReferenceId: cbsRef,
        availableBalance: String(newBalance),
        processedAt: new Date().toISOString()
      });
    } catch (err) {
      await db.query("rollback");
      return reply.status(500).send({
        status: "FAILED",
        errorCode: "ERR_SYSTEM_ERROR",
        errorMessage: "Database transaction failed in CBS simulator."
      });
    }
  });

  app.get("/v1/cbs/accounts/:accountNumber/ledger", async (request, reply) => {
    const params = request.params as { accountNumber: string };
    
    const result = await db.query(
      `select idempotency_key, amount, cbs_reference_id, status, error_code, error_message, created_at,
              coalesce(transaction_type, 'debit') as transaction_type,
              coalesce(narration, 'CBS Core Transaction') as narration
       from cbs_transactions
       where account_number = $1 and status = 'SUCCESS'
       order by created_at desc`,
      [params.accountNumber]
    );

    return result.rows.map(row => ({
      idempotencyKey: row.idempotency_key,
      amount: String(row.amount),
      cbsReferenceId: row.cbs_reference_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      transactionType: row.transaction_type,
      narration: row.narration
    }));
  });

  app.post("/v1/payment-hub/transfer", async (request, reply) => {
    const body = (request.body ?? {}) as {
      batchId: string;
      utr: string;
      narration: string;
      amount: string | number;
      beneficiaryAccount: string;
      beneficiaryName: string;
      paymentMethod: string;
    };

    const { batchId, utr, narration, amount, beneficiaryAccount, beneficiaryName, paymentMethod } = body;
    const amountVal = Number(amount);

    if (!batchId || !utr || isNaN(amountVal) || amountVal <= 0) {
      return reply.status(400).send({
        status: "FAILED",
        errorCode: "ERR_INVALID_PARAMETERS",
        errorMessage: "Invalid batchId, utr, or amount"
      });
    }

    const isFailureAmount = String(amountVal).endsWith(".99");

    if (isFailureAmount) {
      return reply.status(422).send({
        status: "FAILED",
        clearingReferenceId: null,
        errorCode: "ERR_CLEARING_REJECTED",
        errorMessage: "Clearing rail rejected the transfer request.",
        processedAt: new Date().toISOString()
      });
    }

    const clearingRef = `PH${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

    return reply.status(200).send({
      status: "SUCCESS",
      clearingReferenceId: clearingRef,
      narration: narration || `CMS Payout ${batchId}`,
      processedAt: new Date().toISOString()
    });
  });
};
