# ADR 0001 — Use markdown-it for transcript rendering

- **Status**: Accepted (2026-07-19)
- **Context**: The Pi coding agent streams structured markdown to the renderer (assistant text, code blocks, lists, tables, blockquotes). The renderer needs a CommonMark-compliant parser that is safe by default and supports the streaming update pattern (re-parse on every token delta). Candidate libraries were `marked`, `remark`, `markdown-it`, and `micromark`. The previous decision point in this repo's research notes (`2026-06-26 - Spanner Layer - Search, Syntax, Markdown, Diff.md`) ruled out `marked` because it is unsafe by default and requires an additional sanitiser. We had been using `marked` plus `DOMPurify` as a workaround; the sanitiser is dead weight if the parser is safe by default.

- **Decision**: Switch the transcript renderer to `markdown-it` with `html: false`, `breaks: true`, `linkify: true`, `typographer: true`. Drop `DOMPurify` entirely.

- **Consequences**:
  - No DOMPurify dependency, smaller bundle and surface area.
  - Safe by default against HTML/script injection from agent output.
  - Token-stream architecture re-parses cleanly on streaming deltas (each delta re-validates).
  - Performance is ~8ms on 10k words vs `marked`'s ~3ms; negligible at transcript sizes.
  - Plugins available for tables, footnotes, task lists, math later if needed.
  - If math/MDX becomes a requirement, the path forward is `remark` + `rehype-sanitize`, not back to `marked`.