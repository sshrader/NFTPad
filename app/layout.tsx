import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import Providers from "@/components/Providers";
import Link from "next/link";
import WalletButton from "@/components/WalletButton";

export const metadata: Metadata = {
  title: "NFTPad",
  description: "Launch a coin with its own holder NFT. Hold the coin, claim the art.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="nav">
            <Link href="/" className="brand">NFTPad</Link>
            <nav>
              <Link href="/">Coins</Link>
              <Link href="/launch">Launch</Link>
            </nav>
            <WalletButton />
          </header>
          <main className="container">{children}</main>
          <footer className="footer">
            Collectibles are art, not investments. Nothing here is financial advice.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
