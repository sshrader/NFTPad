import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWalletSignature } from "@/lib/auth";
import { getTokenBalance, isValidPubkey } from "@/lib/solana";
import { mintHolderNft } from "@/lib/mint";

export const runtime = "nodejs";

/**
 * Claim a holder NFT.
 * Body: { coinId, wallet, issuedAt, signature }  (signature = base64 of the signed claim message)
 *
 * Order of checks: signature -> coin live & window open -> not already claimed -> edition cap
 * -> on-chain balance >= minimum -> reserve the claim row -> mint -> store asset address.
 * The unique (coin_id, wallet) constraint makes double claims impossible even under races.
 */
export async function POST(req: Request) {
  let reserved: { coinId: number; wallet: string } | null = null;
  try {
    const body = (await req.json()) as { coinId: number; wallet: string; issuedAt: string; signature: string };
    const { coinId, wallet, issuedAt, signature } = body;
    if (!Number.isInteger(coinId) || !isValidPubkey(wallet))
      return NextResponse.json({ error: "Bad request" }, { status: 400 });

    if (!verifyWalletSignature({ action: "claim", subject: String(coinId), wallet, issuedAt, signatureB64: signature }))
      return NextResponse.json({ error: "Wallet signature check failed. Please try again." }, { status: 401 });

    const pool = await db();
    const { rows } = await pool.query(
      "SELECT id, name, symbol, mint, status, min_balance, max_claims, claim_ends_at, collection FROM coins WHERE id = $1",
      [coinId],
    );
    const coin = rows[0];
    if (!coin || coin.status !== "live" || !coin.mint || !coin.collection)
      return NextResponse.json({ error: "This coin is not open for claims" }, { status: 404 });
    if (coin.claim_ends_at && new Date(coin.claim_ends_at).getTime() < Date.now())
      return NextResponse.json({ error: "The claim window has ended" }, { status: 410 });

    const existing = await pool.query("SELECT asset FROM claims WHERE coin_id = $1 AND wallet = $2", [coinId, wallet]);
    if (existing.rowCount) return NextResponse.json({ error: "This wallet has already claimed", asset: existing.rows[0].asset }, { status: 409 });

    if (coin.max_claims != null) {
      const c = await pool.query("SELECT count(*)::int AS n FROM claims WHERE coin_id = $1", [coinId]);
      if (c.rows[0].n >= coin.max_claims) return NextResponse.json({ error: "All editions have been claimed" }, { status: 410 });
    }

    const balance = await getTokenBalance(wallet, coin.mint);
    const min = Number(coin.min_balance);
    if (balance < min)
      return NextResponse.json({ error: `You need at least ${min} ${coin.symbol} to claim (you hold ${balance}).` }, { status: 403 });

    // Reserve the claim first so concurrent requests can't both mint.
    let claimRowId: number;
    try {
      const ins = await pool.query("INSERT INTO claims (coin_id, wallet) VALUES ($1, $2) RETURNING id", [coinId, wallet]);
      claimRowId = ins.rows[0].id;
      reserved = { coinId, wallet };
    } catch {
      return NextResponse.json({ error: "This wallet has already claimed" }, { status: 409 });
    }

    const base = process.env.PUBLIC_BASE_URL || "";
    // Per-coin edition number: how many claims for this coin were reserved up to and including this one.
    const n = (
      await pool.query("SELECT count(*)::int AS n FROM claims WHERE coin_id = $1 AND id <= $2", [coinId, claimRowId])
    ).rows[0].n as number;
    const asset = await mintHolderNft({
      collection: coin.collection,
      owner: wallet,
      name: `${coin.name} Holder #${n}`,
      uri: `${base}/api/coins/${coinId}/nft-metadata?n=${n}`,
    });

    await pool.query("UPDATE claims SET asset = $1 WHERE coin_id = $2 AND wallet = $3", [asset, coinId, wallet]);
    reserved = null;
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    console.error("claim failed", e);
    // Release the reservation if minting failed so the holder can retry.
    if (reserved) {
      try {
        const pool = await db();
        await pool.query("DELETE FROM claims WHERE coin_id = $1 AND wallet = $2 AND asset IS NULL", [reserved.coinId, reserved.wallet]);
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ error: "Claim failed. Please try again." }, { status: 500 });
  }
}
