import nacl from "tweetnacl";
import bs58 from "bs58";
import { buildMessage } from "./message";

const MAX_AGE_MS = 5 * 60 * 1000;


/**
 * Verify that `wallet` signed the expected message recently.
 * The message is rebuilt on the server, so a client cannot sign something else.
 * Replay is harmless for claims (unique row per wallet+coin); for launches the
 * 5-minute window limits reuse.
 */
export function verifyWalletSignature(opts: {
  action: string;
  subject: string;
  wallet: string;
  issuedAt: string;
  signatureB64: string;
}): boolean {
  const { action, subject, wallet, issuedAt, signatureB64 } = opts;
  const issued = Date.parse(issuedAt);
  if (!Number.isFinite(issued)) return false;
  if (Math.abs(Date.now() - issued) > MAX_AGE_MS) return false;

  try {
    const message = new TextEncoder().encode(buildMessage(action, subject, wallet, issuedAt));
    const signature = Buffer.from(signatureB64, "base64");
    const pubkey = bs58.decode(wallet);
    if (pubkey.length !== 32 || signature.length !== 64) return false;
    return nacl.sign.detached.verify(message, new Uint8Array(signature), pubkey);
  } catch {
    return false;
  }
}
