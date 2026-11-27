# Research: buying a pass without revealing your wallet

Status: research, nothing built. Written 2026-11-27; external facts checked that day. The decisions at the end are the maintainer's.

## Short answer

Yes, and the contract already allows it. `purchase(to, planId)` lets anyone pay for any holder, and in 5chan the holder is the account's built-in address, which never needs funds. A buyer who pays from a wallet nobody can tie to them reveals nothing about their real wallet. Zero-knowledge proofs do that work inside existing tools (Railgun, Privacy Pools), so the pass needs no ZK code of its own for this.

A zero-knowledge pass, where a post proves "the author holds some valid pass" without naming which one, is a separate and larger project. It is the only way to stop the holder address being a public identifier. It also gives a ban that follows the pass, which the [Tor plan](TOR-AND-XMR.md) needs. It does not need to hold up the MintPass deployment.

## What leaks today

1. On a board that uses the pass challenge, each post carries `author.wallets.eth`: the account's built-in address with its BSIP-22 proof. Every reader sees it.
2. Every `purchase` emits `Purchased(payer, to, tokenId, planId, paidWei, expiresAt)`, with `payer` and `to` indexed. Looking up the holder gives the payer, and every renewal adds another event naming its payer.
3. The 5chan purchase box (branch `codex/feature/pass-purchase`) pays from the injected browser wallet, which for most people is their main wallet, with its history, ENS name and exchange deposits.

So anyone can follow a post to the holder, the holder to the payer, and the payer to everything that wallet has done.

## Level 1: pay from a wallet nobody can link to you

None of these routes needs a contract change.

| Route | On-chain payer | What it relies on |
|---|---|---|
| Railgun cross-contract call | Railgun's Relay Adapt contract, which every Railgun user shares | Railgun's pool and broadcasters |
| Privacy Pools, then a fresh address | A fresh address with no public funding link | 0xbow's ASP and relayer |
| Monero relay ([TOR-AND-XMR.md](TOR-AND-XMR.md)) | The relay's hot wallet | The relay operator |
| Someone else pays (a friend, an exchange withdrawal to a fresh address) | That person or fresh address | Whoever pays, or the exchange, which knows the account |

**Railgun.** A shielded WETH balance can call contracts through Relay Adapt (`0xAc9f360Ae85469B27aEDdEaFC579Ef2d052aD405` on Ethereum) in one transaction. Relay Adapt unshields, unwraps to ETH, calls `purchase(holder, planId)` with the value attached, and shields what is left back to the user. A broadcaster submits it and is paid from a private note, so no public wallet of the user's appears. ETHBEAT lists $94.25M held and about 5,080 deposits in the last 30 days, which is a large anonymity set. Fees: 0.25% to shield, 0.25% to unshield, plus the broadcaster's fee. RAIL stakers can upgrade the core contract with no delay.

- `purchase` refunds any excess to `msg.sender`, which here is Relay Adapt. The call sequence must wrap and reshield that refund in the same transaction, or it stays in Relay Adapt for the next caller.
- To verify before recommending it: a July 2025 Reddit report said Relay Adapt calls were disabled on Ethereum at the time. Check the current state, then buy one real pass this way once the pass is on mainnet.

**Privacy Pools v2 (0xbow).** Live on Ethereum mainnet for ETH, USDC and USDT. A user withdraws to a fresh address through the relayer, which pays the gas, and the fresh address then calls `purchase`. The anonymity set is small: ETHBEAT lists $716K held and 181 deposits in 30 days. 0xbow runs the ASP, the only relayer and the website, a multisig can upgrade the core contracts with no delay, and the ASP can freeze notes; ragequit gets the funds out publicly. ETHBEAT also notes that the ASP update that first approves a deposit often leaves one candidate, and that 0xbow sees the IPs of both the deposit and the withdrawal sessions.

**Tornado Cash.** It was removed from the sanctions list in March 2025, but its developer's retrial on the money-laundering and sanctions counts is set for 26 April 2027. 5chan should neither integrate it nor point users to it while that case is open.

**Leaks that remain on every route:**

- **Timing and amount.** Shielding exactly the pass price and buying a few minutes later links the two. Shield a round amount, and buy later.
- **The fresh address.** If the main wallet ever funds it, or it is used for anything else, the link comes back.
- **Network.** The RPC provider, the broadcaster or relayer, and 0xbow can see IP addresses. Use Tor, or an RPC the user trusts.
- **The holder itself.** It stays a public identifier for the account: every post with the wallet entry, on every board, names the same address, and the chain shows when it bought and renewed. As long as the holder never sends a transaction, that is all it reveals.

**Client work in 5chan:**

- Before the wallet prompt, say that paying from a browser wallet publicly ties that wallet to the account.
- Offer "pay from another wallet": show the holder address and explain that any wallet, a shielded balance or the Monero relay can pay for it. The box already displays the holder.
- Later: pay from a shielded balance in one step. The Ethereum Foundation's Kohaku SDK, announced on 3 November 2026, bundles private sends with Railgun and Privacy Pools and gives each app its own account. It is worth evaluating once it is stable, rather than integrating Railgun's SDK directly.

## Level 2: a zero-knowledge pass

A post would prove that its author holds an unexpired pass without naming it. No holder address appears in the publication.

**Sketch on Semaphore v4:**

- **Buying.** `purchase(identityCommitment, planId)`. The client creates a Semaphore identity, and the contract stores an expiry per commitment and inserts the commitment into a LeanIMT group. A renewal is a purchase for the same commitment; the chain links renewals, as it does today.
- **Expiry.** Anyone can call `prune(commitment)` once a commitment has expired, which removes it from the tree. This keeps Semaphore's circuits and trusted setup unchanged. A custom circuit that proves `expiresAt > now` inside the leaf would avoid pruning, but it would need its own audit.
- **Posting.** The client proves membership with `scope` set to the community's public key and `message` set to the author key address, so the proof cannot be moved to another author key. The nullifier, `Poseidon(scope, secret)`, is the same for every post that uses that pass in one community and different in every other community.
- **Where the proof travels.** In the challenge exchange, which pkc-js encrypts to the community. Readers never see the proof; only the community sees the nullifier.
- **Verifying.** A new challenge runs the Groth16 check off-chain and confirms that the root is one the contract held recently. Each purchase changes the root, so the challenge must accept roots from a short window, and that window is how long a pruned pass keeps working.
- **Bans.** The community bans the nullifier, not the author key. A new author key with the same pass produces the same nullifier, so the ban holds, and getting around it costs a new pass. This meets the Tor plan's prerequisite, a ban that follows the pass, without a single identifier that works across communities.
- **Voting.** The `erc5192-min-balance` rule reads `balanceOf(address)`. A ZK rule with `scope` set to the contest id would give one vote per pass per contest. Semaphore was designed for this kind of vote.
- **Migrating MintPass holders.** A holder signs once to register a commitment for the rest of its time. That publicly links the holder to the commitment, but posts carry only nullifiers, which nobody can tie to a commitment without the secret. This is why the ZK pass can be a sibling contract deployed later.

**Costs and unknowns:**

- A new contract and its audit. Poseidon hashing on L1 makes each purchase cost more gas than today's mint; measure it.
- Proving cost in the client. Semaphore publishes Node and browser benchmarks (as images); measure on low-end phones in 5chan before committing. One proof per author key, community and root window keeps the work down.
- A BSIP for the proof format in challenge answers, the `scope` and `message` bindings, and the root window.
- The same verifier in the spam blocker's upload authorization and in directory voting.
- It removes the pass as a link between communities, not other links. If a client uses one author key everywhere, its posts stay linkable through that key.

**Alternatives considered:**

- **RLN (rate-limiting nullifiers).** Limits each membership to a message rate per epoch, so posts stay unlinkable even inside one community. A community can throttle a member but not ban one, and exceeding the rate reveals the member's secret, which would expose the pass in every community. It fits chat (DarkFi, Waku) better than moderated boards. Waku's RLN membership contract is the closest precedent for paid, expiring memberships: 180 days active, a 30-day grace period, and a price per message rate ([spec](https://github.com/waku-org/specs/blob/master/standards/core/rln-contract.md)).
- **zk-ECDSA over the current holder addresses.** Works with MintPass as deployed: the client proves its account key controls one of the valid holders. It needs deterministic nullifiers of the PLUME kind (ERC-7524) and an off-chain holder tree that every verifier rebuilds from events. It is heavier and less mature than Semaphore.
- **Blind-signature tokens (Privacy Pass, Chaumian e-cash).** These need an issuing server that every board trusts, which breaks the contract's no-admin design.

## Recommendation

1. **Now:** Level 1. Add the warning and the "pay from another wallet" path to the 5chan purchase box, keep the Monero relay plan, and test the Railgun route with a real purchase after deployment.
2. **Do not change MintPass before deployment for this.** A ZK pass can be a sibling contract with a migration path.
3. **Decide on the ZK pass before building the wallet-based ban linkage in the Tor plan.** Both solve the same problem, and building the wallet-based version first would mean doing that work twice.

## Decisions needed

- Whether the purchase box names Railgun and Privacy Pools or stays generic.
- Whether the ZK pass replaces the wallet-based ban linkage in [TOR-AND-XMR.md](TOR-AND-XMR.md).

## Sources

- [Railgun cross-contract calls](https://docs.railgun.org/developer-guide/wallet/transactions/cross-contract-calls) · [Relay Adapt on Etherscan](https://etherscan.io/address/0xAc9f360Ae85469B27aEDdEaFC579Ef2d052aD405) · [ETHBEAT: Railgun](https://ethbeat.org/privacy/projects/railgun)
- [Privacy Pools v2 launch](https://0xbow.io/blog/privacy-pools-v2-is-live) · [ETHBEAT: Privacy Pools v2](https://ethbeat.org/privacy/projects/privacy-pools-v2)
- [Semaphore v4 spec](https://github.com/ethereum/access-layer-specs/blob/main/specs/3-semaphore-v4/README.md) · [Semaphore benchmarks](https://docs.semaphore.pse.dev/benchmarks)
- [Kohaku](https://ethereum.org/apps/kohaku/) · [Tornado Cash retrial date (The Block, 26 Aug 2026)](https://www.theblock.co/news/regulation/2026-08-26-tornado-cash-roman-storm-retrial-april-2027-412761)
