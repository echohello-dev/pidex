# ADR 0007 — Native tab bar with hidden-inset title bar

- **Status**: Accepted (2026-07-19)
- **Context**: The workbench has a workspace/session model with multiple open sessions. macOS users expect Chrome-style native tabs (`NSWindow tabbingMode`) OR a custom drag region with native traffic-light controls. The original pidex brief calls for "few clicks, fast switching, high awareness" and a "workspace-first" mental model — both benefit from a tab strip at the top of the window.

- **Decision**: Use `titleBarStyle: 'hiddenInset'` on the `BrowserWindow`. Reserve `84px` of left padding on the renderer tab strip to clear the macOS traffic lights at the inset position. Mark the tab strip with `-webkit-app-region: drag` so the user can drag the window by the strip; mark every interactive child with `no-drag` so buttons remain clickable. Render the tab strip in-app with custom styles.

- **Consequences**:
  - Native window controls without losing the dark app background under them.
  - User drags the window by the tab strip area.
  - Avoids native NSWindow tab bar (which would push our renderer design into macOS chrome conventions).
  - Windows/Linux: the inset still works but traffic-light buttons don't render — the strip just feels like a normal toolbar.
  - Pair with custom buttons always inside `no-drag` regions, never the strip itself.