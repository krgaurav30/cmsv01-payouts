import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "../../packages/shared/src/config.js";
import { ensureMigrationTable, getDatabasePool } from "../../packages/shared/src/db.js";

const config = loadConfig();
const db = getDatabasePool(config);

async function main() {
  await ensureMigrationTable(config);

  const migrationsDir = path.resolve("scripts", "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const alreadyApplied = await db.query(
      "select 1 from schema_migrations where version = $1",
      [version]
    );

    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");

    await db.query("begin");
    try {
      await db.query(sql);
      await db.query(
        "insert into schema_migrations (version) values ($1)",
        [version]
      );
      await db.query("commit");
      console.log(`applied migration ${version}`);
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }

  console.log("database migrations complete");
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
