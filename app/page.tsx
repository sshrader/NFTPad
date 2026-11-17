import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.symbol, c.coin_image_id, c.nft_image_id, c.max_claims,
            (SELECT count(*)::int FROM claims WHERE coin_id = c.id AND asset IS NOT NULL) AS claimed
       FROM coins c WHERE c.status = 'live' ORDER BY c.created_at DESC LIMIT 100`,
  );

  return (
    <>
      <section className="hero-home">
        <span className="badge">Solana · Holder NFTs</span>
        <h1>
          Hold the coin.
          <br />
          <span className="gradient-text">Claim the art.</span>
        </h1>
        <p className="lead">
          Every coin on NFTPad comes with its own holder NFT. Own the coin, connect your wallet, and the art lands
          straight in your wallet.
        </p>
        <div className="cta-row">
          <Link href="/launch" className="btn primary-btn">Launch a coin</Link>
          <a href="#coins" className="btn">Browse coins</a>
        </div>
      </section>

      <h2 className="section-title">How it works</h2>
      <div className="steps">
        <div className="step">
          <div className="num">1</div>
          <h3>Creators launch</h3>
          <p>Launch a coin and upload the NFT art your holders will get. Set a minimum balance and an optional cap.</p>
        </div>
        <div className="step">
          <div className="num">2</div>
          <h3>Holders connect</h3>
          <p>Open a coin page, connect your wallet and sign a free message to prove it&apos;s yours. No transaction.</p>
        </div>
        <div className="step">
          <div className="num">3</div>
          <h3>Art is delivered</h3>
          <p>We check your balance on-chain and mint the NFT straight into your wallet. One per wallet.</p>
        </div>
      </div>

      <h2 className="section-title" id="coins">Live coins</h2>
      {rows.length === 0 ? (
        <div className="empty">
          <b>No coins yet</b>
          Be the first to launch one and set the art your holders will claim.
          <div style={{ marginTop: 16 }}>
            <Link href="/launch" className="btn primary-btn">Launch a coin</Link>
          </div>
        </div>
      ) : (
        <div className="grid">
          {rows.map((c) => {
            const pct = c.max_claims ? Math.min(100, Math.round((c.claimed / c.max_claims) * 100)) : null;
            return (
              <Link key={c.id} href={`/coin/${c.id}`} className="card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${c.nft_image_id}`} alt={c.name} />
                <h3>{c.name}</h3>
                <span className="pill">{c.symbol}</span>
                <div className="muted" style={{ marginTop: 8 }}>
                  {c.claimed}
                  {c.max_claims ? ` / ${c.max_claims}` : ""} claimed
                </div>
                {pct !== null && (
                  <div className="progress">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
