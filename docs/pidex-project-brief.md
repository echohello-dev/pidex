# pidex Project Brief

> Product direction and original motivation. For implemented behavior, see the [README](../README.md) and [architecture](pidex-architecture.md). Session trees, context migration, task integrations, and multi-root orchestration remain future work.

## What is pidex

pidex is an Electron desktop app that wraps the [Pi coding agent runtime](https://pi.dev/) and gives developers a daily workbench. It is not a commercial product or a clone of OpenCode. It is a personal project — learn by building, improve day-to-day DX, and share a stronger local-first desktop harness pattern for coding agents.

pidex is one half of a two-product split:

| Product | Role |
|---|---|
| **pidex** | Daily-use coding workbench centred on the Pi runtime |
| **Weldable** | Installer, launcher, updater, and provider/gateway config utility |

Weldable handles install, BYOK, provider bootstrap, SSO, and enterprise gateway wiring. This is the intended product split. The current pidex release works with a separately installed Pi CLI and its provider configuration; Weldable is not required to run it.

## The Mental Model

The desired experience is a **developer's kitchen bench**, not a chat pane:

- Multiple active repos in one place
- Visible stale work — what changed, what's blocked, what's done
- Strong repo and branch awareness
- No need to open old chat transcripts to remember what happened
- Few clicks, fast switching, high awareness

At a glance, the screen should answer:

- What is active right now
- What is stale
- What changed recently
- What is done
- What is blocked
- Which branch or worktree owns each session

## Why This Exists

These are the concrete workflow problems driving the idea, all observed while using OpenCode daily:

| Pain point | Description |
|---|---|
| Workspace switching | Jumping between workspaces requires too many clicks; multiple open workspaces are not in one obvious place |
| Losing the thread | Easy to get lost in latest messages; no clear awareness of repo, branch, or current state when resuming |
| Diff performance | File diffs are sluggish; diff list just throws filenames with low-signal presentation |
| Long-session lag | Chat, files, and diffs slow down after long sessions — multi-second delays break flow |
| Worktree UX | Worktrees feel unreliable; branch management requires chatting to the agent; hit rate is poor |
| Model/provider config | Editing providers or adding custom models needs raw JSON config hacking; no model auto-discovery |

## Core Design Principles

1. **Workspace-first, not chat-first**
   The primary screen is work state, not the latest conversation thread.

2. **Fast by default**
   Diffs, chat switching, file browsing, and worktree navigation should feel instant — compounded delays create real cognitive drag.

3. **Repo-aware**
   Git repo, branch, latest commit, dirty state, worktree, and PR context are first-class concepts.

4. **Work-aware**
   Jira, boards, or task state visible where relevant — not a demo integration, but part of understanding what the session is for.

5. **Local and extensible**
   Pi's minimal runtime philosophy stays intact. Richer UI and orchestration layered on top without bloating the engine.

## What pidex is NOT

- **Not a multi-runtime orchestrator.** It is Pi-first, with adapters for Claude Code or Codex possible later as optional extensions.
- **Not a bundler or installer.** That role belongs to Weldable.
- **Not a general purpose AI chat app.** It builds specifically on Pi’s tool set and session model.

## Key Architecture Choices

### Electron

- **Main process** owns lifecycle, Pi runtime, workspace registry, persistence, and IPC routing
- **Renderer** owns presentation only — React UI, virtualized lists, and text measurement via Pretext
- **Preload** exposes a typed `window.pidex` API as a narrow bridge between processes
- Main forwards Pi RPC events over IPC; the renderer reduces them into UI transcript entries

### Pi Runtime Integration

The implemented runtime uses one supervised `pi --mode rpc` subprocess per active session. Electron main owns the process; the renderer receives events through `window.pidex`. See [ADR 0006](adr/0006-pi-runtime-rpc.md).

### Pretext for Rendering Performance

[Pretext](https://github.com/chenglou/pretext) is a ~15KB TypeScript library by Cheng Lou (ex-Meta React Core, now Midjourney) that measures multiline text dimensions without touching the DOM. Its DOM-free estimates help size rows before they mount; pidex-specific measurements are recorded in ADR 0011. See the [Pretext deep-dive](./pidex-pretext-deep-dive.md) for details.

In pidex, Pretext is:

- Applied to the virtualized active-session and history transcripts; other lists remain separate work
- Used for cached transcript row-height estimates; ResizeObserver measures rendered rows
- Treated as a tool for layout dispatch, not business logic

### Harnss as UX Reference

[Harnss](https://github.com/OpenSource03/harnss) is an Electron wrapper for Claude Code and Codex that renders agent output as interactive cards. It is the strongest design reference for how pidex should present agent activity — rich tool cards, multi-session awareness, with explicit repo and task context surfacing.

### Tooling

- **mise** — task runner and version manager for Node and Bun. All dev/build commands go through `mise run`.
- **Bun** — package manager and runtime.
- **Vite** — renderer bundler with HMR in dev.
- **TypeScript** — `tsc` compiles main and preload; Vite handles renderer via esbuild.

See the [README](../README.md) for setup instructions.

## Competition and Positioning

Tools overlapping with the space:

| Tool | Strength | How pidex relates |
|---|---|---|
| OpenCode | Breadth, adoption, IDE integration | Source of the pain points; baseline to surpass in UX quality |
| Harnss | Multi-agent desktop harness | Strong UI reference; pidex aims for stronger workspace visibility and context recovery |
| CodePilot | Provider switching, general desktop UX | Reference for provider management |
| CC Switch | Config management | Weldable’s domain, not pidex’s |
| 1Code | Worktree isolation, kanban-style thinking | Reference for operational workbench |
| Superset | multi-agent orchestration, worktrees | Reference for heavy parallel worktree workflows |

pidex does NOT need to compete across every axis. The distinctiveness is:

1. OpenCode's breadth without its friction points
2. Superset-level worktree awareness without swarm-first complexity
3. Harnss-level rich tool rendering with stronger context recovery
4. CC Switch-level provider ergonomics built directly into the workbench
5. A faster renderer path (via Pretext) targeting long-session and diff-heavy workflows

## First MVP Slice

1. **Workspace dashboard** — repo state, freshness indicators, active sessions
2. **Streaming agent transcript** — token-by-token text with tool-call cards
3. **Diff viewer** — virtualised summaries with file-level change previews
4. **Session resume and fork** — pick up where you left off, branch sessions visually
5. **Pretext-backed measurement** — for long session lists and diff panes

The MVP should answer one question: **can this workbench feel meaningfully better than OpenCode for workspace switching, repo awareness, and long-session responsiveness?**

Desktop installers now ship through GitHub Releases. The goal remains to validate the workflow, improve the desktop harness, and share the pattern.

## Open questions

- What is the smallest useful workspace dashboard for the first release?
- How much git/worktree state should be cached locally versus derived live?
- Which panes need Pretext first? Sessions, diffs, or workspace lists?
- At what session size do we need compaction or pruning — and how should the UI surface that signal?