# ADR 0010 — Ship desktop installers and public package channels

- **Status**: Accepted (2026-09-20)
- **Context**: Releases were CalVer tags with generated notes and no artefacts. Users had to clone the repo and run Electron from source. We need first-class desktop packages (macOS DMG, Windows NSIS, Linux AppImage/deb) plus the public channels people actually type (`brew`, `winget`, `docker pull`), without waiting on store review or code-signing certificates.

- **Decision**: Package with electron-builder on a three-runner GitHub Actions matrix and attach stable-named artefacts to the existing CalVer GitHub release. Publish a Linux image to GHCR. Use [echohello-dev/homebrew-tap](https://github.com/echohello-dev/homebrew-tap) as the interim Homebrew tap (`brew tap echohello-dev/tap`), Winget manifest bucket, and Scoop bucket. Attach versioned manifests to each release; the tap copies them on a cron (or immediately when `TAP_TOKEN` is set). Do not submit to homebrew-cask or winget-pkgs from CI until a publisher token and signed builds exist. Do not host a WinGet REST / pre-indexed source: those need a signed MSIX or an Azure REST stack.

- **Consequences**:
  - Every push to `main` now spends matrix minutes building macOS, Windows, and Linux installers. That is the cost of "push and it ships".
  - Artefact names omit the version (`pidex-mac-arm64.dmg`) so `releases/latest/download/...` stays stable.
  - electron-builder wants semver; CalVer tags with leading zeros (`2026.08.09-2`) are mapped to `2026.8.9-2` for the packager and `2026.8.9.2` for Winget.
  - Builds are unsigned. macOS Gatekeeper and Windows SmartScreen will warn until Developer ID / Authenticode certs are added via `CSC_*` secrets.
  - Docker is a Linux/X11 fallback, not the daily-driver install. The app reads `~/.pi/agent/sessions` and expects a local Pi CLI.
  - Official Homebrew and Winget directory listings are manual pull requests against the published installers. The org tap stays the install path until those land.
  - Signing and notarization run in the release workflow when Developer ID and Authenticode secrets are set. Without them the artefacts stay unsigned.
  - A Flatpak manifest lives in `packaging/flatpak/`. Flathub submission is a human pull request. Snap, Chocolatey, and the Mac / Microsoft stores stay out of scope.

- **Follow-ups**:
  - Add `CSC_LINK`, `APPLE_API_*`, and `WIN_CSC_LINK` secrets. An Apple Development certificate cannot notarize.
  - `electron-updater` once macOS builds are signed (Squirrel.Mac refuses unsigned updates).
  - After the first `echoHello.Pidex` Winget manifest is merged, update PRs can use `WINGET_TOKEN`.
