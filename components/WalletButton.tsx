"use client";

import dynamic from "next/dynamic";

// The wallet button reads browser state, so skip server rendering to avoid hydration mismatches.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function WalletButton() {
  return <WalletMultiButton />;
}
