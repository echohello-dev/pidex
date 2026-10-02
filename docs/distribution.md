# Distribution

pidex ships from GitHub Releases on every push to `main`. Tags stay CalVer (`YYYY.0M.0D`, see [ADR 0009](adr/0009-calver-releases.md)). The packager matrix and public channels are [ADR 0010](adr/0010-distribution-channels.md).

Builds are unsigned until Developer ID and Authenticode secrets are set on the repository. Until then, first launch on macOS needs right-click → Open, and Windows SmartScreen may ask you to keep the file.

## GitHub Releases

Stable artefact names, so `releases/latest/download/<file>` always points at the current build.

| File | Platform |
|---|---|
| `pidex-mac-arm64.dmg` | macOS Apple silicon |
| `pidex-mac-x64.dmg` | macOS Intel |
| `pidex-win-x64.exe` | Windows NSIS installer |
| `pidex-win-x64-portable.exe` | Windows portable |
| `pidex-linux-x64.AppImage` | Linux AppImage |
| `pidex-linux-x64.deb` | Debian / Ubuntu |
| `pidex.rb` | Versioned Homebrew cask |
| `echoHello.Pidex.yaml` | Winget singleton manifest |
| `pidex.json` | Scoop manifest |
| `SHA256SUMS.txt` | SHA-256 of the installers |

## echohello-dev tap

Official Homebrew and Winget directories are the follow-up. Until then, [echohello-dev/homebrew-tap](https://github.com/echohello-dev/homebrew-tap) is the package tap. It starts with a `version :latest` cask; after each pidex release a workflow copies the checksummed Homebrew / Winget / Scoop manifests into the tap.

| Client | Command |
|---|---|
| Homebrew | `brew tap echohello-dev/tap && brew install --cask pidex` |
| Winget | `irm https://raw.githubusercontent.com/echohello-dev/homebrew-tap/main/winget/install-pidex.ps1 \| iex` |
| Scoop | `scoop bucket add echohello https://github.com/echohello-dev/homebrew-tap && scoop install pidex` |

WinGet cannot `source add` a GitHub repo. It wants a signed pre-indexed cache or a REST API, so the tap is a manifest bucket plus an install script, not `winget source add`. The first Winget run may need `winget settings --enable LocalManifestFiles` in an elevated shell.

This repo still has `Casks/pidex.rb` (`version :latest`) if you would rather `brew tap echohello-dev/pidex https://github.com/echohello-dev/pidex`. Prefer the org tap.

A PR into `homebrew/homebrew-cask` and `microsoft/winget-pkgs` (`echoHello.Pidex`) is what retires the tap as the primary install path.

## Docker

The image is the unpacked Linux build. It needs an X11 or Wayland socket and your Pi session tree:

```bash
$ docker pull ghcr.io/echohello-dev/pidex:latest
$ docker run --rm \
    -e DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v "$HOME/.pi:/root/.pi" \
    ghcr.io/echohello-dev/pidex:latest
```

Prefer the AppImage or `.deb` on a real Linux desktop. Docker does not replace a local Pi CLI.

## From source

```bash
$ git clone git@github.com:echohello-dev/pidex.git && cd pidex
$ mise install
$ bun install
$ mise run package
```

`mise run package` builds installers for the platform you are on. CI builds all three.

## Signing

The release workflow signs when these repository secrets exist. Empty secrets stay unset, and that platform is published unsigned.

| Secret | Value |
|---|---|
| `CSC_LINK` | Base64 of the Developer ID Application `.p12` |
| `CSC_KEY_PASSWORD` | Password for that `.p12` |
| `APPLE_API_KEY` | Base64 of the App Store Connect API `.p8` |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |
| `APPLE_TEAM_ID` | 10-character Team ID |
| `WIN_CSC_LINK` | Base64 of the Authenticode `.pfx` |
| `WIN_CSC_KEY_PASSWORD` | Password for that `.pfx` |

An Apple Development certificate cannot notarize a public DMG. It has to be a Developer ID Application certificate from the Apple Developer Program. With the four `APPLE_*` secrets set as well, electron-builder notarizes and staples the macOS build. Windows uses `WIN_CSC_*` only, so a Mac `.p12` is not sent to the Windows runner.

```bash
$ base64 -i Certificates.p12 | pbcopy   # store as CSC_LINK
$ base64 -i AuthKey_XXXX.p8 | pbcopy    # store as APPLE_API_KEY
```

| Secret | Effect |
|---|---|
| `WINGET_TOKEN` | Classic PAT (`public_repo`) so a later workflow can open `winget-pkgs` update PRs. The first listing is a manual PR. |
| `TAP_TOKEN` | PAT with `repo` on `echohello-dev/homebrew-tap`. pidex dispatches `pidex-release` so the tap syncs immediately instead of waiting for the hourly cron. |

## Flathub

`packaging/flatpak/` is a Flatpak manifest for `dev.echohello.Pidex`. It wraps the published AppImage and grants `filesystem=home` so `~/.pi` and home-directory workspaces are visible.

Flathub does not accept agent-opened submission pull requests. A person opens that PR against `flathub/flathub` branch `new-pr`. Reviewers also treat host-dependent developer tools as a special case, because pidex shells out to the Pi CLI on the host. The manifest is here so that submission can be made by hand. The AppImage and `.deb` remain the Linux install.
