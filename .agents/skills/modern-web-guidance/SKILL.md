---
name: modern-web-guidance
description: Look up browser support and implementation guidance when choosing a native control, focus behavior, browser API, or browser-sensitive layout.
---

From the repository’s `web/` directory, use the CLI pinned in the lockfile. Search for the browser behavior, then retrieve the matching guide by its returned ID.

```sh
DISABLE_TELEMETRY=1 yarn modern-web-guidance search "skip repeated navigation"
DISABLE_TELEMETRY=1 yarn modern-web-guidance retrieve accessibility
```

Apply the relevant guidance to the website. Preserve its static HTML and hydration behavior, and follow the [website verification instructions](../../../web/AGENTS.md).
