import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWalletSignature } from "@/lib/auth";
import { readImage } from "@/lib/images";
import { isValidPubkey, mintExists } from "@/lib/solana";
import { buildCreatePoolTx } from "@/lib/meteora";

export const runtime = "nodejs";

/**
 * Step 1 of launching. Multipart form:
 *   wallet, issuedAt, signature  - creator proves wallet ownership (action "launch", subject = symbol)
 *   name, symbol, description
 *   minBalance, maxClaims?, claimEndsAt?
 *   coinImage, nftImage          - image files
 *   mint                         - (attach mode only) an existing SPL token mint
 *
 * attach mode:  coin goes live immediately (call /api/launch/confirm is not needed).
 * meteora mode: returns an unsigned-by-creator transaction; the browser signs + sends it,
 *               then calls /api/launch/confirm.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const str = (k: string) => String(form.get(k) ?? "").trim();

    const wallet = str("wallet");
    const name = str("name");
    const symbol = str("symbol").toUpperCase();
    const description = str("description");
    const minBalance = Number(str("minBalance") || "1");
    const maxClaimsRaw = str("maxClaims");
    const claimEndsRaw = str("claimEndsAt");
    const mode = (process.env.LAUNCH_MODE || "attach") as "attach" | "meteora";

    if (!isValidPubkey(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    if (!verifyWalletSignature({ action: "launch", subject: symbol, wallet, issuedAt: str("issuedAt"), signatureB64: str("signature") }))
      return NextResponse.json({ error: "Wallet signature check failed" }, { status: 401 });

    if (!name || name.length > 32) return NextResponse.json({ error: "Name required (max 32 chars)" }, { status: 400 });
    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return NextResponse.json({ error: "Symbol must be 2-10 letters/numbers" }, { status: 400 });
    if (description.length > 500) return NextResponse.json({ error: "Description too long (max 500)" }, { status: 400 });
    if (!(minBalance > 0)) return NextResponse.json({ error: "Minimum balance must be greater than 0" }, { status: 400 });

    let maxClaims: number | null = null;
    if (maxClaimsRaw) {
      maxClaims = Math.floor(Number(maxClaimsRaw));
      if (!(maxClaims > 0) || maxClaims > 100000) return NextResponse.json({ error: "Invalid max claims" }, { status: 400 });
    }
    let claimEndsAt: string | null = null;
    if (claimEndsRaw) {
      const t = Date.parse(claimEndsRaw);
      if (!Number.isFinite(t) || t < Date.now()) return NextResponse.json({ error: "Claim end must be in the future" }, { status: 400 });
      claimEndsAt = new Date(t).toISOString();
    }

    const coinImage = await readImage(form.get("coinImage") as File | null, "Coin image");
    const nftImage = await readImage(form.get("nftImage") as File | null, "NFT art");

    let mint: string | null = null;
    if (mode === "attach") {
      mint = str("mint");
      if (!isValidPubkey(mint)) return NextResponse.json({ error: "Enter a valid token mint address" }, { status: 400 });
      if (!(await mintExists(mint))) return NextResponse.json({ error: "That address is not a token mint on this network" }, { status: 400 });
    }

    const pool = await db();

    // Each launch costs the server wallet rent (collection account), so cap launches per creator.
    const recent = await pool.query(
      "SELECT count(*)::int AS n FROM coins WHERE creator = $1 AND created_at > now() - interval '24 hours'",
      [wallet],
    );
    if (recent.rows[0].n >= 3)
      return NextResponse.json({ error: "Launch limit reached for this wallet (3 per 24 hours)" }, { status: 429 });

    if (mint) {
      const dup = await pool.query("SELECT 1 FROM coins WHERE mint = $1", [mint]);
      if (dup.rowCount) return NextResponse.json({ error: "A launch already exists for this mint" }, { status: 409 });
    }

    const ins = async (img: { contentType: string; data: Buffer }) =>
      (await pool.query("INSERT INTO images (content_type, data) VALUES ($1, $2) RETURNING id", [img.contentType, img.data])).rows[0].id as number;
    const coinImageId = await ins(coinImage);
    const nftImageId = await ins(nftImage);

    const coin = await pool.query(
      `INSERT INTO coins (name, symbol, description, creator, mint, status, launch_mode, min_balance, max_claims, claim_ends_at, coin_image_id, nft_image_id)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11) RETURNING id`,
      [name, symbol, description, wallet, mint, mode, minBalance, maxClaims, claimEndsAt, coinImageId, nftImageId],
    );
    const coinId = coin.rows[0].id as number;

    if (mode === "attach") {
      // No on-chain step for the creator; the confirm logic finalizes (creates collection, goes live).
      const { finalizeCoin } = await import("@/lib/finalize");
      await finalizeCoin(coinId);
      return NextResponse.json({ coinId, mode, live: true });
    }

    // meteora mode
    const base = process.env.PUBLIC_BASE_URL || "";
    const { txBase64, baseMint } = await buildCreatePoolTx({
      creator: wallet,
      name,
      symbol,
      metadataUri: `${base}/api/coins/${coinId}/coin-metadata`,
    });
    await pool.query("UPDATE coins SET mint = $1 WHERE id = $2", [baseMint, coinId]);
    return NextResponse.json({ coinId, mode, live: false, txBase64, mint: baseMint });
  } catch (e) {
    console.error("launch/prepare failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Launch failed" }, { status: 500 });
  }
}
