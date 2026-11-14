# Launch checklist: 5chan Pass and Seedit Gold

What has to happen before the two passes are on sale, in order. Written 2026-11-14. Tick items off here as they land.

This file is public. Keep signer names, signer addresses and any private arrangements out of it.

## Where things stand

- [x] Contract, tests and deploy script are on `master`.
- [ ] PR 31 (save the deployment record before sending the deploy transaction) merged.
- [ ] Payout Safe exists (see step 1). **Blocks every mainnet deployment.**
- [ ] 5chan Pass deployed and verified.
- [ ] Seedit Gold deployed and verified.
- [ ] mintpass.org deployed (PR 29).
- [ ] 5chan and Seedit sell the pass and read it for voting.

## Decisions still open

- **Which Safe receives the proceeds.** The plan is the same Safe that BSIP-13 names as the `.bso` fee recipient. Confirm between the signers before deploying. The payout can be handed over later (`proposePayout` then `acceptPayout`), but only by the current payout, so a Safe must sign the handover.
- **External audit.** The contract has not had one. Decide whether to launch without it.
- **A pass BSIP.** BSIP-18 already defines what a gate contract must satisfy. A separate BSIP for the purchase interface and the `balanceOf` expiry rule waits until after the first mainnet deployment.

## 1. Create the payout Safe

A Safe is a wallet contract that needs several owners to sign before it does anything. It is created once at [app.safe.global](https://app.safe.global). Its address never changes; owners and the threshold can be changed later by the owners.

### 1a. Each signer prepares a key

1. Buy a hardware wallet directly from the manufacturer, never second hand.
2. Initialise it yourself. Write the recovery phrase on paper and store it somewhere other than the device. Never type it into a computer or photograph it.
3. Create a fresh Ethereum address on it. Do not use an address that has ever sent or received anything.
4. A signer who holds two keys uses two devices with two different recovery phrases, kept in different places.
5. Send your address to whoever creates the Safe, then confirm it over a second channel (a call, or a different app) by reading out the first and last six characters.

### 1b. Rehearse on Sepolia

Nobody loses money on a testnet, so do the whole thing there first.

1. Get Sepolia ETH from a faucet for one wallet.
2. Follow 1c on the Sepolia network with the real signer addresses.
3. Do the test in 1d. Every signer should sign at least once.

### 1c. Create the Safe on mainnet

1. Open [app.safe.global](https://app.safe.global) and connect a wallet that holds a little ETH for gas. This wallet only pays for creation. It does not have to be an owner.
2. Choose **Create new Safe**, name it, and select **Ethereum** as the network.
3. Add every owner address. Check each one character by character against what the signer confirmed.
4. Set the threshold (how many owners must sign).
5. Review, then pay the creation transaction.
6. Write the Safe address into the table in the README's deployment section once the passes are deployed against it. Each signer opens app.safe.global, connects their hardware wallet and checks that the Safe appears with the right owners and threshold.

### 1d. Test it before it holds anything

1. Send a small amount of ETH to the Safe.
2. One owner creates a transaction in the Safe app that sends it back.
3. The other owners open the Safe app, check the recipient and amount on their hardware wallet screen, and sign. Signing is free; only the last step, **Execute**, costs gas.
4. Repeat with a second transaction so that every signer has signed once.

A signer who cannot complete the test must be replaced before the Safe is used.

## 2. Rehearse the deployment

These steps need no Safe on mainnet and can be done now.

1. Merge PR 31.
2. `yarn install`, then `yarn test`, `yarn typecheck`, `yarn coverage`, `yarn test:fork`.
3. Deploy both passes to Sepolia with the Sepolia Safe as payout:

   ```sh
   DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=<sepolia safe> DRY_RUN=0 yarn deploy --network sepolia
   ```

   The deployer key is read only from `DEPLOYER_PRIVATE_KEY`. Use a throwaway key that holds only Sepolia ETH.
4. Buy a pass on Sepolia and check that the payment arrives in the Sepolia Safe.
5. Verify the Sepolia contract on Etherscan (needs `ETHERSCAN_API_KEY`).

## 3. Deploy to mainnet

Do this for `5chan-pass`, then repeat for `seedit-gold`.

1. Create a fresh deployer address used for nothing else. Fund it with enough ETH for two deployments. A deployment uses about 2.28M gas; the dry run prints the cost at the current gas price. The deployer gets no rights over the contract: there is no owner.
2. Copy `.env.example` to `.env`. Set `MAINNET_RPC_URL` and `ETHERSCAN_API_KEY`.
3. Rehearse on a local fork with the real Safe address. This proves the Safe accepts the payment:

   ```sh
   DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=<safe> DRY_RUN=0 yarn deploy:fork
   ```

4. Dry run against mainnet. Read every printed value: name, symbol, plans, feed, payout.

   ```sh
   DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=<safe> yarn deploy --network mainnet
   ```

5. Deploy for real. Pick a time when gas is low.

   ```sh
   DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=<safe> DRY_RUN=0 DEPLOYER_PRIVATE_KEY=0x... yarn deploy --network mainnet
   ```

6. Verify on Etherscan:

   ```sh
   yarn hardhat verify --network mainnet --constructor-args deployments/5chan-pass-mainnet.args.js <address>
   ```

7. On Etherscan, read `payout()`, `plans()`, `name()` and `symbol()` from the verified contract and compare them with the dry run.
8. Buy one real pass and check that the payment arrives in the Safe.
9. Commit `deployments/*.json` and the `.args.js` files. Put the addresses in the README table.
10. Move any ETH left in the deployer address out and stop using it.

The script refuses to deploy the same pass twice. A mistake in the parameters cannot be fixed afterwards; it needs a new deployment.

## 4. After deployment

- [ ] mintpass.org: replace "Not deployed yet" with the addresses and Etherscan links; change "Not on sale yet".
- [ ] `@bitsocial/pubsub-voting`: the canonical voting criteria still point at a Base Sepolia test pass. Publish criteria that use the mainnet addresses and chain id 1. BSIP-18 requires verifiers to have archive depth of at least one expiry window on that chain; check the RPCs the apps use.
- [ ] `@bitsocial/evm-contract-challenge`: point captcha-free posting at the mainnet addresses.
- [ ] 5chan and Seedit: purchase page (`quote`, then `purchase(accountAddress, planId)` with a small buffer), expiry display, renewal, and the "back up your account first" warning before paying.
- [ ] README: add a "Deploy your own pass" section for other projects.
- [ ] Update BSIP-13 and this file if the Safe details they describe have changed.

## Website (PR 29)

- [x] Bitsocial Forge Inc. attribution removed.
- [x] Rebuilt as a developer page: known implementations linking to each app's pass page, how it works, interface, deploy your own, link to BSIP-18.
- [ ] Commit the local `yarn start` preview scripts.
- [ ] Deploy to Vercel after review.
