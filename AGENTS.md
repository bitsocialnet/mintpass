# AGENTS.md

## Project Overview

MintPass is a multi-part authentication system for Bitsocial and other decentralized apps:
- `web/`: Next.js site + API for SMS verification and mint flow
- `contracts/`: Solidity contracts for MintPass NFTs
- `challenge/`: PKC challenge module that verifies NFT ownership

This is not a single app repo. Treat it as a coordinated multi-project codebase.

## Agent Operating Principles

- Explicit user instructions take precedence over repository workflow guidance. Resolve routine choices within the request; ask when missing information materially changes the outcome.
- Continue authorized work through implementation, appropriate verification, and fixes until the requested outcome is complete.
- Prefer the smallest implementation that solves the requested problem. Do not add speculative abstractions, configurability, or features.
- Keep diffs surgical. Do not refactor, reformat, rename, or "improve" adjacent code unless it is necessary for the task.
- Clean up only artifacts created by the current change, such as newly unused imports or dead helper code.
- For non-trivial work, define success criteria and verify them with the narrowest reliable checks before marking the task complete.

## LLM Knowledge Base Policy

Use compiled context for orientation, not as source of truth.

Source of truth:

- Code, tests, package manifests, docs, and runtime/live evidence when relevant.

Compiled context:

- `AGENTS.md`, directory-specific `AGENTS.md` files, `CLAUDE.md`, and repo-managed `.agents/`, `.codex/`, `.cursor/`, and `.claude/` workflow files.
- `docs/**`, tracked task notes, and tracked `llms.txt` / `llms-full.txt` files when present.

Agents may use compiled context to navigate quickly, but must verify against source files before making behavioral claims or edits. External code graph, RAG, MCP, or wiki tools are optional local accelerators unless the developer explicitly asks to make one part of the committed workflow.

## Repository Shape (Critical)

```text
mintpass/
├── web/         # Next.js 15 app (pages router) + API routes
├── contracts/   # Hardhat + Solidity contracts and deployment scripts
├── challenge/   # TypeScript challenge package for pkc-js
├── dist/challenge/  # Published challenge artifact copied from challenge/dist
└── docs/        # Specs and challenge docs
```

Important:
- Root workspaces include `contracts` and `challenge` only.
- `web` has its own `package.json` and `yarn.lock`; install/run it separately.
- `challenge/dist` and root `dist/challenge` are generated artifacts. Do not hand-edit them.

## Stack

- Node.js `22.12.0` via `.nvmrc`
- Yarn 4 via Corepack (run `corepack enable` once per machine, then use plain `yarn`)
- TypeScript (strict mode in `web`, `contracts`, `challenge`)
- Web: Next.js 15, React 19, Tailwind, Radix/shadcn-style UI, Zod, Upstash/Vercel KV
- Contracts: Solidity `0.8.24`, Hardhat, OpenZeppelin, ethers v6
- Challenge: TypeScript ESM + `viem` + `keyv`, integrated with pkc-js challenge interface

## Commands

### Root

```bash
yarn install                      # install root + contracts + challenge deps
yarn build                        # build contracts + challenge, then publish challenge artifact to dist/challenge
yarn test                         # contracts test suite
yarn test:contracts
yarn test:challenge
yarn test:challenge:local
yarn clean
```

### Web (`web/`)

```bash
cd web
yarn install
yarn dev                          # local dev server
yarn build                        # production build
yarn start                        # run built app
yarn lint                         # Next.js lint rules
yarn smoke:preview                # preview smoke flow (requires env)
yarn smoke:prod                   # production smoke flow (requires env)
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
yarn test                         # automated local integration (hardhat + kubo)
yarn test:manual
yarn clean
```

## React Doctor (Advisory)

React Doctor is advisory quality tooling for React architecture/perf/correctness checks. **Scope: `web/` only** (the Next.js app).

**Standard commands** (run from `web/`):
- `cd web && yarn doctor`, `cd web && yarn doctor:score`, `cd web && yarn doctor:verbose`

**Trigger rules:**
- Use when React state, effects, data flow, or performance diagnostics would resolve a concern. Review only guidance relevant to the affected Next.js flow.
- Do not run Doctor for documentation, styling alone, or every component edit.

**Interpretation:**
- Treat diagnostics as actionable recommendations.
- Prioritize `error` diagnostics first, then `warning`.
- Score is informative only; no merge blocking based on score yet.

## Verification by impact

- Documentation or AI context: review the diff and references. Run `yarn llms:generate` for public docs/AI context and include `llms*.txt` plus `web/public/llms*.txt`. AI skill changes also require `yarn ai-workflow:sync`, `yarn ai-workflow:check`, and `yarn ai-workflow:test`.
- Isolated implementation changes: run a focused test/reproduction and the affected package’s lint/type checks where applicable. Add regression coverage for non-trivial testable bugs.
- Web runtime, dependency, or build integration: use `web/` lint and build, plus affected tests. Select browsers/viewports for changed UI behavior; use Doctor when it answers a React architecture/performance concern. Auth/mint smoke tests need the appropriate environment and authorization for their external effects.
- Contract behavior or interfaces: run the relevant contract tests and compile. Preserve checks for minting, access roles, token types, and metadata.
- Challenge runtime or public API: run the affected challenge tests and build; refresh the committed challenge artifacts with root `yarn build:challenge` and `yarn publish:challenge`. The latter copies local artifacts; it does not publish to a registry.
- Changes spanning package interfaces/build integration: run the affected package checks and the root build/tests needed to validate their interaction.

Serialize installs, full builds/tests, and browser sessions. Preserve other tasks’ processes and artifacts. Repeat checks only after relevant edits, failures, or unresolved concerns; respect explicit CI/release requirements.

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
- Maintain compatibility with pkc-js challenge contract (factory + option handling).
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

## AI skills and native entry points

`AGENTS.md` provides shared project guidance; `CLAUDE.md` imports it. The committed skill is `impeccable`, for requested frontend design/refinement work. Other skills may be available in a contributor’s app, but are not provided by this checkout.

- Edit `.agents/skills/`, which Codex and Cursor discover directly. `yarn ai-workflow:sync` generates the committed `.claude/skills/` copy for Claude Code. Run the check/test commands before finishing skill changes; remove obsolete generated files explicitly when retiring sources.
- Do not duplicate `.codex/skills/` or `.cursor/skills/`. The bundled Impeccable `agents/*.toml` files are instruction templates, not automatically discovered custom agents. Read a relevant template and delegate to an available role when useful.
- Keep model and reasoning defaults out of committed agent instructions/templates. Runtime invocation choices, user settings, and parent inheritance handle selection according to each app. A model alias still chooses a family; inheritance does not guarantee automatic selection of the best model.
- Preserve the design skill’s licensed assets and source references. Load only the reference relevant to the requested design action; a narrow refinement does not require an interview, a redesign, or new product claims.
- There are no default committed lifecycle hooks. Keep Git cleanup, installs, builds, and compulsory review loops out of session-end hooks. Design detector helpers remain optional, explicitly invoked tooling; normal design work does not install hooks.
- Keep harness-specific configurations separate if introduced by a future authorized task: `.codex/agents/*.toml`, `.cursor/agents/*.md`, and `.claude/agents/*.md` are native agent paths. `.agents/roles` would be repository generator input, not a native app directory.

Official references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Cursor skills](https://cursor.com/docs/skills), [Claude skills](https://code.claude.com/docs/en/skills), and [Claude memory import](https://code.claude.com/docs/en/memory). Keep skill descriptions concise and supporting detail conditional, following [OpenAI’s skills guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

## Git and delegation

- Work on a descriptive task branch/worktree when isolation is useful, unless the user specifies the branch. Preserve unrelated changes and never switch another task’s checkout.
- Stage only task-owned changes. Commit, push, publish, deploy, or open issues/PRs only within the user’s authorization; existing permission does not need repeated confirmation.
- Use Conventional Commit wording when creating an authorized commit or when wording is requested. Do not append commit/issue suggestions to ordinary implementation reports.
- Delegate substantial independent work when useful; give each child scope, ownership, and evidence to return. Keep small/coupled work local and serialize heavy verification.

## Bug Investigation (Mandatory First Step)

A bug fix requires either a reproduction of the reported behavior or conclusive source/runtime evidence that identifies both the defect and the correct fix with equivalent certainty.
If the bug cannot be reproduced and the evidence is not conclusive, do not guess or make speculative changes. Report what was checked, say that the bug was not reproduced, and ask for the missing reproduction details when useful.
When proceeding from conclusive evidence without a reproduction, explain why the evidence is sufficient and add a targeted regression test when practical.
If the user reports a bug in a specific file/line/area, also check git history before editing.

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

## Tool selection

Use `gh` for GitHub operations and the existing browser verification tooling when relevant. Keep the active tool catalog relevant; deferred loading can reduce MCP context overhead. Do not install additional integrations or skills merely because a task mentions their domain.

## Troubleshooting

- Use official version-specific documentation when an API/platform uncertainty remains. Report missing private data or user-only reproduction details as the specific gap.

## Practical Boundaries

- Keep diffs minimal and scoped to the request.
- Do not silently refactor unrelated areas.
- Preserve backwards compatibility unless the user asks for a breaking change.
- For UI changes, verify desktop and mobile behavior.
