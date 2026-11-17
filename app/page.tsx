import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.symbol, c.coin_image_id, c.max_claims,
            (SELECT count(*)::int FROM claims WHERE coin_id = c.id AND asset IS NOT NULL) AS claimed
       FROM coins c WHERE c.status = 'live' ORDER BY c.created_at DESC LIMIT 100`,
  );

  return (
    <>
      <h1>Hold the coin. Claim the art.</h1>
      <p className="muted">
        Every coin here comes with its own holder NFT. Connect your wallet on a coin&apos;s page to claim yours.
      </p>
      <p>
        <Link href="/launch">Launch your own →</Link>
      </p>

      {rows.length === 0 ? (
        <p className="muted">No coins yet. Be the first to launch one.</p>
      ) : (
        <div className="grid">
          {rows.map((c) => (
            <Link key={c.id} href={`/coin/${c.id}`} className="card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${c.coin_image_id}`} alt={c.name} />
              <h3 style={{ margin: "12px 0 4px" }}>{c.name}</h3>
              <div className="muted">
                {c.symbol} · {c.claimed}
                {c.max_claims ? ` / ${c.max_claims}` : ""} claimed
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
