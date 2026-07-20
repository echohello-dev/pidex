# Architecture Decision Records

ADRs document significant architectural choices made in pidex.

Each ADR follows this shape:

- **Status** — Accepted / Superseded / Deprecated
- **Context** — What problem we faced and the options we considered
- **Decision** — What we chose
- **Consequences** — Trade-offs, costs, and follow-up work

## Index

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-markdown-it-for-transcript.md) | Use markdown-it for transcript rendering | Accepted |
| [0002](0002-pierre-diffs-renderer.md) | Adopt @pierre/diffs as the diff renderer | Accepted |
| [0003](0003-pretext-measurement.md) | Use @chenglou/pretext for text measurement only | Accepted |
| [0004](0004-three-lane-testing.md) | Three-lane testing with Vitest and Playwright | Accepted |
| [0005](0005-oxlint.md) | Use oxlint as the lint tool | Accepted |
| [0006](0006-pi-runtime-rpc.md) | Pi runtime integration via JSONL RPC | Accepted |
| [0007](0007-native-tab-bar.md) | Native tab bar with hidden-inset title bar | Accepted |
| [0008](0008-pi-dev-design-system.md) | Adopt pi.dev design system for visual language | Accepted |
| [0009](0009-calver-releases.md) | Calendar-versioned releases via GitHub Actions | Accepted |