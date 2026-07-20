# ADR 0005 — Use oxlint as the lint tool

- **Status**: Accepted (2026-07-19)
- **Context**: The repo had no lint gate. ESLint is the default but slow to install and configure, and many of its plugins don't work cleanly with React 19 + Vitest. The pidex project has a single-language (TypeScript) codebase and needs correctness guarantees, not style debates.

- **Decision**: Adopt `oxlint` for CI lint. Configure it via `.oxlintrc.json` with the `correctness` category as error and the rest allowed. Style formatting is left to manual conventions.

- **Consequences**:
  - Lint runs in CI under a separate job so it doesn't block other jobs.
  - Only correctness failures block merges; suspicious/style warnings are noise we don't have time to debate today.
  - When we need formatting, we'll reach for `biome` (single binary, formatter + lint) — not ESLint + Prettier.
  - The repo can add ESLint for a small set of rules if a specific class of bug emerges that oxlint doesn't catch.