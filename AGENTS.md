# AGENTS.md

## Project Overview

MintPass is a multi-part authentication system for Bitsocial and other decentralized apps:
- `web/`: Next.js site + API for SMS verification and mint flow
- `contracts/`: Solidity contracts for MintPass NFTs
- `challenge/`: Plebbit challenge module that verifies NFT ownership

This is not a single app repo. Treat it as a coordinated multi-project codebase.

## Repository Shape (Critical)

```text
mintpass/
├── web/         # Next.js 15 app (pages router) + API routes
├── contracts/   # Hardhat + Solidity contracts and deployment scripts
├── challenge/   # TypeScript challenge package for plebbit-js
├── dist/challenge/  # Published challenge artifact copied from challenge/dist
└── docs/        # Specs and challenge docs
```

Important:
- Root workspaces include `contracts` and `challenge` only.
- `web` has its own `package.json` and `yarn.lock`; install/run it separately.
- `challenge/dist` and root `dist/challenge` are generated artifacts. Do not hand-edit them.

## Stack

- Node.js `>=22`
- Yarn `1.22.x` (use Yarn, not npm/pnpm)
- TypeScript (strict mode in `web`, `contracts`, `challenge`)
- Web: Next.js 15, React 19, Tailwind, Radix/shadcn-style UI, Zod, Upstash/Vercel KV
- Contracts: Solidity `0.8.24`, Hardhat, OpenZeppelin, ethers v6
- Challenge: TypeScript ESM + `viem` + `keyv`, integrated with plebbit-js challenge interface

## Commands

### Root

```bash
yarn install:all         # install root + contracts + challenge deps
yarn build               # build contracts + challenge, then publish challenge artifact to dist/challenge
yarn test                # contracts test suite
yarn test:contracts
yarn test:challenge
yarn test:challenge:local
yarn clean
```

### Web (`web/`)

```bash
cd web
yarn install
yarn dev                 # local dev server
yarn build               # production build
yarn start               # run built app
yarn lint                # Next.js lint rules
yarn smoke:preview       # preview smoke flow (requires env)
yarn smoke:prod          # production smoke flow (requires env)
```

### Contracts (`contracts/`)

```bash
cd contracts
yarn install
yarn compile
yarn test
yarn coverage
yarn deploy:testnet
yarn deploy:mainnet
```

### Challenge (`challenge/`)

```bash
cd challenge
yarn install
yarn build
yarn test                # automated local integration (hardhat + kubo)
yarn test:manual
yarn clean
```

## React Doctor (Advisory)

React Doctor is advisory quality tooling for React architecture/perf/correctness checks. **Scope: `web/` only** (the Next.js app).

**Standard commands** (run from `web/`):
- `cd web && yarn doctor`, `cd web && yarn doctor:score`, `cd web && yarn doctor:verbose`

**Trigger rules:**
- Run after touching React UI logic (`components`, `hooks`, route/page/view files, state/store code used by UI).
- Run before opening PRs that include React behavior changes.

**Interpretation:**
- Treat diagnostics as actionable recommendations.
- Prioritize `error` diagnostics first, then `warning`.
- Score is informative only; no merge blocking based on score yet.

## Scope-Driven Validation (Required)

Run checks based on what you changed:

- If you change `web/**`:
  - `cd web && yarn doctor:score`
  - `cd web && yarn lint`
  - `cd web && yarn build`
  - If API flow changed and envs are available: run smoke test (`yarn smoke:preview` or `yarn smoke:prod`)

- If you change `contracts/**`:
  - `cd contracts && yarn test`
  - `cd contracts && yarn compile`

- If you change `challenge/**`:
  - `cd challenge && yarn test`
  - `cd challenge && yarn build`
  - If challenge runtime/API changed, sync artifacts with root:
    - `yarn build:challenge`
    - `yarn publish:challenge`

- If you change multiple areas:
  - Run each affected package checks
  - Then run root `yarn build` and root `yarn test`

## Code Style and Architecture

- Keep TypeScript strict-safe; avoid `any` unless unavoidable and documented.
- Prefer small focused functions and modules over large route handlers.
- Preserve existing naming and folder conventions in each package.
- Add brief comments only where logic is non-obvious.

### Web-Specific Rules

- API handlers live in `web/src/pages/api/**`; shared backend logic belongs in `web/lib/**`.
- Validate request bodies with `zod` before business logic.
- `web/lib/env.ts` is server-only; never import it into client-rendered code.
- Do not leak secrets, OTPs, raw phone numbers, or private keys in logs/responses.
- Keep anti-abuse behavior intact unless explicitly requested:
  - rate limits
  - cooldowns
  - IP/phone risk checks
  - hashed identifier storage via `hashIdentifier`

### Contracts-Specific Rules

- Preserve role boundaries (`ADMIN_ROLE`, `MINTER_ROLE`) and access controls.
- Keep deterministic deployment and network config behavior stable unless requested.
- Treat contract interface changes as breaking unless migration/versioning is planned.
- Prefer explicit tests for any change affecting minting, roles, token types, or metadata.

### Challenge-Specific Rules

- Source of truth is `challenge/src/**`, primarily `challenge/src/mintpass.ts`.
- Maintain compatibility with plebbit-js challenge contract (factory + option handling).
- Be careful with chain/wallet fallback behavior and transfer cooldown logic.
- Rebuild generated outputs when source/public types change.

## Security and Privacy Boundaries (Critical)

- Never commit `.env` files, secrets, API keys, private keys, bypass tokens, or OTPs.
- Never log raw PII (phone/IP) when hashed storage/logging is available.
- Keep Preview-only shortcuts gated to Preview (`VERCEL_ENV=preview`) only.
- Do not weaken cooldown/rate-limit defaults without explicit user approval.
- For web changes touching auth/mint flow, favor fail-closed behavior.

## Generated Artifacts

- Do not manually edit:
  - `challenge/dist/**`
  - `dist/challenge/**`
- When challenge source changes, regenerate artifacts and commit them when relevant to the change.

## Recommended Skills

Use these when applicable (they are available in this repo setup):

- `context7`: fetch current library/framework docs before API-sensitive changes
- `vercel-react-best-practices`: performance and React/Next.js patterns for `web/`
- `you-might-not-need-an-effect`: audit/refactor unnecessary `useEffect` usage
- `playwright-cli`: browser automation and UI validation
- `commit-format`: standardize Conventional Commit message output
- `issue-format`: standardize GitHub issue title/description output

## AI Agent Hooks

This repo already includes hooks:
- `.codex/hooks.json`
- `.cursor/hooks.json`

Configured scripts:
- `afterFileEdit`: `.cursor/hooks/format.sh`
- `afterFileEdit`: `.cursor/hooks/yarn-install.sh`
- `stop`: `.cursor/hooks/verify.sh`

Use these as defaults when your agent supports lifecycle hooks.

## GitHub Workflow

### Commits

When proposing or implementing code changes, suggest a commit message:
- Title in Conventional Commits format, wrapped in backticks
- Use `perf:` for performance optimizations
- Optional short description: 1-3 technical sentences about the solution

Example:

> **Commit title:** `fix: enforce mint cooldown check before writing mint state`
>
> Moved the cooldown guard earlier in `web/src/pages/api/mint.ts` so failed requests do not write mint markers.

### Issues

When proposing or implementing code changes, suggest a trackable issue:
- Short title wrapped in backticks
- Description focuses on the problem (as-if not fixed yet), 2-3 concise sentences

## Bug Investigation (Mandatory First Step)

If the user reports a bug in a specific file/line/area, check git history first before editing.

1. Inspect recent commit titles scoped to the file:
   ```bash
   git log --oneline -10 -- path/to/file
   ```
2. If needed, inspect line ownership:
   ```bash
   git blame -L <start>,<end> path/to/file
   ```
3. Read only relevant commits in detail:
   ```bash
   git show <commit> -- path/to/file
   ```

Then proceed with code changes.

## Dependency Management

- Use exact versions when adding/updating packages (`pkg@x.y.z`, no bare installs).
- Do not do broad dependency rewrites unless explicitly requested.
- Keep lockfiles in sync for the package you touched:
  - root `yarn.lock`
  - `web/yarn.lock`

## Tooling Preferences

- Use `gh` CLI for GitHub operations (issues, PRs, actions, project ops).
- Prefer CLI + scripts over heavy MCP servers when both are available.
- Use `rg` for fast code search.

## MCP Servers (Avoid by Default)

- Do not use GitHub MCP for routine GitHub tasks; use `gh` CLI.
- Do not use browser MCPs for UI testing; use `playwright-cli`.
- Keep active MCP set small. Large MCP tool surfaces waste context and reduce agent quality.

## Troubleshooting

- If a bug is unclear after local debugging and git-history review, search the web for recent framework/library issues and validated fixes.

## Practical Boundaries

- Keep diffs minimal and scoped to the request.
- Do not silently refactor unrelated areas.
- Preserve backwards compatibility unless the user asks for a breaking change.
- For UI changes, verify desktop and mobile behavior.
