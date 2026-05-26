import { loadConfig } from "../../packages/shared/src/config.js";
import { getDatabasePool } from "../../packages/shared/src/db.js";

async function main() {
  const config = loadConfig();
  const db = getDatabasePool(config);

  try {
    console.log("Fetching corporate context from database...");
    
    // Find active maker user and corporate tenant
    const contextRes = await db.query(`
      select 
        ct.tenant_id as "corporateTenantId", 
        ct.bank_tenant_id as "bankTenantId",
        c.corporate_id as "corporateId",
        b.beneficiary_id as "beneficiaryId",
        b.name as "beneficiaryName",
        u.user_id as "userId",
        u.role as "userRole"
      from corporate_users u
      join corporate_tenants ct on ct.tenant_id = u.corporate_tenant_id
      join corporates c on c.corporate_id = u.corporate_id
      join beneficiaries b on b.corporate_id = c.corporate_id
      where u.role = 'maker'
        and b.status = 'active'
        and b.approval_state = 'approved'
      limit 1
    `);

    if (contextRes.rows.length === 0) {
      throw new Error("Cannot find valid active maker user and beneficiary context in DB.");
    }

    const ctx = contextRes.rows[0];
    console.log("Using corporate context:", ctx);

    // Fetch subscription details
    const subRes = await db.query(
      "select subscription_id, package_code from corporate_subscriptions where corporate_id = $1 limit 1",
      [ctx.corporateId]
    );
    const subscriptionId = subRes.rows[0]?.subscription_id || null;
    const packageCode = subRes.rows[0]?.package_code || "ZELPAY";

    // Fetch debit account details
    const debitRes = await db.query(
      "select debit_account_id from corporate_debit_accounts where corporate_id = $1 limit 1",
      [ctx.corporateId]
    );
    const debitAccountId = debitRes.rows[0]?.debit_account_id || null;

    console.log("Found subscription & account:", { subscriptionId, packageCode, debitAccountId });

    // Begin Database Transaction
    await db.query("BEGIN");

    // Clean up previous seeded transactions
    console.log("\nCleaning up previous simulated transaction seed records...");
    await db.query("delete from payout_items where batch_id like 'seed-txn-%'");
    await db.query("delete from payout_batches where batch_id like 'seed-txn-%'");

    console.log("\nStarting transaction generation for the last 1095 days (3 years) with compounding 10% per annum growth and weekly seasonality...");

    let totalBatchesCreated = 0;
    let totalItemsCreated = 0;

    const baseDailyVolume = 40000; // Base daily volume of ~ ₹40,000

    for (let day = 1095; day >= 0; day--) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - day);
      
      const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // 1. Calculate compounding growth factor (t goes from 0 up to 1095)
      // Compound 10% annual growth factor: P = P0 * (1 + 0.10)^(t/365)
      const t = 1095 - day;
      const growthFactor = Math.pow(1.10, t / 365);

      // 2. Seasonality multiplier
      let seasonalityFactor = 1.0;
      if (isWeekend) {
        seasonalityFactor = Math.random() * (0.22 - 0.18) + 0.18; // 18% - 22%
      } else {
        const peakBoost = (dayOfWeek === 2 || dayOfWeek === 4) ? 0.10 : 0;
        seasonalityFactor = (Math.random() * (1.28 - 1.18) + 1.18) + peakBoost; // 118% - 138%
      }

      // 3. Add noise (±4%)
      const noiseFactor = Math.random() * (1.04 - 0.96) + 0.96;

      // Calculate final target daily volume
      const targetDailyVolume = baseDailyVolume * growthFactor * seasonalityFactor * noiseFactor;

      // Split targetDailyVolume into batches
      const numBatches = isWeekend ? 1 : Math.floor(Math.random() * 2) + 2; // 1 on weekend, 2-3 on weekdays
      let remainingVolume = targetDailyVolume;

      for (let i = 0; i < numBatches; i++) {
        let batchAmount = 0;
        if (i === numBatches - 1) {
          batchAmount = parseFloat(remainingVolume.toFixed(2));
        } else {
          const frac = Math.random() * (0.6 - 0.3) + 0.3;
          batchAmount = parseFloat((remainingVolume * frac).toFixed(2));
          remainingVolume -= batchAmount;
        }

        if (batchAmount <= 0) continue;

        const timestamp = targetDate.getTime();
        const randId = Math.floor(Math.random() * 900) + 100;
        const batchId = `seed-txn-${timestamp}-${randId}-${i}`;
        const title = `Simulated Payout batch-${totalBatchesCreated + 1}`;
        const state = Math.random() > 0.08 ? "paid" : "sent_to_bank";

        // Insert Batch record
        await db.query(
          `insert into payout_batches (
             batch_id, bank_tenant_id, corporate_tenant_id, corporate_id, 
             created_by_user_id, created_by_role, title, state, total_amount, 
             subscription_id, package_code, debit_account_id, payment_method_code,
             remark, created_at, submitted_at, approved_at, completed_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'NEFT', 'Seeded compounding growth data', $13, $13, $13, $13)`,
          [
            batchId,
            ctx.bankTenantId,
            ctx.corporateTenantId,
            ctx.corporateId,
            ctx.userId,
            ctx.userRole,
            title,
            state,
            batchAmount,
            subscriptionId,
            packageCode,
            debitAccountId,
            targetDate
          ]
        );

        // Insert Item record
        const itemId = `${batchId}-item-001`;
        await db.query(
          `insert into payout_items (
             item_id, batch_id, beneficiary_id, amount, currency, purpose, 
             state, processed_at
           )
           values ($1, $2, $3, $4, 'INR', 'vendor_payout', 'processed', $5)`,
          [
            itemId,
            batchId,
            ctx.beneficiaryId,
            batchAmount,
            targetDate
          ]
        );

        totalBatchesCreated++;
        totalItemsCreated++;
      }
    }

    await db.query("COMMIT");
    console.log(`\nSuccess! Seeded ${totalBatchesCreated} payout batches with compounding 10% per annum growth trend over 3 years.`);

  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Failed to seed transaction data:", err);
  } finally {
    await db.end();
  }
}

main().catch(console.error);
