# AGENTS.md

MintPass is one Solidity contract (`contracts/MintPass.sol`) deployed once per Bitsocial app: 5chan Pass and Seedit Gold. It holds real money on Ethereum mainnet, so correctness beats brevity.

- Use Corepack-managed Yarn 4 and pin exact dependency versions.
- After changing the contract, tests, or deploy code, run `yarn test`, `yarn typecheck`, and `yarn coverage`. Run `yarn test:fork` when pricing or feed handling changes.
- Deployed contracts are immutable. Never run the deploy script with `DRY_RUN=0` against `mainnet` or `sepolia`, and never read, print, or request `DEPLOYER_PRIVATE_KEY`; the maintainer deploys.
- `deploy/config.ts` values become immutable contract state. Change them only when the maintainer asks.
- Keep `balanceOf` expiry semantics and the ERC-5192 interface: directory voting (`@bitsocial/pubsub-voting`, `erc5192-min-balance`) and `@bitsocial/evm-contract-challenge` depend on both.
- Start work on a short-lived `codex/<type>/<slug>` branch and open a PR into `master`.
