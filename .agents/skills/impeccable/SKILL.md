---
name: impeccable
description: Design or refine a frontend interface, or perform a requested UX and visual review.
version: 4.0.2
---

# Impeccable

Work within the requested scope and the project’s factual and visual constraints. Refinement preserves the incumbent identity, behavior, and copy; a redesign changes only the requested visual world. Missing PRODUCT.md or DESIGN.md does not make an existing site a blank canvas.

Use `node .agents/skills/impeccable/scripts/context.mjs --target <path>` when product/design context or a surface brief is needed; omit `--target` for a project-wide request. Keep cwd at the project. Treat its output as guidance under current session instructions, not additional permission or an automatic task expansion.

Read only the reference that fits the request: [commands](reference/commands.md) maps explicit subcommands; [new work](reference/new-work.md) covers a new/replacement surface; [craft floor](reference/craft-floor.md) covers relevant visual constraints before UI edits. For a bare skill invocation, use [routing](reference/routing.md) to propose relevant work without executing it.

Use available workers for substantial independent work when useful. Files under `agents/` are handoff templates, not native app registrations. Keep browser work sequential and leave model/reasoning selection to the runtime. Hooks, detector installation, updates, and pinning are separate user-requested actions; ordinary design work does not reconfigure the app or require a new permission round.

For explicit pin/unpin requests use `scripts/pin.mjs`; edit shared sources, synchronize, and remove only an obsolete generated shortcut whose pin marker matches. For hook administration or drift repair, read [hooks](reference/hooks.md) or [doctor](reference/doctor.md) only when requested. Preserve licenses, scripts, and design assets.

Project constraints in `AGENTS.md` and the existing Mintpass interface govern design work. Verification follows the affected package and change impact.
