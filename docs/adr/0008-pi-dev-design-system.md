# ADR 0008 — Adopt pi.dev design system for visual language

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench is a desktop wrapper around the Pi coding agent. The Pi product (pi.dev) has its own distinctive visual language: deep ink canvas `#0d1116`, moonstone text, tidal-blue accent, terracotta rust, Departure Mono labels, Commit Mono code, bracketed buttons `[ ACTION ]`, corner-bracketed figure frames, lowercase `›` and `$` shell prompts. Building a separate design system would feel disjointed.

- **Decision**: Mirror the pi.dev design system in OpenPi. Bundle `Commit Mono` (OFL) and `Departure Mono` (OFL) locally; fall back to system serifs/mono for the licensed Plantin MT Pro. Tokens live in `src/renderer/design-system/tokens.css` and components in `components.css`.

- **Consequences**:
  - Screenshots from OpenPi feel like native Pi product surfaces.
  - Designers familiar with Pi can transfer work without re-learning a design system.
  - Token names match Pi's published names (`--bg-deep`, `--accent`, `--panel`) — easy to grep and update.
  - Local font assets ship ~850KB; acceptable for desktop.
  - No licensing risk (both bundled fonts are OFL; Plantin fallback uses system Georgia).