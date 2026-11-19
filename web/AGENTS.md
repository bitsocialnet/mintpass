# Website development

Read the repository root AGENTS.md first. This directory is an independent Yarn 4 project using React, Vite, and strict TypeScript. Install dependencies inside `web/`, and keep its `yarn.lock` synchronized with exact dependency pins.

- `yarn start` opens the website through Portless at `https://mintpass.localhost`. Linked worktrees receive branch-scoped URLs. `PORTLESS=0` bypasses the proxy; `BROWSER=none` suppresses browser opening.
- Keep page content in typed React components under `src/`, styles in `src/styles.css`, and static assets in `public/`. Preserve the existing layout, wording, metadata, anchors, and accessibility unless a task changes them.
- Derive values during render where possible. Use effects for synchronization with external systems. Keep TypeScript `strict` enabled and avoid `any` or suppression comments to bypass errors.
- Production is static. `scripts/build.mjs` pre-renders both HTML entry points and the browser hydrates them. Keep browser-only APIs out of page rendering. `vite.config.ts` handles local retired-route redirects and 404s; preserve parity with `vercel.json` when changing routes.
- Agentation and element-source load only in development. Preserve toolbar suppression flags for automated screenshots. Keep these packages out of production bundles.
- Run `yarn agent:verify` after substantive frontend changes. It runs lint, formatting checks, strict type checking, the static build, and React Doctor. Use `yarn preview` for production browser checks. Check both the normal page and affected error/redirect paths.
- When choosing a native control, focus behavior, browser API, or browser-sensitive layout, consult [Modern Web Guidance](../.agents/skills/modern-web-guidance/SKILL.md) for the relevant feature.
- Use the shared `web-development` skill for browser checks, source inspection, and session cleanup. Review substantive changes with `code-quality-review`.
- Root Hardhat checks apply when contract, tests, or deployment source changes. Website checks run separately.

The source skills in `../.agents/skills/` are also available to Claude through `../.claude/skills`. Keep that link intact when changing workflow files.
