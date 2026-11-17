import { db } from "./db";
import { createCoinCollection } from "./mint";

/** Create the NFT collection for a coin and mark it live. Safe to call more than once. */
export async function finalizeCoin(coinId: number): Promise<void> {
  const pool = await db();
  const { rows } = await pool.query("SELECT id, name, symbol, collection, status FROM coins WHERE id = $1", [coinId]);
  const coin = rows[0];
  if (!coin) throw new Error("Coin not found");
  if (coin.status === "live") return;

  let collection: string | null = coin.collection;
  if (!collection) {
    const base = process.env.PUBLIC_BASE_URL || "";
    collection = await createCoinCollection(`${coin.name} Holders`, `${base}/api/coins/${coinId}/collection-metadata`);
  }
  await pool.query("UPDATE coins SET collection = $1, status = 'live' WHERE id = $2", [collection, coinId]);
}
