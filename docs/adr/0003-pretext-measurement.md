# ADR 0003 — Use @chenglou/pretext for text measurement only

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench renders long session timelines (10k+ messages in long sessions). The renderer needs a way to know row heights for the status-bar measurement counter and, eventually, for virtualised row sizing before mounting DOM. `@chenglou/pretext` (Cheng Lou) provides Canvas-2D-based text measurement that is ~300× faster than DOM-based measurement for re-layout. The original OpenPi architecture (`docs/openpi-architecture.md`) called for Pretext specifically as a "layout dispatch" primitive.

- **Decision**: Use `@chenglou/pretext` strictly for text measurement — row counting for the status bar today, and (future) row heights for virtualised lists. Do not use it for glyph rendering; rely on `markdown-it` + browser text layout for that.

- **Consequences**:
  - The status-bar `rows measured` counter is meaningful (it reflects an actual measurement, not a wall-clock approximation).
  - No need to maintain a parallel `getBoundingClientRect` measurement path.
  - When the renderer virtualises the timeline, Pretext's `layoutWithLines` is already wired in and ready.
  - Avoids the canvas-vs-DOM font metrics drift by only measuring, never rendering.