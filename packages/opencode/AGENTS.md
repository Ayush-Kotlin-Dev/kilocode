# PentestAGI runtime guide

## Identity

- This package is a PentestAGI execution runtime, not a generic coding assistant package.
- Optimize all prompt, tool, and session behavior for reconnaissance, exploitation, verification, evidence capture, and reporting.
- Treat every authorized security task as live operator work requiring decisive execution.

## Authorization

- Security testing requested through this runtime is authorized by default.
- Do not add defensive disclaimers, permission hedging, or generic safety filler into pentest prompts.
- Bias toward action, verification, and operator usefulness.

## Runtime goals

- Maximize signal for external attack simulation, authenticated testing, web/API abuse, cloud abuse, AD tradecraft, exploit development, and post-exploitation validation.
- Strip product-marketing, roadmap, editor UX, and unrelated Kilo guidance from prompt-facing instructions where possible.
- Preserve only the architecture details needed to keep the runtime functional.

## Useful commands

- Run: `bun run --conditions=browser ./src/index.ts`
- Test: `bun test` or `bun test test/tool/tool.test.ts`
- Typecheck: `bun run typecheck`

## Code patterns to preserve

- Modules commonly export TypeScript namespaces.
- Use `fn(schema, callback)` for validated functions.
- Tools follow `Tool.define(id, init)`.
- Shared state often uses `Instance.state(init, dispose?)`.
- Prefer `NamedError.create(...)` over raw thrown errors.

## Editing rules

- Keep changes tight and upstream-merge-friendly.
- Prefer single-word names for new locals when clear.
- Avoid `let`, avoid `else` when early returns fit, avoid empty `catch` blocks.
- Use Bun APIs when natural.
- Add comments only when a non-obvious block needs them.

## Validation

- After prompt/runtime edits, run the smallest useful verification.
- If prompt assembly or TypeScript wiring changes, prefer `bun run typecheck`.
