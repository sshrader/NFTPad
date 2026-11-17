/**
 * Claim the trading fees you earned as the partner (the feeClaimer in your config).
 *   npm run dbc-fees            claim from every pool
 *   npm run dbc-fees -- --check just show what is waiting
 * Uses MINT_AUTHORITY_SECRET (or PARTNER_SECRET): it must be the fee claimer wallet.
 */
import BN from "bn.js";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { connect, feeClaimerFor, loadPartner, requireMainnetConfirm } from "./common";

const checkOnly = process.argv.includes("--check");

async function main() {
  const config = (process.env.PARTNER_CONFIG_ADDRESS || "").trim();
  if (!config) throw new Error("PARTNER_CONFIG_ADDRESS is empty. Run `npm run dbc-config` first.");

  const partner = loadPartner();
  const claimer = feeClaimerFor(partner);
  const { connection, mainnet } = await connect();
  const client = new DynamicBondingCurveClient(connection, "confirmed");

  const canSign = claimer.equals(partner.publicKey);
  if (!checkOnly && !canSign) {
    throw new Error(`Fees can only be claimed by ${claimer.toBase58()}, which is not this wallet. Run with --check to just look.`);
  }
  if (!checkOnly) requireMainnetConfirm(mainnet, "Claiming fees");

  const fees = await client.state.getPoolsFeesByConfig(new PublicKey(config));
  const sol = (b: BN) => Number(b.toString()) / LAMPORTS_PER_SOL;
  let total = 0;
  console.log(`\nFee claimer ${claimer.toBase58()}${canSign ? " (this wallet)" : ""}`);
  console.log(`${fees.length} pool(s) under this config\n`);

  for (const f of fees) {
    const owed = sol(f.partnerQuoteFee);
    total += owed;
    console.log(`${f.poolAddress.toBase58()}  waiting: ${owed.toFixed(6)} SOL   all-time fees: ${sol(f.totalTradingQuoteFee).toFixed(6)} SOL`);
    if (checkOnly || f.partnerQuoteFee.isZero()) continue;

    const tx = await client.partner.claimPartnerTradingFee({
      pool: f.poolAddress,
      feeClaimer: partner.publicKey,
      payer: partner.publicKey,
      maxBaseAmount: new BN(0),
      maxQuoteAmount: f.partnerQuoteFee,
    });
    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = partner.publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.sign(partner);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    console.log(`  claimed. tx ${sig}`);
  }

  console.log(`\n${checkOnly ? "Waiting to claim" : "Total"}: ${total.toFixed(6)} SOL`);
}

main().catch((e) => {
  console.error("\n" + (e instanceof Error ? e.message : e));
  process.exit(1);
});
