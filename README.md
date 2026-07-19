# OpenPi

OpenPi is an Electron desktop workbench for the Pi coding agent runtime.

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) — tool version manager and task runner

### Install

```sh
mise install          # installs Node 22 and Bun
bun install           # installs project dependencies
```

### Development

```sh
mise run dev          # starts Vite dev server + Electron
```

### Build

```sh
mise run build        # compiles main/preload + bundles renderer
```

### Run production build

```sh
mise run start        # runs the built app
```

## Project Structure

- `src/main/` — Electron main process (lifecycle, workspace registry, Pi runtime)
- `src/preload/` — Typed IPC bridge (`window.openpi`)
- `src/renderer/` — React UI (workspace dashboard, session timeline, diffs)
- `docs/` — Project planning docs (brief, architecture, Pretext deep-dive)

## Stack

- Electron 41, React 19.2, Vite 8, TypeScript 6
- Bun as package manager
- `@chenglou/pretext` for DOM-free text measurement
- mise for tool management and task running

## Releasing

Pushes to `main` tag a calendar-versioned GitHub release (`YYYY.0M.0D`, with a `-N` suffix for same-day re-releases). Release notes are generated from merged PRs.
