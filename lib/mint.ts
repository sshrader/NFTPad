import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { create, createCollection, fetchCollection, mplCore } from "@metaplex-foundation/mpl-core";
import { loadMintAuthority, rpcUrl } from "./solana";

function getUmi() {
  const kp = loadMintAuthority();
  const umi = createUmi(rpcUrl()).use(mplCore());
  const umiKp = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
  umi.use(keypairIdentity(umiKp));
  return umi;
}

/** Create the Core collection for a coin. The server wallet is the update authority. */
export async function createCoinCollection(name: string, uri: string): Promise<string> {
  const umi = getUmi();
  const collection = generateSigner(umi);
  await createCollection(umi, { collection, name, uri }).sendAndConfirm(umi);
  return collection.publicKey.toString();
}

/** Mint one Core asset into `owner`'s wallet as part of the coin's collection. */
export async function mintHolderNft(opts: {
  collection: string;
  owner: string;
  name: string;
  uri: string;
}): Promise<string> {
  const umi = getUmi();
  const asset = generateSigner(umi);
  const collection = await fetchCollection(umi, publicKey(opts.collection));
  await create(umi, {
    asset,
    collection,
    name: opts.name,
    uri: opts.uri,
    owner: publicKey(opts.owner),
  }).sendAndConfirm(umi);
  return asset.publicKey.toString();
}
