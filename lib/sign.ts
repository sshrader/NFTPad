import { buildMessage } from "./message";

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

/** Asks the connected wallet to sign the server-defined message; returns what the API expects. */
export async function signAction(
  signMessage: SignMessage,
  action: string,
  subject: string,
  wallet: string,
): Promise<{ issuedAt: string; signature: string }> {
  const issuedAt = new Date().toISOString();
  const bytes = new TextEncoder().encode(buildMessage(action, subject, wallet, issuedAt));
  const sig = await signMessage(bytes);
  let bin = "";
  sig.forEach((b) => (bin += String.fromCharCode(b)));
  return { issuedAt, signature: btoa(bin) };
}
