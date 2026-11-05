# ADR 0012 — Release Please with a CalVer adapter

- **Status**: Accepted (2026-11-05); supersedes [0009](0009-calver-releases.md).
- **Context**: Publishing every push makes it difficult to collect changes into a reviewed release. We want Release Please PRs, changelogs, and version updates while keeping existing CalVer tags, signing, and distribution channels. Release Please's built-in versioning is SemVer; its stock Action does not expose custom strategy registration.
- **Decision**: Run the pinned upstream `release-please` library through a repository composite Action. Use its public `registerReleaseType` extension point to extend the Node strategy with padded CalVer tag rendering. Supply the next UTC date as `release-as`. Keep normal Node version updates and the manifest in unpadded, SemVer-compatible form. Reserve same-day revisions from the current manifest and Git tags. Use Release Please's draft and force-tag options, then run packaging and publication in the same workflow so `GITHUB_TOKEN` does not need to trigger a second release workflow.
- **Consequences**:
  - Ordinary pushes update one release PR. Merging that PR starts publication; it retains the version reviewers approved, even if merged on a later date.
  - Public tags remain `YYYY.0M.0D[-N]`. Installers use `YYYY.M.D[-N]` and Winget uses `YYYY.M.D[.N]`.
  - A draft is tagged to the merged release PR commit before packaging. Every downstream checkout uses that commit, including recovery runs.
  - GitHub releases stay draft until installers, Docker, checksums, and store manifests succeed. Manual recovery can resume an existing draft without computing a new version.
  - The default token requires the repository setting allowing Actions PRs. CI and Electron checks are explicitly dispatched for bot-created PRs; an optional App/PAT token can trigger them through normal PR events.
  - Release Please is isolated from app dependencies and pinned with an npm lockfile. The adapter has tests against its real PR, package updater, changelog, and draft-release APIs; upgrades must keep those tests passing.
