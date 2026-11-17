import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Metadata JSON served to wallets/marketplaces:
 *   /api/coins/:id/coin-metadata        token metadata (used at pool creation)
 *   /api/coins/:id/collection-metadata  NFT collection metadata
 *   /api/coins/:id/nft-metadata?n=7     individual holder NFT metadata
 */
export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pool = await db();
  const { rows } = await pool.query(
    "SELECT name, symbol, description, coin_image_id, nft_image_id FROM coins WHERE id = $1",
    [id],
  );
  const coin = rows[0];
  if (!coin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
  const img = (imageId: number) => `${base}/api/images/${imageId}`;

  switch (params.kind) {
    case "coin-metadata":
      return NextResponse.json({
        name: coin.name,
        symbol: coin.symbol,
        description: coin.description,
        image: img(coin.coin_image_id),
      });
    case "collection-metadata":
      return NextResponse.json({
        name: `${coin.name} Holders`,
        description: `Holder collectibles for ${coin.name} (${coin.symbol}).`,
        image: img(coin.nft_image_id),
      });
    case "nft-metadata": {
      const n = Number(new URL(req.url).searchParams.get("n") ?? "0");
      return NextResponse.json({
        name: `${coin.name} Holder #${Number.isInteger(n) && n > 0 ? n : ""}`.trim(),
        description: `Awarded to holders of ${coin.name} (${coin.symbol}).`,
        image: img(coin.nft_image_id),
        attributes: [{ trait_type: "Coin", value: coin.symbol }],
      });
    }
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
