<div align="center">

<img src="docs/assets/banner.png" alt="pidex, a desktop workbench for the Pi coding agent" width="100%">

**A desktop workbench for the Pi coding agent.**
**Workspace-first, not chat-first.**

[Quick Start](#quick-start) · [Architecture](docs/pidex-architecture.md)

[![CI](https://github.com/echohello-dev/pidex/actions/workflows/ci.yml/badge.svg)](https://github.com/echohello-dev/pidex/actions/workflows/ci.yml)
[![Electron 41](https://img.shields.io/badge/electron-41-blue)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/react-19-blue)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/typescript-6-blue)](https://www.typescriptlang.org/)

</div>

## Why this exists

Daily coding-agent work means juggling repos, branches, and sessions, and the current tools are chat-first. pidex is the kitchen bench: every active repo, its branch, its sessions, and what's stale, visible in one glance.

## In action

| | |
|---|---|
| ![Boot](docs/assets/workbench-boot.gif) | ![Loaded](docs/assets/workbench-loaded.gif) |
| App booting, workspaces populate | The workbench, fully loaded |

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

## License

[MIT](./LICENSE): see the file for full text. Personal project, shared in the open.

## Star History

<a href="https://star-history.com/#echohello-dev/pidex&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=echohello-dev/pidex&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=echohello-dev/pidex&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=echohello-dev/pidex&type=Date" />
  </picture>
</a>