# README media

The overview uses a two-column Markdown screenshot table, with full-size links and a short caption for each view. A single GIF shows the Git review → stage → unstage interaction. Static screens stay as PNGs so text is readable without waiting for a loop.

## Capture

Install the pinned toolchain and dependencies, plus `ffmpeg`. On Linux, run with an X display available. Then:

```bash
mise run docs:media
```

The task bundles the app and runs `scripts/capture-workbench.mjs`. It launches real Electron against an isolated renderer server, creates a temporary Git repository and Pi archive, and uses the deterministic RPC fixture. No provider credentials or real user sessions are needed.

The script captures new-session, active-session, history, and changes views at 1280 × 800. It records PNG frames while clicking Stage file and Unstage file, checks the actual Git index after each action, and encodes a looping GIF at 1120 pixels wide. Captures are copied into `docs/assets/` only after the interactions succeed. Temporary files and processes are cleaned up.

Review both the stills and the GIF before committing. Keep the GIF focused on the changing state; use a screenshot for everything that can be understood in one frame. The long-transcript capture remains part of `mise run test:e2e`, under `test-results/long-session/`.

## Diff verification

`tests/e2e/diff.test.ts` checks the actual rendered text inside the diff viewer, including its shadow DOM. It covers the first opened patch, separate staged and working-copy content, paths containing spaces, stage/unstage selection, additions, deletions, empty and binary files, and distant hunks in a long file. Mounting a `diffs-container` alone is not treated as proof that a patch rendered.

## References

- [Nuclear](https://github.com/nukeop/nuclear/blob/master/README.md): paired screenshot cells and short captions.
- [Tabby](https://github.com/TabbyML/tabby/blob/main/README.md): a focused animated demonstration alongside static documentation.
- [Harnss](https://github.com/OpenSource03/harnss/blob/master/README.md): feature-specific captures and captions for a desktop coding workbench.

These informed the presentation. pidex media is captured from its own app; no third-party screenshots or recordings are reused.
