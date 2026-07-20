<div align="center">

<img src="docs/assets/banner.png" alt="pidex, a desktop workbench for the Pi coding agent" width="100%">

**A desktop workbench for the Pi coding agent.**
**Workspace-first, not chat-first.**

[Quick Start](#quick-start) · [Architecture](docs/pidex-architecture.md) · [Design tokens](#design-tokens) · [Docs](docs/pidex-project-brief.md)

[![CI](https://github.com/echohello-dev/pidex/actions/workflows/ci.yml/badge.svg)](https://github.com/echohello-dev/pidex/actions/workflows/ci.yml)
[![Electron 41](https://img.shields.io/badge/electron-41-blue)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/react-19-blue)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/typescript-6-blue)](https://www.typescriptlang.org/)

</div>

## Why this exists

Daily coding-agent work means juggling repos, branches, and sessions, and the current tools are chat-first. pidex is the kitchen bench: every active repo, its branch, its sessions, and what's stale, visible in one glance.

## Quick Start

You need [mise](https://mise.jdx.dev/) and the [Pi CLI](https://pi.dev/). The dashboard reads existing sessions from `~/.pi/agent/sessions`.

```bash
$ git clone git@github.com:echohello-dev/pidex.git && cd pidex
$ mise install
$ bun install
$ mise run dev          # starts Vite + Electron
```

For a production build: `mise run build` then `mise run start`.

## Architecture

```
┌────────────────────────────────────────┐
│  Renderer (React 19)                   │   ← dashboard, session tabs, timeline
└───────────────────┬────────────────────┘
                    │  typed IPC (window.pidex)
┌───────────────────▼────────────────────┐
│  Main process (Electron)               │   ← workspace registry, event normalization
└───────────────────┬────────────────────┘
                    │  NDJSON over stdio
┌───────────────────▼────────────────────┐
│  Pi runtime (`pi --mode rpc`)          │   ← one supervised subprocess per session
└────────────────────────────────────────┘
```

Pi runs out-of-process over RPC so the UI survives a runtime crash. Pretext handles text measurement so virtualized lists stay smooth in long sessions. Full detail in [docs/pidex-architecture.md](docs/pidex-architecture.md).

## Built on

| Layer | Choice |
|---|---|
| Shell | Electron 41, context-isolated, typed `window.pidex` preload bridge |
| UI | React 19.2, Vite 8 with HMR |
| Text | [`@chenglou/pretext`](https://github.com/chenglou/pretext), DOM-free |
| Language | TypeScript 6 |
| Package manager | Bun |
| Toolchain | mise, all commands via `mise run` |

## Design tokens

The workbench inherits its palette from the [Pi coding agent](https://pi.dev) so it feels like part of the same family as the runtime. Source of truth: [`scripts/_design.py`](scripts/_design.py), hexes pulled from `pi.dev/style.css`.

| Token | Hex | Role |
|---|---|---|
| bg-deep | `#0d1116` | Window background |
| bg-canvas | `#161d27` | Canvas surface |
| panel | `#212730` | Sidebar / panel |
| panel-soft | `#252f3d` | Card surface |
| parchment | `#dacbc2` | Named cream, primary mark and text |
| moonstone | `#ebe7e4` | Lighter cream |
| driftwood | `#5c5752` | Warm mid-gray |
| terracotta | `#844f3b` | Warm bronze accent |
| terracotta-light | `#b86b52` | Status dots |
| sunkissed | `#e1b06e` | Warm gold |
| sage | `#a3a473` | Sage accent |
| accent-blue | `#6a9fcc` | Links, focus |

Regenerate assets after a token edit:

```bash
uv run --with fonttools python scripts/build-icon.py        # assets/icon, mark
uv run --with fonttools python scripts/build-screenshot.py   # docs/assets/screenshot
```

## What's next

- [ ] Diff viewer with virtualised summaries
- [ ] Session fork, branch sessions visually
- [ ] Worktree switching from the UI

## Documentation

| Doc | What it covers |
|---|---|
| [docs/pidex-project-brief.md](docs/pidex-project-brief.md) | Thesis, pain points, positioning, MVP slice |
| [docs/pidex-architecture.md](docs/pidex-architecture.md) | Process boundaries, IPC schema, SDK vs RPC |
| [docs/pidex-pretext-deep-dive.md](docs/pidex-pretext-deep-dive.md) | Why DOM-free text measurement |

## License

[MIT](./LICENSE) — see the file for full text. Personal project, shared in the open.