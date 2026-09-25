/**
 * Map CalVer release tags onto packager / store versions and write
 * Homebrew, Winget, and Scoop manifests for a published GitHub release.
 */

export type ReleaseVersions = {
  tag: string;
  semver: string;
  winget: string;
};

export type ReleaseChecksums = {
  'pidex-mac-arm64.dmg'?: string;
  'pidex-mac-x64.dmg'?: string;
  'pidex-win-x64.exe'?: string;
  'pidex-linux-x64.AppImage'?: string;
};

const CALVER = /^(\d{4})\.(\d{2})\.(\d{2})(?:-(\d+))?$/;
const REPO = 'https://github.com/echohello-dev/pidex';
const DOWNLOAD = `${REPO}/releases/download`;

export function versionsFromCalver(tag: string): ReleaseVersions {
  const match = tag.match(CALVER);
  if (!match) {
    throw new Error(`invalid calver tag: ${tag}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const suffix = match[4];
  const base = `${year}.${month}.${day}`;
  return {
    tag,
    semver: suffix ? `${base}-${suffix}` : base,
    winget: suffix ? `${base}.${suffix}` : base,
  };
}

function requireSha(checksums: ReleaseChecksums, name: keyof ReleaseChecksums): string {
  const sha = checksums[name];
  if (!sha) {
    throw new Error(`missing checksum for ${name}`);
  }
  return sha.toLowerCase();
}

export function homebrewCask(tag: string, checksums: ReleaseChecksums): string {
  versionsFromCalver(tag);
  const arm = requireSha(checksums, 'pidex-mac-arm64.dmg');
  const intel = requireSha(checksums, 'pidex-mac-x64.dmg');
  return `cask "pidex" do
  arch arm: "arm64", intel: "x64"

  version "${tag}"
  sha256 arm:   "${arm}",
         intel: "${intel}"

  url "${DOWNLOAD}/#{version}/pidex-mac-\#{arch}.dmg"
  name "pidex"
  desc "Desktop workbench for the Pi coding agent"
  homepage "${REPO}"

  depends_on macos: :sonoma

  app "pidex.app"

  zap trash: [
    "~/Library/Application Support/pidex",
    "~/Library/Preferences/dev.echohello.pidex.plist",
    "~/Library/Saved Application State/dev.echohello.pidex.savedState",
  ]
end
`;
}

export function wingetSingleton(tag: string, checksums: ReleaseChecksums): string {
  const versions = versionsFromCalver(tag);
  const sha = requireSha(checksums, 'pidex-win-x64.exe');
  return `# yaml-language-server: $schema=https://aka.ms/winget-manifest.singleton.1.9.0.schema.json
PackageIdentifier: echoHello.Pidex
PackageVersion: ${versions.winget}
PackageLocale: en-US
Publisher: echoHello
PublisherUrl: https://github.com/echohello-dev
PublisherSupportUrl: ${REPO}/issues
PackageName: pidex
PackageUrl: ${REPO}
License: Apache-2.0
LicenseUrl: ${REPO}/blob/main/LICENSE
ShortDescription: Desktop workbench for the Pi coding agent
Moniker: pidex
Tags:
  - electron
  - pi
  - coding-agent
ReleaseNotesUrl: ${REPO}/releases/tag/${tag}
Installers:
  - Architecture: x64
    InstallerType: nullsoft
    InstallerUrl: ${DOWNLOAD}/${tag}/pidex-win-x64.exe
    InstallerSha256: ${sha.toUpperCase()}
    Scope: user
ManifestType: singleton
ManifestVersion: 1.9.0
`;
}

export function scoopManifest(tag: string, checksums: ReleaseChecksums): string {
  versionsFromCalver(tag);
  const sha = requireSha(checksums, 'pidex-win-x64.exe');
  return `${JSON.stringify(
    {
      version: tag,
      description: 'Desktop workbench for the Pi coding agent',
      homepage: REPO,
      license: 'Apache-2.0',
      architecture: {
        '64bit': {
          url: `${DOWNLOAD}/${tag}/pidex-win-x64.exe`,
          hash: sha,
        },
      },
      bin: 'pidex.exe',
      checkver: {
        github: REPO,
      },
      autoupdate: {
        architecture: {
          '64bit': {
            url: `${DOWNLOAD}/$version/pidex-win-x64.exe`,
          },
        },
      },
    },
    null,
    2,
  )}\n`;
}

export function latestHomebrewCask(): string {
  return `cask "pidex" do
  arch arm: "arm64", intel: "x64"

  version :latest
  sha256 :no_check

  url "${REPO}/releases/latest/download/pidex-mac-\#{arch}.dmg"
  name "pidex"
  desc "Desktop workbench for the Pi coding agent"
  homepage "${REPO}"

  depends_on macos: :sonoma

  app "pidex.app"

  zap trash: [
    "~/Library/Application Support/pidex",
    "~/Library/Preferences/dev.echohello.pidex.plist",
    "~/Library/Saved Application State/dev.echohello.pidex.savedState",
  ]
end
`;
}

