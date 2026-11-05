# Distribution

pidex ships from GitHub Releases when a Release Please PR is merged. Tags stay CalVer (`YYYY.0M.0D`, with `-N` for same-day releases). [ADR 0012](adr/0012-release-please-calver.md) describes the adapter. The packager matrix and public channels are [ADR 0010](adr/0010-distribution-channels.md).

Signing is conditional on the release workflow configuration. Builds without Developer ID or Authenticode secrets are published unsigned. For an unsigned build, macOS may require right-click → Open, and Windows SmartScreen may ask you to keep the file. See [Signing](#signing) for the supported configuration.

## Release workflow

1. Merge work into `main` with Conventional Commit titles (`feat:`, `fix:`, `docs:`, `ci:`, and so on). The release workflow opens or updates a Release Please PR containing `CHANGELOG.md`, `package.json`, and `.release-please-manifest.json`.
2. Review that PR and its CI / Electron checks, then merge it when ready to release. Ordinary pushes no longer publish installers.
3. Release Please creates a draft and tags the merged PR commit. The existing matrix builds Windows, macOS, and Linux packages from that exact commit, then publishes Docker, checksums, and store manifests. The release becomes public only after all jobs pass.

The repository's [Release Please action](../.github/actions/release-please/action.yml) wraps the pinned upstream `release-please` library. The stock `googleapis/release-please-action` does not expose custom strategy registration. Our adapter uses Release Please's extension API to retain padded Git tags and sets its supported `release-as` override to the next UTC date version. Changelog comparison links use the same padded tags.

The version is the UTC date of the release PR's most recent update, with `-2`, `-3`, and so on if that date is already reserved by a tag or the version manifest. Merging later preserves the reviewed version; dispatch the release workflow with no inputs before merging if you want to refresh a pending PR's date. Installer versions remain unpadded (`2026.11.5-2`), while the public Git tag is `2026.11.05-2`. Same-day suffixes remain stable GitHub releases, not prereleases. The bootstrap manifest starts at the existing `2026.11.04-2` release.

Enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** for the default `GITHUB_TOKEN`. Bot-created PR events do not start workflows, so the adapter explicitly dispatches `ci.yml` and `e2e.yml` on the release PR branch. Alternatively, provide `RELEASE_PLEASE_TOKEN` from a GitHub App or PAT with repository contents, issues, and pull-request write access; its PR events trigger checks normally. No new token is required for the default setup.

If packaging fails, use **Re-run failed jobs** on the original run. To resume a draft from a new run, dispatch `release.yml` on `main` with `release_tag` set to the existing padded tag. Recovery refuses published releases and builds the tagged commit rather than current `main`. Release runs are serialized to prevent duplicate draft creation. An empty dispatch manages the pending release PR and does not force a new release.

Test the adapter independently of Electron:

```bash
$ npm ci --ignore-scripts --prefix .github/actions/release-please
$ npm test --prefix .github/actions/release-please
```

For a read-only API preview, with `GH_TOKEN` set and all tags fetched:

```bash
$ GITHUB_REPOSITORY=echohello-dev/pidex node .github/actions/release-please/index.mjs --dry-run
```

The dry run reads the release config from the remote target branch (`main` by default; override with `TARGET_BRANCH`). It builds candidate PRs and releases without changing GitHub.

## GitHub Releases

Stable artefact names, so `releases/latest/download/<file>` always points at the current build.

| File | Platform |
|---|---|
| `pidex-mac-arm64.dmg` | macOS Apple silicon |
| `pidex-mac-x64.dmg` | macOS Intel |
| `pidex-win-x64.exe` | Windows NSIS installer |
| `pidex-win-x64-portable.exe` | Windows portable |
| `pidex-linux-x86_64.AppImage` | Linux AppImage |
| `pidex-linux-amd64.deb` | Debian / Ubuntu |
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
