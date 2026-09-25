# Distribution

pidex ships from GitHub Releases on every push to `main`. Tags stay CalVer (`YYYY.0M.0D`, see [ADR 0009](adr/0009-calver-releases.md)). The packager matrix and public channels are [ADR 0010](adr/0010-distribution-channels.md).

Builds are unsigned. First launch on macOS needs right-click → Open. Windows SmartScreen may ask you to keep the file.

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

## Signing (not wired yet)

| Secret | Effect |
|---|---|
| `CSC_LINK` + `CSC_KEY_PASSWORD` | electron-builder signs macOS / Windows when present |
| Apple notarization keys | Required before Gatekeeper stops warning |
| `WINGET_TOKEN` | Would let CI open the `winget-pkgs` PR |
| `TAP_TOKEN` | PAT with `repo` on `echohello-dev/homebrew-tap`; pidex dispatches `pidex-release` so the tap syncs immediately instead of waiting for the hourly cron |

Leave them unset and the workflow publishes unsigned artefacts on purpose.
