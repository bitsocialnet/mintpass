---
name: web-development
description: Develop, debug, and verify the MintPass React website, including Portless, Agentation feedback, source inspection, and production static rendering.
---

Read web/AGENTS.md. Work in web/ with its own Yarn project and lockfile. Run corepack yarn install --immutable for a fresh checkout, then yarn start. Use the printed Portless URL, normally https://mintpass.localhost. Set BROWSER=none for automated checks. Reuse a compatible server or track and stop only one you started.

For a visual feedback task, use the development Agentation toolbar to identify the element and requested change. The source inspector is available after window.__ELEMENT_SOURCE__ loads. Resolve a known DOM element with window.__ELEMENT_SOURCE__.resolveElementInfo(element), then inspect the returned source/stack against current files. Treat attribution as a starting point for investigation.

Use the installed Playwright CLI with the shared browser ownership wrapper. From web/ run ../scripts/pw-session.sh open mintpass-check <printed-url> --browser=chrome and yarn playwright-cli -s=mintpass-check snapshot. When run from the repository root, set PLAYWRIGHT_CLI_BIN to the absolute web/node_modules/.bin/playwright-cli path. Inspect ../scripts/pw-session.sh help or yarn playwright-cli --help for additional commands. Close the exact owned session with ../scripts/pw-session.sh close mintpass-check, including after failure. Exit 75 means another task owns the slot, so wait or do independent checks. Never terminate unrelated browser sessions.

Set window.__VISUAL_TESTING__ or window.__NO_DEV_TOOLBAR__ before page scripts run to suppress Agentation in automated screenshots. Check affected anchor navigation, desktop/mobile layout, browser console errors, and light/dark appearance when styles change. Verify production with yarn build then yarn preview, including real 404s and retired-route redirects. Confirm page content exists in dist/index.html without JavaScript and development tooling is absent from dist/assets.

Run yarn agent:verify after the final implementation. It checks lint, formatting, strict TypeScript, static production builds, and React Doctor diagnostics. Add meaningful regression coverage for bugs that existing checks would miss. Report actual results and any verification limits. Commit, push, deploy, and contract deployment require the authorization described in AGENTS.md.
