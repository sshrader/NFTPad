"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { signAction } from "@/lib/sign";

const MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE || "attach";

export default function LaunchForm() {
  const { publicKey, signMessage, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coinId, setCoinId] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!publicKey || !signMessage) return setError("Connect a wallet that supports message signing.");
    const form = new FormData(e.currentTarget);
    const symbol = String(form.get("symbol") ?? "").toUpperCase();
    form.set("symbol", symbol);

    setBusy(true);
    try {
      const wallet = publicKey.toBase58();
      const { issuedAt, signature } = await signAction(signMessage, "launch", symbol, wallet);
      form.set("wallet", wallet);
      form.set("issuedAt", issuedAt);
      form.set("signature", signature);

      const res = await fetch("/api/launch/prepare", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Launch failed");

      if (data.live) {
        setCoinId(data.coinId);
        return;
      }

      // meteora mode: wallet signs and sends the pool-creation transaction.
      const raw = Uint8Array.from(atob(data.txBase64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(raw);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      const conf = await fetch("/api/launch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinId: data.coinId, signature: sig }),
      });
      const confData = await conf.json();
      if (!conf.ok) throw new Error(confData.error || "Confirmation failed");
      setCoinId(data.coinId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (coinId) {
    return (
      <div className="card">
        <h2>Launched 🎉</h2>
        <p>
          Your coin page is live: <a href={`/coin/${coinId}`}>/coin/{coinId}</a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="row">
        <div>
          <label>Coin name</label>
          <input name="name" maxLength={32} required />
        </div>
        <div>
          <label>Ticker (2-10 letters/numbers)</label>
          <input name="symbol" maxLength={10} required />
        </div>
      </div>

      <label>Description</label>
      <textarea name="description" rows={3} maxLength={500} />

      {MODE === "attach" && (
        <>
          <label>Existing token mint address (test mode)</label>
          <input name="mint" required placeholder="Token mint on the same network as this app" />
        </>
      )}

      <div className="row">
        <div>
          <label>Coin image</label>
          <input name="coinImage" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required />
        </div>
        <div>
          <label>Holder NFT art</label>
          <input name="nftImage" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required />
        </div>
      </div>

      <div className="row">
        <div>
          <label>Minimum tokens to claim</label>
          <input name="minBalance" type="number" min="0" step="any" defaultValue={1} required />
        </div>
        <div>
          <label>Max NFTs (blank = unlimited)</label>
          <input name="maxClaims" type="number" min="1" step="1" />
        </div>
      </div>

      <label>Claim window ends (optional)</label>
      <input name="claimEndsAt" type="datetime-local" />

      <p className="muted">
        You must own the rights to the art you upload. Rules can&apos;t be changed after launch.
      </p>

      <button className="primary" disabled={busy || !publicKey}>
        {busy ? "Launching…" : publicKey ? "Launch" : "Connect wallet first"}
      </button>
      {error && <div className="msg-error">{error}</div>}
    </form>
  );
}
