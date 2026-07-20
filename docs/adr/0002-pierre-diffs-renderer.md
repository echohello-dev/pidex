# ADR 0002 — Adopt @pierre/diffs as the diff renderer

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench surfaces code changes from agent runs (file-level diffs from `bash`/`edit`/`write` tools). The change surface needs a renderer that handles large files, performs syntax highlighting consistently with code blocks, and supports future merge-conflict UI. The repo's research note (`2026-06-26 - Spanner Layer - Search, Syntax, Markdown, Diff.md`) ranked candidates: `@pierre/diffs`, `react-diff-viewer`, `react-virtualized-diff`, raw `jsdiff`. Pierre was the recommended primary — same engine used by Claude Code, Codex, Cursor, and OpenChamber — and pairs naturally with `shiki` for syntax highlighting. The earlier "Pidex - Pi Ecosystem Technology Stack Research" note (`2026-05-31`) flagged that `openchamber` already uses `@pierre/diffs 1.1.0-beta.13`.

- **Decision**: Adopt `@pierre/diffs` as the primary diff engine. Wrap its React `<PatchDiff>` component in `<PierreDiff>` to provide a small API (`oldFile`, `newFile`, `filename`) and a unified-patch generator. Use `theme: 'pierre-dark'` to match the pidex palette.

- **Consequences**:
  - Diff renderer scales to 10k+ lines via per-line virtualisation in Shadow DOM.
  - Same engine as OpenChamber / Claude Code / Codex / Cursor — visual parity for shared screenshots.
  - Adds ~1MB of language packs to the bundle; acceptable for an agent workbench, with `chunks larger than 500kB` warning expected until we code-split Shiki languages.
  - Plumbs into future "review session" views where merge-conflict UI will reuse the same renderer.
  - Until file content plumbed from the main process, the renderer ships a `Fig. 02 | Pierre diff probe` sample in the empty state.