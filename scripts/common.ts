// Shared by the partner scripts: which wallet signs, and which network we are on.
import "dotenv/config";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";

export const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

/**
 * The wallet that pays for the config and (by default) is the fee claimer.
 * PARTNER_SECRET if set, otherwise MINT_AUTHORITY_SECRET. Base58 or a JSON array of bytes.
 * Fine on devnet. On mainnet use a dedicated wallet and set DBC_FEE_CLAIMER to a hardware wallet or multisig.
 */
export function loadPartner(): Keypair {
  const raw = (process.env.PARTNER_SECRET || process.env.MINT_AUTHORITY_SECRET || "").trim();
  if (!raw) throw new Error("Set MINT_AUTHORITY_SECRET (or PARTNER_SECRET) in .env first.");
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  return Keypair.fromSecretKey(bytes);
}

export const rpcUrl = () => process.env.RPC_URL || clusterApiUrl("devnet");

/** Connection plus whether it is mainnet (decided by the chain's genesis hash, not by the URL). */
export async function connect(): Promise<{ connection: Connection; mainnet: boolean }> {
  const connection = new Connection(rpcUrl(), "confirmed");
  const mainnet = (await connection.getGenesisHash()) === MAINNET_GENESIS;
  console.log(`Network: ${mainnet ? "MAINNET (real money)" : "devnet/testnet"}`);
  return { connection, mainnet };
}

/** Spending real SOL needs an explicit --confirm-mainnet flag. */
export function requireMainnetConfirm(mainnet: boolean, what: string) {
  if (mainnet && !process.argv.includes("--confirm-mainnet")) {
    throw new Error(`${what} on MAINNET spends real SOL. Re-run with --confirm-mainnet once you have checked the settings above.`);
  }
}

/** Who may claim trading fees (and receives leftover tokens). DBC_FEE_CLAIMER = a safe wallet. Empty = the signer wallet. */
export function feeClaimerFor(deployer: Keypair): PublicKey {
  const v = (process.env.DBC_FEE_CLAIMER || "").trim();
  if (!v) return deployer.publicKey;
  try {
    return new PublicKey(v);
  } catch {
    throw new Error("DBC_FEE_CLAIMER is not a valid Solana address.");
  }
}
