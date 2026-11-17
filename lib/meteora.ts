import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getConnection } from "./solana";

/**
 * Builds a Meteora Dynamic Bonding Curve pool-creation transaction.
 *
 * ⚠️ UNVERIFIED: I could not read the SDK's docs.md while writing this, so the method and
 * parameter names below are from memory of the SDK's public API. Before using LAUNCH_MODE=meteora,
 * check them against:
 *   https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/blob/main/packages/dynamic-bonding-curve/docs.md
 * Everything else in the app works without this file (LAUNCH_MODE=attach).
 *
 * Flow: the server generates the base mint keypair and partially signs; the creator's wallet
 * signs as payer/pool creator in the browser and submits the transaction.
 */
export async function buildCreatePoolTx(opts: {
  creator: string;
  name: string;
  symbol: string;
  metadataUri: string;
}): Promise<{ txBase64: string; baseMint: string }> {
  const configAddress = process.env.PARTNER_CONFIG_ADDRESS;
  if (!configAddress) throw new Error("PARTNER_CONFIG_ADDRESS is not set");

  // Imported lazily so attach mode never loads the SDK.
  const { DynamicBondingCurveClient } = await import("@meteora-ag/dynamic-bonding-curve-sdk");
  const connection = getConnection();
  const client = new DynamicBondingCurveClient(connection, "confirmed");

  const baseMint = Keypair.generate();
  const creator = new PublicKey(opts.creator);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx: Transaction = await (client as any).pool.createPool({
    baseMint: baseMint.publicKey,
    config: new PublicKey(configAddress),
    name: opts.name,
    symbol: opts.symbol,
    uri: opts.metadataUri,
    payer: creator,
    poolCreator: creator,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = creator;
  tx.partialSign(baseMint);

  return {
    txBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    baseMint: baseMint.publicKey.toBase58(),
  };
}
