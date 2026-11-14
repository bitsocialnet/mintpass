---
name: code-quality-review
description: Review a MintPass diff for correctness, regressions, and unnecessary complexity when review is requested or after substantive implementation.
---

Read the task-owned diff, nearby source, and applicable AGENTS.md. Include untracked files. Preserve review-only scope when only a review was requested.

Trace affected entry points and error paths. Check security boundaries, accessibility, static HTML and hydration, development-only tooling, and compatibility with existing consumers. Preserve contract invariants documented in the root AGENTS.md.

Report actionable findings with file/line evidence, impact, reproduction, and a practical correction. Apply high-confidence in-scope fixes during authorized implementation. Use the narrowest relevant checks from web/AGENTS.md for website changes. Do not introduce approval gates or publishing steps.
