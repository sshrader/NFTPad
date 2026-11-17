"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { signAction } from "@/lib/sign";

export default function ClaimButton({ coinId, symbol, disabled }: { coinId: number; symbol: string; disabled?: boolean }) {
  const { publicKey, signMessage } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<string | null>(null);

  async function claim() {
    setError(null);
    if (!publicKey || !signMessage) return setError("Connect a wallet that supports message signing.");
    setBusy(true);
    try {
      const wallet = publicKey.toBase58();
      // Signing proves you own this wallet. It is free and does not send a transaction.
      const { issuedAt, signature } = await signAction(signMessage, "claim", String(coinId), wallet);
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinId, wallet, issuedAt, signature }),
      });
      const data = await res.json();
      if (res.ok) setAsset(data.asset);
      else if (res.status === 409 && data.asset) setAsset(data.asset);
      else throw new Error(data.error || "Claim failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;

  if (asset) {
    return (
      <div className="msg-ok">
        Your NFT is in your wallet.{" "}
        <a href={`https://solscan.io/token/${asset}${cluster}`} target="_blank" rel="noreferrer">
          View on Solscan
        </a>
      </div>
    );
  }

  return (
    <div>
      <button className="primary" onClick={claim} disabled={busy || disabled || !publicKey}>
        {disabled ? "Claim window ended" : busy ? "Claiming…" : publicKey ? `Claim with my ${symbol}` : "Connect wallet to claim"}
      </button>
      {error && <div className="msg-error">{error}</div>}
    </div>
  );
}
