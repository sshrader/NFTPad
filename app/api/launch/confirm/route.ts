import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getConnection, mintExists } from "@/lib/solana";
import { finalizeCoin } from "@/lib/finalize";
import { verifyPool } from "@/lib/meteora";

export const runtime = "nodejs";

/**
 * Step 2 (meteora mode only). After the creator's wallet has sent the pool-creation transaction,
 * the browser posts { coinId, signature }. We check that the transaction landed without error,
 * then create the NFT collection and mark the coin live.
 */
export async function POST(req: Request) {
  try {
    const { coinId, signature } = (await req.json()) as { coinId: number; signature: string };
    if (!Number.isInteger(coinId) || typeof signature !== "string")
      return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const pool = await db();
    const { rows } = await pool.query("SELECT id, status, launch_mode FROM coins WHERE id = $1", [coinId]);
    const coin = rows[0];
    if (!coin) return NextResponse.json({ error: "Coin not found" }, { status: 404 });
    if (coin.launch_mode !== "meteora") return NextResponse.json({ error: "Nothing to confirm" }, { status: 400 });
    if (coin.status === "live") return NextResponse.json({ coinId, live: true });

    const st = await getConnection().getSignatureStatus(signature, { searchTransactionHistory: true });
    const v = st.value;
    if (!v) return NextResponse.json({ error: "Transaction not found yet. Try again in a few seconds." }, { status: 409 });
    if (v.err) return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
    if (v.confirmationStatus !== "confirmed" && v.confirmationStatus !== "finalized")
      return NextResponse.json({ error: "Transaction not confirmed yet. Try again in a few seconds." }, { status: 409 });

    // A random successful transaction must not be enough: the coin's mint must have a pool made
    // from OUR config by the wallet that launched it.
    const row = await pool.query("SELECT mint, creator FROM coins WHERE id = $1", [coinId]);
    const { mint, creator } = row.rows[0] ?? {};
    if (!mint || !(await mintExists(mint)))
      return NextResponse.json({ error: "Token mint not found on-chain yet" }, { status: 409 });
    const check = await verifyPool(mint, creator);
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: 400 });

    await pool.query("UPDATE coins SET pending_tx = $1 WHERE id = $2", [signature, coinId]);
    await finalizeCoin(coinId);
    return NextResponse.json({ coinId, live: true });
  } catch (e) {
    console.error("launch/confirm failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Confirm failed" }, { status: 500 });
  }
}
