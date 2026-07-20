# ADR 0009 — Calendar-versioned releases via GitHub Actions

- **Status**: Accepted (2026-07-19)
- **Context**: This is a personal, low-traffic workbench. Semver (X.Y.Z) imposes friction for solo projects where breaking changes are frequent and there's no public API contract. Pi's CLI uses semver; we don't.

- **Decision**: Adopt CalVer (`YYYY.0M.0D`) with a `-N` suffix for same-day re-releases. On push to `main`, the `release.yml` workflow computes the tag (e.g. `2026.07.19`, `2026.07.19-2`) and creates a GitHub release with auto-generated notes.

- **Consequences**:
  - Predictable, sortable, machine-friendly tags.
  - No "is this a breaking change" ceremony — every push to main tags a release.
  - Dropped `release-please` (semver, PR-based) for a small workflow that just calls `gh release create --generate-notes`.
  - Inconsistent with Pi CLI semver — keep documentation clear that pidex tags are CalVer.
  - If we ever publish a public API, we revisit and add semver alongside.