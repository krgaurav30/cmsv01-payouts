import { loadConfig } from "../../packages/shared/src/config.js";
import { getDatabasePool } from "../../packages/shared/src/db.js";

const config = loadConfig();
const db = getDatabasePool(config);

async function main() {
  const columns = await db.query(
    "select column_name, data_type from information_schema.columns where table_name = 'approval_matrices'"
  );
  console.log("Columns of approval_matrices:", columns.rows);
  const result = await db.query("select * from approval_matrices");
  console.log("Approval matrices in database:", result.rows);
  await db.end();
}

main().catch(console.error);
