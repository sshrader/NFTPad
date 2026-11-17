import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __nftpadPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __nftpadReady: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!global.__nftpadPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    global.__nftpadPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Railway's internal Postgres URL does not need SSL; the public proxy URL does.
      ssl: process.env.DATABASE_URL.includes("proxy.rlwy.net")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return global.__nftpadPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS coins (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  creator       TEXT NOT NULL,
  mint          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | live
  launch_mode   TEXT NOT NULL,
  pending_tx    TEXT,                             -- last prepared pool-creation tx signature (meteora mode)
  min_balance   NUMERIC NOT NULL DEFAULT 1,       -- in UI units of the token (not raw)
  max_claims    INTEGER,                          -- NULL = open edition
  claim_ends_at TIMESTAMPTZ,
  collection    TEXT,                             -- Metaplex Core collection address
  coin_image_id INTEGER,
  nft_image_id  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coins_mint_idx ON coins(mint) WHERE mint IS NOT NULL;

CREATE TABLE IF NOT EXISTS images (
  id           SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  data         BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id         SERIAL PRIMARY KEY,
  coin_id    INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  wallet     TEXT NOT NULL,
  asset      TEXT,                                -- minted Core asset address (NULL while pending)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coin_id, wallet)                        -- one claim per wallet per coin
);
`;

export async function db(): Promise<Pool> {
  const pool = getPool();
  if (!global.__nftpadReady) {
    global.__nftpadReady = pool.query(SCHEMA).then(() => undefined);
    global.__nftpadReady.catch(() => {
      global.__nftpadReady = undefined;
    });
  }
  await global.__nftpadReady;
  return pool;
}
