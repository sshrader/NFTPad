import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.symbol, c.mint, c.min_balance, c.max_claims, c.created_at,
            (SELECT count(*)::int FROM claims WHERE coin_id = c.id AND asset IS NOT NULL) AS claimed
       FROM coins c WHERE c.status = 'live' ORDER BY c.created_at DESC LIMIT 100`,
  );
  return NextResponse.json({ coins: rows });
}
