# ADR 0006 — Pi runtime integration via JSONL RPC

- **Status**: Accepted (2026-07-19)
- **Context**: pidex is an Electron workbench for the Pi coding agent. Pi supports four runtime modes (`interactive`, `print/JSON`, `RPC`, `SDK`). The renderer needs streaming events and prompt submission. Embedding the SDK in-process bloats the renderer with Node-only dependencies; interactive mode is TUI-only. RPC mode is the documented headless protocol — JSON lines over stdin/stdout, `prompt`/`get_state`/`get_messages`/`get_commands` commands, `agent_start`/`message_update`/`tool_execution_*` events.

- **Decision**: Spawn `pi --mode rpc` from the Electron main process per active session tab. Line-buffer stdout on `\n` only (no `readline` — the protocol forbids U+2028/U+2029 splitting). Forward events to the renderer over `webContents.send`. Re-emit Pi errors as `pidex:session:exit`. Validate `sessionFile` is under `~/.pi/agent/sessions` before resume.

- **Consequences**:
  - Strong process boundary; renderer never sees Node APIs beyond the typed bridge.
  - One Pi subprocess per session tab keeps event routing simple.
  - Sessions killed on tab close, on app quit, on window-all-closed.
  - The renderer is fully testable without Pi: `applyEvent` is a pure reducer over RPC events.
  - Future: a single RPC supervisor for many concurrent sessions is possible (`new_session` rather than respawn); we haven't needed it.