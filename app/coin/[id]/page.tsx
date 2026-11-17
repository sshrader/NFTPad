import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ClaimButton from "@/components/ClaimButton";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT c.*, (SELECT count(*)::int FROM claims WHERE coin_id = c.id AND asset IS NOT NULL) AS claimed
       FROM coins c WHERE c.id = $1 AND c.status = 'live'`,
    [id],
  );
  const coin = rows[0];
  if (!coin) notFound();

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  const ended = coin.claim_ends_at && new Date(coin.claim_ends_at).getTime() < Date.now();

  return (
    <>
      <div className="hero">
        <div className="card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/images/${coin.nft_image_id}`} alt={`${coin.name} holder NFT`} />
          <p className="muted" style={{ marginBottom: 0 }}>Holder NFT</p>
        </div>
        <div>
          <h1 style={{ marginTop: 0 }}>
            {coin.name} <span className="muted">({coin.symbol})</span>
          </h1>
          {coin.description && <p>{coin.description}</p>}
          <p className="muted">
            Hold at least <b>{Number(coin.min_balance)} {coin.symbol}</b> to claim ·{" "}
            {coin.claimed}
            {coin.max_claims ? ` / ${coin.max_claims}` : ""} claimed
            {coin.claim_ends_at ? ` · ${ended ? "ended" : "ends"} ${new Date(coin.claim_ends_at).toUTCString()}` : ""}
          </p>
          <p className="muted">
            Token: <a href={`https://solscan.io/token/${coin.mint}${cluster}`} target="_blank" rel="noreferrer"><code>{coin.mint}</code></a>
          </p>
          <ClaimButton coinId={coin.id} symbol={coin.symbol} disabled={!!ended} />
        </div>
      </div>
    </>
  );
}
