import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export function rpcUrl(): string {
  return process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
}

export function getConnection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}

export function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

/** Accepts a base58 secret key or a JSON array of bytes. */
export function loadMintAuthority(): Keypair {
  const raw = process.env.MINT_AUTHORITY_SECRET?.trim();
  if (!raw) throw new Error("MINT_AUTHORITY_SECRET is not set");
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  return Keypair.fromSecretKey(bytes);
}

/**
 * Total UI balance of `mint` held by `owner` across all of the owner's token accounts.
 * Works for both the classic Token program and Token-2022.
 */
export async function getTokenBalance(owner: string, mint: string): Promise<number> {
  const conn = getConnection();
  const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
  let total = 0;
  for (const { account } of res.value) {
    const amt = account.data.parsed?.info?.tokenAmount;
    if (amt) total += Number(amt.uiAmountString ?? amt.uiAmount ?? 0);
  }
  return total;
}

/** Confirms the mint exists and is a token mint account. */
export async function mintExists(mint: string): Promise<boolean> {
  const info = await getConnection().getParsedAccountInfo(new PublicKey(mint));
  const data = info.value?.data;
  return !!data && typeof data === "object" && "parsed" in data && data.parsed?.type === "mint";
}
