import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required (indexer state is persisted to Postgres, not a local file — " +
      "see docker-compose.yml for a local instance, or an RDS/managed connection string in prod)."
  );
}

export const sql = new SQL(databaseUrl);

// NUMERIC (not BIGINT) because these are wei-scale amounts — a few native USDC already exceeds
// int64's ~9.2e18 range. Bun.sql returns NUMERIC as a string, which BigInt() parses directly.
//
// A testnet and a mainnet server instance both migrate on boot against the same database (rows
// are partitioned by chain id, so they can safely share it) — CREATE TABLE IF NOT EXISTS is not
// atomic across concurrent sessions, so without a lock two instances starting together can both
// pass the existence check and race on creating the same table. An advisory lock scoped to one
// transaction serializes that without needing a separate migration step.
export async function migrate() {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(727001)`;
    await tx`
      CREATE TABLE IF NOT EXISTS indexer_state (
        chain_id BIGINT PRIMARY KEY,
        last_scanned_block NUMERIC NOT NULL,
        total_tor_usdc_charged NUMERIC NOT NULL,
        user_operation_count INTEGER NOT NULL,
        last_scanned_at BIGINT NOT NULL
      )
    `;
    await tx`
      CREATE TABLE IF NOT EXISTS indexer_positions (
        chain_id BIGINT NOT NULL,
        owner TEXT NOT NULL,
        deposited_total NUMERIC NOT NULL DEFAULT 0,
        withdrawn_total NUMERIC NOT NULL DEFAULT 0,
        PRIMARY KEY (chain_id, owner)
      )
    `;
  });
}
