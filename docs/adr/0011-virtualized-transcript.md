# ADR 0011 — Virtualize the session transcript

- **Status**: Accepted (2026-11-04)
- **Context**: Both active sessions and history previews mounted every transcript entry. A local Electron run with 1,500 mixed user/assistant/tool turns mounted 4,500 rows and 39,000 DOM nodes and took about 8.3 seconds to open. The status counter also prepared every message again on each streamed delta, and unconditional scrolling prevented reading older messages during a response.

- **Decision**: Use `@tanstack/react-virtual` for dynamically measured transcript rows. Cache Pretext estimates by immutable entry and viewport width in a WeakMap. Use actual rendered heights for Markdown, code, thinking, and expanded tools. Remeasure on font readiness and width changes. Memoize row rendering; remove the full-transcript status measurement pass. Active sessions open at the end and follow appends and row growth only near the bottom. History previews start at the beginning.

- **Consequences**:
  - The same local fixture opened in about 1.4 seconds with 8–10 mounted rows and fewer than 100 transcript DOM nodes. Revisiting an open session took about 0.9 seconds. These are development-mode observations, not CI timing guarantees; ordinary scrolling was around 60 fps both before and after.
  - Tool and thinking expansion survives row recycling within a mounted transcript. Selected ranges and keyboard-focused rows remain mounted during scrolling. Deliberately selecting a large range can therefore mount many rows.
  - Browser Find and Select All cover mounted text, not the complete archive. Full-session search/export and within-message virtualization remain separate work. Opening a view again starts at its default position; scroll and expansion state are not persisted across view changes.
  - Pretext estimates are approximate for Markdown; ResizeObserver supplies final heights. This extends ADR 0003: the status bar reports entry count instead of measured line count.
  - `tests/e2e/long-session.test.ts` uses a generated archive and the deterministic Pi fixture to check bounded mounting, revisit, streaming follow, scrolling away, selection, focus, expansion, and resize. It records timing/frame observations in `test-results/long-session/metrics.json` and screenshots alongside them. Run with `mise run test:e2e`; Linux requires an X display.
