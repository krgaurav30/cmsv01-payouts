import pg from "pg";
import type { AppConfig } from "./config.js";

const { Pool } = pg;
export type PoolClient = pg.PoolClient;

// Parse INT8 (bigint) database columns as JavaScript numbers
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => (val ? parseInt(val, 10) : null));

let pool: pg.Pool | null = null;

export type DatabaseExecutor = {
  query: pg.Pool["query"] | pg.PoolClient["query"];
};

export function getDatabasePool(config: AppConfig) {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.databaseMaxConnections,
      ssl: {
        rejectUnauthorized: config.dbSslRejectUnauthorized
      }
    });
  }

  return pool;
}

export async function testDatabaseConnection(config: AppConfig) {
  const db = getDatabasePool(config);
  const result = await db.query(
    "select current_database() as database_name, (extract(epoch from now()) * 1000)::bigint as connected_at"
  );
  return result.rows[0];
}

export async function ensureMigrationTable(config: AppConfig) {
  const db = getDatabasePool(config);
  await db.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

export async function withDatabaseTransaction<T>(
  config: AppConfig,
  fn: (client: PoolClient) => Promise<T>
) {
  const db = getDatabasePool(config);
  const client = await db.connect();

  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
