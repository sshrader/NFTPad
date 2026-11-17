import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getConnection } from "./solana";

/**
 * Meteora Dynamic Bonding Curve helpers. The calls here follow a setup that already ran on devnet
 * (sshrader/launchpad, SDK ^1.5.13): pools are created with `client.creator.createPool`, and a
 * pool's config/creator are read back with `client.state.getPoolByBaseMint`.
 */

export const partnerConfig = () => (process.env.PARTNER_CONFIG_ADDRESS || "").trim();

// Some SDK versions wrap the pool fields in .poolState; accept both shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fields = (account: any) => account?.poolState ?? account;

function client() {
  return new DynamicBondingCurveClient(getConnection(), "confirmed");
}

/**
 * Builds the pool-creation transaction. The server generates the new token's mint keypair and
 * signs with it; the creator's wallet signs as payer/pool creator in the browser and sends it.
 * The transaction is simulated first so a failure shows its real reason instead of a wallet error.
 */
export async function buildCreatePoolTx(opts: {
  creator: string;
  name: string;
  symbol: string;
  metadataUri: string;
}): Promise<{ txBase64: string; baseMint: string }> {
  const config = partnerConfig();
  if (!config) throw new Error("PARTNER_CONFIG_ADDRESS is not set. Run `npm run dbc-config` first.");

  const connection = getConnection();
  const baseMint = Keypair.generate();
  const creator = new PublicKey(opts.creator);

  const tx: Transaction = await client().creator.createPool({
    baseMint: baseMint.publicKey,
    config: new PublicKey(config),
    name: opts.name,
    symbol: opts.symbol,
    uri: opts.metadataUri,
    payer: creator,
    poolCreator: creator,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = creator;
  tx.recentBlockhash = blockhash;

  // Signature-free simulation: the creator has not signed yet.
  const sim = await connection.simulateTransaction(new VersionedTransaction(tx.compileMessage()), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  if (sim.value.err) {
    const logs = (sim.value.logs ?? [])
      .filter((l) => /error|fail|insufficient|custom program/i.test(l))
      .slice(-3)
      .join(" | ");
    throw new Error(`The network rejected this launch: ${JSON.stringify(sim.value.err)} ${logs}`.trim());
  }

  tx.partialSign(baseMint);
  return {
    txBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    baseMint: baseMint.publicKey.toBase58(),
  };
}

/**
 * Checks on-chain that `mint` has a pool made from OUR config and created by `creator`.
 * Used before a coin goes live, so nobody can register a random token or someone else's pool.
 */
export async function verifyPool(mint: string, creator: string): Promise<{ pool: string } | { error: string }> {
  const pool = await client().state.getPoolByBaseMint(new PublicKey(mint));
  if (!pool) return { error: "No bonding-curve pool exists for this mint yet." };
  const f = fields(pool.account);
  if (!f?.config || !f?.creator) return { error: "Unexpected pool data from the SDK." };
  if (f.config.toBase58() !== partnerConfig()) return { error: "This pool was not made with the NFTPad curve config." };
  if (f.creator.toBase58() !== creator) return { error: "Pool creator does not match the launching wallet." };
  return { pool: pool.publicKey.toBase58() };
}
