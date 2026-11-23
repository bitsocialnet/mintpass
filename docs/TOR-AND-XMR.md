# Plan: 5chan Pass for Tor users, bought with XMR

Status: draft for review, nothing built. Written 2026-11-23.

Tor users should be able to buy a 5chan Pass with Monero directly on 5chan.app, then post and attach images through Tor. This file collects what that needs across mintpass, 5chan, the board defaults and the hosted spam blocker. The decisions marked as open are the maintainer's.

## Where things stand

- **The pass** (`contracts/MintPass.sol`, not deployed yet) is priced in USD and paid in ETH through `quote(planId)` and `purchase(to, planId)`. Anyone can buy for any address, and there is deliberately no admin mint.
- **Captcha-free posting** uses `@bitsocial/evm-contract-challenge`. It calls `balanceOf` on the pass for the author's `author.wallets.eth` address, which needs a BSIP-22 wallet proof. A 5chan account has a built-in Ethereum address, so the holder needs no external wallet. No 5chan board uses the challenge yet.
- **The hosted spam blocker** rejects Tor for every post, even after a sign-in.
  - VPN, proxy and datacenter posts pass with an OAuth sign-in, which the server then remembers for 30 days (spam-blocker-server #41, #45).
  - Image uploads through Tor need a verified .bso name, whitelist or moderator exemption (`routes/upload-authorization.ts`). Since spam-blocker-server #46, uploads through VPN, proxy or datacenter connections are allowed after a signed-in pre-check.
- No plan for Tor or XMR existed before this file.

## Why the pass, and not a sign-in, opens Tor

Tor hides the network, and Google, Apple or Telegram accounts are cheap to replace after a ban. A pass costs $30 a year per identity and cannot be transferred, so a ban costs the spammer real money.

That only holds if a ban burns the pass. Today one wallet can back several author keys (evm-contract-challenge [#12](https://github.com/bitsocialnet/evm-contract-challenge/issues/12)). A banned author could make a new key, sign a new wallet proof with the same pass, and post again. **Prerequisite:** a ban must follow the wallet, the way a sign-in ban follows the OAuth account in the spam blocker (`getSignInBanEnd`), or one wallet must back only one author key.

## Part 1: buying a pass with XMR on 5chan.app

The contract only mints when paid in ETH, and adding an admin mint would break its promise. So a relay sells passes for XMR and buys them on-chain with ETH.

1. **Order.** On 5chan.app the author picks a plan, and the page sends the account's Ethereum address and the plan to the relay.
2. **Quote.** The relay reads `quote(planId)`, converts it to XMR at a current rate plus a buffer, and creates an order with its own subaddress. It returns the amount, the address as text and QR code, and an expiry (about 30 minutes).
3. **Payment.** The relay watches the subaddress with a view-only wallet (`monero-wallet-rpc`) and waits for 10 confirmations, Monero's unlock depth, about 20 minutes.
4. **Mint.** The relay calls `purchase(holder, planId)` with the quoted wei plus a small buffer from its ETH hot wallet (the contract refunds the excess). It stores the transaction hash, and the page polls the order until the pass is active.

Details to settle while building it:

- **Wrong amounts.** Underpaid, overpaid and late payments need order states. A refund needs a Monero refund address, which the order form can ask for as an optional field. Otherwise the relay handles them by hand.
- **Rate source and buffer.** An exchange API, or a Chainlink XMR/USD feed if one exists on mainnet (to check).
- **Hot wallet.** It holds a small ETH balance, alerts when the balance runs low, and has a daily spending cap.
- **Reachability.** The relay runs as an onion service and on clearnet. Whether 5chan.app itself gets an onion address is an open decision.
- **Privacy.**
  - No IP logs. An order holds only the holder address and its subaddress, and is deleted after a set number of days.
  - On-chain, the relay's wallet appears as the buyer, not the person who paid.
  - The holder address and pass are public, as for any pass.
- **Renewals.** These use the same flow, because `purchase` on an existing holder extends the pass.

Rejected alternatives:

- **An admin mint in the contract.** It breaks "no admin mint", and deployed contracts are immutable.
- **Sending users to third-party XMR-to-ETH swaps.** This works today without code, but needs an Ethereum wallet with gas and a custodial swapper, which is a poor fit for Tor users.
- **Trustless XMR-ETH atomic swaps.** Not mature enough to depend on.

## Part 2: posting through Tor with a pass

- **Board defaults (5chan-board-manager):**
  - Add `@bitsocial/evm-contract-challenge`, set to the mainnet 5chan Pass with `balanceOf` and the condition `>0`.
  - Add `{ "challenges": [<pass challenge index>] }` to the spam blocker challenge's `exclude`, next to the existing moderator bypass.
  - Pass holders then skip the spam blocker: its Tor block, its score and its CAPTCHA. That matches what the MintPass README promises.
- **Ethereum access.** Board nodes need an Ethereum RPC for the `balanceOf` call, for example forge-rpc.
- **Ban linkage.** The prerequisite above, so a ban on a pass holder holds.

## Part 3: uploading images through Tor with a pass

- **Recognize the pass.** spam-blocker-server's `/api/v1/upload/authorize` recognizes only .bso names, the whitelist and moderator roles. It must also recognize the pass:
  - when the community's spam blocker `exclude` lists the pass challenge, verify the author's BSIP-22 wallet proof and `balanceOf` on mainnet;
  - then grant the upload like the other verified exemptions, Tor included.
  - The upload request has to carry the signed `author.wallets` entry.
- **Ethereum access.** The spam blocker needs an Ethereum RPC on its host.
- **Upload list.** Include the 5chan boards in `UPLOAD_AUTHORIZATION_EXEMPT_COMMUNITIES`.

## Order of work

1. Settle the decisions below.
2. Make bans follow the wallet (evm-contract-challenge, board flow).
3. Deploy the passes ([LAUNCH.md](LAUNCH.md)).
4. Build the relay and the XMR purchase page on 5chan.app; both can start on Sepolia.
5. Ship board defaults with the pass challenge and the spam blocker `exclude`.
6. Add the pass exemption to the spam blocker's upload authorization.
7. Give 5chan.app and the relay onion addresses, if decided.

## Decisions needed

- Who operates the relay and receives the XMR: the entity and the bookkeeping.
- The rate source, the buffer, and the refund policy.
- Whether pass holders skip the whole spam blocker (the plan above), or only its Tor block.
- Ban follows the wallet, or one wallet per author key.
- An onion address for 5chan.app.
- Whether Seedit Gold gets the same XMR flow.
