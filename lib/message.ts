/** The exact text a wallet signs to prove ownership for a given action (shared by browser and server). */
export function buildMessage(action: string, subject: string, wallet: string, issuedAt: string): string {
  return `NFTPad ${action}\nSubject: ${subject}\nWallet: ${wallet}\nIssued: ${issuedAt}`;
}
