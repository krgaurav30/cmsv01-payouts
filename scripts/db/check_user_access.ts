import { loadConfig } from "../../packages/shared/src/config.js";
import { getDatabasePool } from "../../packages/shared/src/db.js";

const config = loadConfig();
const db = getDatabasePool(config);

async function main() {
  console.log("=== USERS ===");
  const users = await db.query("select user_id, username, role, status, approval_state, corporate_tenant_id from corporate_users");
  console.log(users.rows);

  console.log("=== SUBSCRIPTIONS ===");
  const subs = await db.query("select subscription_id, package_code, status, corporate_tenant_id from corporate_subscriptions");
  console.log(subs.rows);

  console.log("=== ROLE SUBSCRIPTION ACCESS ===");
  const rsa = await db.query("select * from role_subscription_access");
  console.log(rsa.rows);

  await db.end();
}

main().catch(console.error);
