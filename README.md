# MintPass

<img src="public/mintpass.png" alt="MintPass logo" width="90" align="left" />

MintPass is a paid, non-transferable, expiring pass on Ethereum mainnet. Each Bitsocial app deploys its own MintPass: **5chan Pass** for [5chan](https://github.com/bitsocialnet/5chan) and **Seedit Gold** for [Seedit](https://github.com/bitsocialnet/seedit). Holding a valid pass lets its holder vote in directory contests and post without solving a captcha on communities that check it.

<br clear="left" />

- The price is fixed in USD and paid in ETH, converted with the Chainlink ETH/USD feed. Nobody has to update prices by hand, and no stablecoin is involved.
- Anyone can buy for any address: `purchase(to, planId)`. The payer (for example MetaMask) and the holder (for example a 5chan account's built-in address) can differ. Excess ETH is refunded to the payer.
- Each address holds at most one token. Buying again for the same address renews that token; it never mints a second one.
- The token is locked forever (ERC-5192). It cannot be transferred, approved or burned. There is no admin mint.
- Proceeds go straight to a payout address. Changing the payout address is the only privileged action.

Plans (both deployments): 365 days for $30, and 3 × 365 days for $60.

| Deployment | Name | Symbol | Address |
| --- | --- | --- | --- |
| `5chan-pass` | 5chan Pass | `5PASS` | not deployed yet |
| `seedit-gold` | Seedit Gold | `SGOLD` | not deployed yet |

MintPass v1 (2025) minted a testnet NFT after SMS phone verification and shipped the `@bitsocial/mintpass-challenge` package. That approach is retired and the package is deprecated; its code remains in this repository's git history. Free posting now uses [`@bitsocial/evm-contract-challenge`](https://github.com/bitsocialnet/evm-contract-challenge) against a MintPass.

## Why `balanceOf` reflects expiry

`balanceOf(owner)` returns **1 while the owner's pass is unexpired and 0 otherwise**. This deliberately departs from ERC-721 (see the NatSpec in `contracts/MintPass.sol`). The token still exists after expiry: `ownerOf` returns the holder, `locked` returns true, and a renewal extends the same token.

This lets both consumers honor expiry with no code changes:

- **Directory voting** (`@bitsocial/pubsub-voting`, gate rule `erc5192-min-balance`) reads `balanceOf(voter) >= min` (default `min` is 1). It also requires `supportsInterface(0xb45a3c0e)` to be true, and otherwise admits nobody. The pass is non-transferable, unburnable and cannot be reissued, so one pass backs exactly one wallet's vote (see "Does one Pass mean one vote?" in that repo's `DESIGN.md`). The rule falls back to the ballot's pinned block when the current head reads 0. A vote cast while the pass was valid therefore stays live until the vote itself expires, even if the pass expires first. New votes need a valid pass.
- **Free posting** (`@bitsocial/evm-contract-challenge`) checks `balanceOf(address) > 0`.

Other consequences to keep in mind:

- `balanceOf(ownerOf(id))` can be 0.
- Balances change with time, with no transaction and no event.
- Indexers that count `Transfer` events will over-count expired passes.

## Interface

| Function | Notes |
| --- | --- |
| `purchase(address to, uint256 planId) payable returns (uint256 tokenId)` | Mints if `to` has no pass (`expiresAt = now + duration`). Otherwise renews: `expiresAt = max(expiresAt, now) + duration`. Forwards exactly the quote to `payout` and refunds the excess to `msg.sender`. |
| `quote(uint256 planId) view returns (uint256 wei)` | The price in wei, rounded up. The UI should send `quote` plus a small buffer; the excess is refunded. |
| `plans()`, `planCount()` | `Plan { uint64 duration; uint128 priceUsdCents }`. The plan id is the array index. |
| `tokenOf(address)`, `expiresAt(tokenId)`, `isValid(address)` | `tokenOf` returns 0 if the address has no pass. Token ids start at 1. A pass is valid while `block.timestamp < expiresAt`. |
| `balanceOf`, `ownerOf`, `locked`, `supportsInterface`, `tokenURI` | ERC-721 + ERC-5192. `tokenURI` returns on-chain JSON (a base64 data URI) with an `expiresAt` attribute. |
| `setPayout(address)` | **The only privileged function.** Only the current payout can call it. It emits `PayoutChanged`. |

`purchase` and `quote` revert when:

- the feed answer is `<= 0`;
- `updatedAt` is 0 or in the future;
- the answer is older than `maxStaleness`.

## Develop

```sh
yarn install
yarn test          # 67 unit tests (the fork test is skipped)
yarn test:fork     # mainnet-fork test against the real feed (FORK_TEST_RPC_URL, default publicnode)
yarn gas           # deterministic gas numbers
yarn test:gas      # hardhat-gas-reporter over the unit tests
yarn coverage      # solidity-coverage
yarn typecheck
```

The toolchain is Hardhat 2.29.1, solc 0.8.30 (optimizer 200 runs, `evmVersion` prague) and OpenZeppelin Contracts 5.6.1. Every dependency version is pinned exactly.

On every compile, solc prints one warning about transient storage. It comes from OpenZeppelin's `ReentrancyGuardTransient`, which is the documented safe use (OpenZeppelin deprecated the storage-based guard in 5.6).

## Deploy

Parameters live in `deploy/config.ts`: names, symbols, plans, feed addresses and staleness bounds. The deploy script reads the deployer key only from `DEPLOYER_PRIVATE_KEY`. **It is a dry run unless you set `DRY_RUN=0`.**

```sh
# Dry run. Reads the live feed, simulates the constructor, estimates gas and cost, sends nothing.
DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=0x... yarn deploy --network mainnet

# Full rehearsal on a local mainnet fork: deploy, post-deploy checks and a smoke purchase.
DEPLOYMENT=seedit-gold PAYOUT_ADDRESS=0x... DRY_RUN=0 yarn deploy:fork

# Real deployment.
DEPLOYMENT=5chan-pass PAYOUT_ADDRESS=0x... DRY_RUN=0 DEPLOYER_PRIVATE_KEY=0x... yarn deploy --network mainnet
yarn hardhat verify --network mainnet --constructor-args deployments/5chan-pass-mainnet.args.js <address>
```

| Network | Feed (ETH/USD proxy) | `maxStaleness` |
| --- | --- | --- |
| mainnet | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | 7200 s (two 1 h heartbeats) |
| sepolia | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | 86400 s (testnet feeds are less reliable) |

A real deploy writes `deployments/<deployment>-<network>.json` and an `.args.js` file for verification.

## Gas

These numbers come from `yarn gas`, which runs on the in-process network with a mock feed. The payout is an existing account.

| Operation | Gas |
| --- | --- |
| Deploy (2 plans) | 2,199,307 |
| First mint, exact payment | 132,254 |
| First mint (gift), with refund | 139,169 |
| Renewal, exact payment | 63,654 |
| Renewal, with refund | 70,581 |
| `setPayout` | 28,659 |

The real Chainlink proxy adds about 5.5k gas per purchase. The fork test measured 144,682 for a first mint and 76,106 for a renewal, both with refund. Runtime bytecode is 20,047 bytes, under the 24,576-byte limit.

## Risks

- **Chainlink dependency.**
  - If the feed is stale (older than `maxStaleness`), returns a non-positive answer, or reverts, `quote` and `purchase` revert until the feed updates. Existing passes keep working.
  - There is no admin to switch feeds. If Chainlink ever deprecates this proxy, the contract can no longer sell passes. The fix is a new deployment, and consumers (voting criteria, challenge config) would have to point at it.
- **Payout key loss.**
  - Only the payout can call `setPayout`. If its key is lost, all future proceeds go to the lost address, and no one can redirect them.
  - `setPayout` is single-step, so a mistyped address has the same effect.
  - A payout that rejects ETH blocks every purchase until it rotates itself.
- **No refunds.** Time is prepaid and cannot be cancelled. Renewals stack.
- **Unsolicited gifts.** Anyone can mint a pass to any address or extend one. The recipient cannot refuse it or burn it.
- **Contract payers must accept ETH refunds.** Otherwise they must send the exact quote, or the purchase reverts.

## Security notes

- **Reentrancy.** `purchase` is `nonReentrant` and follows checks-effects-interactions: all state and events come before the two ETH transfers. Tests cover payers and payouts that re-enter.
- **Rounding.** The price uses `Math.mulDiv` rounded up, so it never undercharges and never quotes 0. It is checked against a reference formula across 0, 6, 8 and 18 feed decimals.
- **Overflow.** Expiry is `SafeCast.toUint64` and reverts instead of wrapping. The token counter uses checked arithmetic. Feed decimals are capped at 18.
- **Stale and invalid oracle data.** Covered by the revert conditions above.
- **Transfer, approve and burn paths.** None exist: `_update` only allows mints, and `approve` and `setApprovalForAll` revert.
- **Griefing via `to`.** Minting uses `_mint`, not `_safeMint`, so it never calls into `to`. Gifts and renewals by third parties only add time.

The contract has not had an external audit.

## License

MIT
