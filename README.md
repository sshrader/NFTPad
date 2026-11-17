# NFTPad

Launch a coin, upload holder art, and let anyone who holds the coin claim an NFT.

**How it works**

1. A creator connects a wallet and submits a coin (name, ticker, coin image, **holder NFT art**, minimum balance, optional edition cap and claim deadline).
2. The server creates a Metaplex Core **collection** for the coin and marks it live.
3. A holder opens the coin page, connects a wallet and signs a free message (proves wallet ownership, sends no transaction).
4. The server checks the wallet's on-chain token balance against the minimum, reserves one claim per wallet, and **mints the NFT straight into the holder's wallet**.

**Stack:** Next.js 14 (App Router, TypeScript) · Postgres (`pg`) · Solana web3.js · Metaplex Core (umi) · wallet-adapter · Meteora Dynamic Bonding Curve SDK (optional).

> ⚠️ **Status: untested first draft.** It was written without being able to install dependencies or run the app, so expect to fix small things on first run. Test on **devnet** only until you've done a full claim end to end.

## Launch modes

| `LAUNCH_MODE` | What the creator does | Use for |
|---|---|---|
| `attach` (default) | Pastes the mint address of an existing SPL token | Testing the claim flow now. **Do not use on mainnet**: anyone could attach someone else's token. |
| `meteora` | Server builds a Meteora Dynamic Bonding Curve pool-creation transaction; the creator's wallet signs and sends it. The coin is created on a bonding curve. | Real launches. Needs `PARTNER_CONFIG_ADDRESS` (see below). **Untested in this app yet**: the Meteora calls are ported from the working devnet setup in `sshrader/launchpad`. |

Keep `NEXT_PUBLIC_LAUNCH_MODE` equal to `LAUNCH_MODE`.

## Meteora bonding curve setup (`LAUNCH_MODE=meteora`)

1. **Create the config once** (run locally with `MINT_AUTHORITY_SECRET` and `RPC_URL` in `.env`, wallet funded with ≥0.05 devnet SOL):
   ```bash
   npm run dbc-config -- --check   # prints the curve/fee settings, sends nothing
   npm run dbc-config              # creates the config on chain, prints PARTNER_CONFIG_ADDRESS
   ```
   Settings (`DBC_INITIAL_MC`, `DBC_MIGRATION_MC`, `DBC_FEE_BPS`, `DBC_CREATOR_FEE_PCT`, `DBC_FEE_CLAIMER`) are in `.env.example`. **They are permanent once created.**
2. In Railway set `PARTNER_CONFIG_ADDRESS=<printed value>`, `LAUNCH_MODE=meteora` and `NEXT_PUBLIC_LAUNCH_MODE=meteora`, then redeploy.
3. Each launch is one transaction (created by `lib/meteora.ts`, signed in the creator's wallet). Before a coin goes live, `/api/launch/confirm` checks on chain that the mint has a pool made from **your config** by the **launching wallet**.
4. Holder NFT claims work the same: the coin's mint is the token holders must own. Note that on a bonding curve, holders buy through the pool, so you will want a trading UI (the Buy/Sell box in `sshrader/launchpad`, `src/components/TradeBox.tsx` and `src/lib/dbc.ts`, is a good starting point).
5. Claim your fees: `npm run dbc-fees -- --check` then `npm run dbc-fees` (must be run with the fee claimer wallet).

## Local setup

```bash
cp .env.example .env     # fill in DATABASE_URL and MINT_AUTHORITY_SECRET
npm install
npm run dev
```

- `MINT_AUTHORITY_SECRET` is the server wallet that creates collections and mints NFTs and **pays the rent**. Make a fresh wallet just for this, fund it with devnet SOL (https://faucet.solana.com), and never reuse a wallet that holds real funds.
- Tables are created automatically on first request.

## Deploy to Railway

1. New project → **Deploy from GitHub repo** → `sshrader/NFTPad`.
2. Add a **PostgreSQL** plugin. Railway injects `DATABASE_URL` into the service (reference it as `${{Postgres.DATABASE_URL}}` if not).
3. Set these variables on the web service (the `NEXT_PUBLIC_*` ones must be set **before** the build):
   - `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
   - `NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com`
   - `RPC_URL=https://api.devnet.solana.com`
   - `NEXT_PUBLIC_LAUNCH_MODE=attach` and `LAUNCH_MODE=attach`
   - `MINT_AUTHORITY_SECRET=<server wallet secret>`
   - `PUBLIC_BASE_URL=https://<your-app>.up.railway.app` (generate a public domain under Settings → Networking, then set this and redeploy)
4. Redeploy after setting `PUBLIC_BASE_URL`: NFT metadata links point at it.

## Test plan (devnet)

1. Create a test token (e.g. `spl-token create-token` + `create-account` + `mint`) and mint some to a Phantom devnet wallet.
2. Open `/launch`, connect the wallet, paste the mint, upload two images, launch.
3. Open the coin page with the wallet that holds the token → **Claim**. Check Phantom/Solscan (devnet) for the NFT.
4. Try the failure cases: wallet with no tokens (should be refused), claim twice (refused), a different wallet.

## Known limitations / before mainnet

- **Hold time is not enforced**: eligibility is the balance at claim time, so someone can buy, claim and sell. Add a snapshot or a minimum hold period.
- **Sybil**: many wallets can each claim. The minimum balance and edition cap are the only brakes.
- **Costs are paid by the server wallet** (collection + each NFT). A launch cap per creator wallet exists (3 per 24h), but add IP rate limiting and/or a launch fee.
- **Images are stored in Postgres** and served by this app. Fine for testing; move to Arweave/IPFS for production so NFT art does not depend on your server.
- **No content moderation or takedown tooling yet.** Users upload images, so add reporting and removal before opening it up.
- **No trading UI yet.** In `meteora` mode coins are created on a curve, but buying and selling happens elsewhere (or you add the Buy/Sell box from `sshrader/launchpad`).
- **No anti-sniper fee decay and no dev-buy at launch** in the curve config: it uses a flat fee, like the launchpad repo. Both are possible later but need devnet testing.
- **Legal**: don't market holder NFTs as an investment. Get advice for your jurisdiction before a public launch.
