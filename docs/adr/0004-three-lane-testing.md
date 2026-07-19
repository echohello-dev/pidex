# ADR 0004 — Three-lane testing with Vitest and Playwright

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench has multiple execution surfaces — pure TS reducers (timeline), React components (markdown rendering, diff probe), and a live Electron process (spawning `pi` over RPC). A single test lane cannot cover all three cost-effectively: pure unit tests don't catch DOM regressions, DOM tests don't catch RPC contract drift, and Playwright-only is too slow for tight feedback. The previous PRs shipped code without tests; this ADR sets the lane model.

- **Decision**: Three lanes under Vitest projects plus a Playwright Electron runner:
  - **Unit** — Node environment, covers pure functions (`timeline.ts` reducer, `sessions.ts` parser). Fast, deterministic, runs in CI on every PR.
  - **Integration** — jsdom environment with React Testing Library, covers component output (`Markdown.tsx` rendering, escaping, lists, tables). Runs in CI on every PR.
  - **E2E** — Node environment with Playwright Electron, drives the full app against a real `pi` subprocess. Runs on `macos-latest` runners only (Electron binary shape) and is manual (`workflow_dispatch`) because the `pi` runtime requires user OAuth.

- **Consequences**:
  - PR feedback loop is fast (unit + integration complete in seconds).
  - E2E is gated to manual trigger and macos to avoid flaky CI runs.
  - Tests live under `tests/{unit,integration,e2e}/`; config files in `vitest.{unit,integration,e2e}.config.ts`.
  - Coverage targets left intentionally loose while we stabilise the surface.
  - Future: split E2E into contract tests (mock pi subprocess) plus one full-driver smoke test.