# ADR 0008 — Adopt pi.dev design system for visual language

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench is a desktop wrapper around the Pi coding agent. The Pi product (pi.dev) has its own distinctive visual language: deep ink canvas `#0d1116`, moonstone text, tidal-blue accent, terracotta rust, Departure Mono labels, Commit Mono code, bracketed buttons `[ ACTION ]`, corner-bracketed figure frames, lowercase `›` and `$` shell prompts. Building a separate design system would feel disjointed.

- **Decision**: Mirror the pi.dev design system in pidex. Bundle `Commit Mono` and `Departure Mono` (both OFL) locally. Body text uses `Newsreader` (OFL), not Plantin MT Pro: Plantin cannot be redistributed, and the previous Georgia fallback was a different pairing on every machine. Tokens live in `src/renderer/design-system/tokens.css` and components in `components.css`.

  The pairing is Newsreader for prose, titles, and the wordmark; Commit Mono for code; Departure Mono for labels and meta.

- **Consequences**:
  - Screenshots from pidex feel like native Pi product surfaces.
  - Designers familiar with Pi can transfer work without re-learning a design system.
  - Token names match Pi's published names (`--bg-deep`, `--accent`, `--panel`) — easy to grep and update.
  - Local font assets ship about 1.1MB; acceptable for desktop.
  - No licensing risk. Newsreader, Commit Mono, and Departure Mono are all OFL and ship with the app. Georgia remains the serif fallback if the face has not loaded.