import { registerReleaseType } from 'release-please';
import { Node } from 'release-please/build/src/strategies/node.js';
import { TagName } from 'release-please/build/src/util/tag-name.js';
import { Version } from 'release-please/build/src/version.js';

// Keep versions in package.json SemVer-compatible; only Git tags are padded.
export function calverTag(version) {
  const match = String(version).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-([2-9]\d*|1\d+))?$/);
  if (!match) throw new Error(`Invalid CalVer version: ${version}`);
  const [, year, month, day, revision] = match;
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid CalVer date: ${version}`);
  }
  return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}${revision ? `-${revision}` : ''}`;
}

export function nextCalver(current, tags, now = new Date()) {
  const today = now.toISOString().slice(0, 10).replaceAll('-', '.');
  const currentTag = calverTag(current);
  // Refuse to move backwards if a runner's clock is behind an existing release.
  if (currentTag.slice(0, 10) > today) throw new Error('Current release is newer than the UTC date');
  const reserved = [currentTag, ...tags];
  let revision = 0;
  for (const tag of reserved) {
    let normalized;
    try { normalized = calverTag(tag); } catch { continue; }
    if (normalized.slice(0, 10) > today) throw new Error('A release tag is newer than the UTC date');
    if (normalized.slice(0, 10) === today) {
      revision = Math.max(revision, Number(normalized.split('-')[1] || 1));
    }
  }
  const [year, month, day] = today.split('.').map(Number);
  return `${year}.${month}.${day}${revision ? `-${revision + 1}` : ''}`;
}

class CalverTag extends TagName {
  constructor(version) { super(version, undefined, '-', false); }
  toString() { return calverTag(this.version.toString()); }
}

export class CalverNode extends Node {
  async buildReleaseNotes(commits, version, _tag, latestRelease, allCommits) {
    return super.buildReleaseNotes(
      commits, version, new CalverTag(version),
      latestRelease ? { ...latestRelease, tag: new CalverTag(latestRelease.tag.version) } : undefined,
      allCommits,
    );
  }

  async buildRelease(pullRequest, options) {
    const release = await super.buildRelease(pullRequest, options);
    if (!release) return undefined;
    const tag = new CalverTag(release.tag.version);
    return { ...release, tag, name: tag.toString(), notes: `${installNotes(tag.toString())}\n\n${release.notes}` };
  }
}

export function installNotes(tag) {
  return `## Install

| Platform | Artefact |
|---|---|
| macOS Apple silicon | \`pidex-mac-arm64.dmg\` |
| macOS Intel | \`pidex-mac-x64.dmg\` |
| Windows | \`pidex-win-x64.exe\` |
| Linux | \`pidex-linux-x86_64.AppImage\` |
| Docker | \`docker pull ghcr.io/echohello-dev/pidex:${tag}\` |

macOS: \`brew tap echohello-dev/tap && brew install --cask pidex\`

Windows: \`irm https://raw.githubusercontent.com/echohello-dev/homebrew-tap/main/winget/install-pidex.ps1 | iex\`

Checksums and Homebrew, Winget, and Scoop manifests are attached below.`;
}

registerReleaseType('calver-node', options => new CalverNode(options));
export { Version };
