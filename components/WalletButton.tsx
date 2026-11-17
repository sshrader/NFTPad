"use client";

import dynamic from "next/dynamic";

// The wallet button reads browser state, so skip server rendering to avoid hydration mismatches.
// The placeholder keeps the header from looking empty while the wallet code loads.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="wallet-placeholder">Loading…</div> },
);

export default function WalletButton() {
  return (
    <div className="wallet-slot">
      <WalletMultiButton />
    </div>
  );
}
