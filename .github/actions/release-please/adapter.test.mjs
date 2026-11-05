import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Manifest, setLogger } from 'release-please';
import { CalverNode, Version, calverTag, nextCalver } from './adapter.mjs';

setLogger({ info() {}, warn() {}, error() {}, debug() {}, trace() {} });

test('UTC rollover advances the date and keeps installer versions unpadded', () => {
  const next = nextCalver('2026.10.31-12', [], new Date('2026-11-01T08:30:00+09:00'));
  assert.equal(next, '2026.10.31-13');
  assert.equal(nextCalver('2026.10.31-12', [], new Date('2026-11-01T09:00:00+09:00')), '2026.11.1');
  assert.equal(calverTag('2026.11.1'), '2026.11.01');
});

test('same-day revisions reserve gaps, current manifest, and both tag formats', () => {
  assert.equal(nextCalver('2026.11.5-2', ['2026.11.05', '2026.11.05-4', '2026.11.5-9', 'v1.0.0'], new Date('2026-11-05T12:00:00Z')), '2026.11.5-10');
  assert.equal(nextCalver('2026.11.5', [], new Date('2026-11-05T12:00:00Z')), '2026.11.5-2');
});

test('month and year boundaries reset the revision', () => {
  assert.equal(nextCalver('2026.12.31-9', ['2026.12.31-9'], new Date('2027-01-01T00:00:00Z')), '2027.1.1');
});

test('invalid dates, prereleases, and clocks behind a release are rejected', () => {
  for (const invalid of ['2026.2.29', '2026.13.1', '2026.0.1', '2026.11.5-1', '2026.11.5-beta', '1.2.3']) {
    assert.throws(() => calverTag(invalid));
  }
  assert.equal(calverTag('2028.2.29-2'), '2028.02.29-2');
  assert.throws(() => nextCalver('2026.11.6', [], new Date('2026-11-05T00:00:00Z')), /newer/);
  assert.throws(() => nextCalver('2026.11.4', ['2026.11.06'], new Date('2026-11-05T00:00:00Z')), /newer/);
});

const github = {
  repository: { owner: 'echohello-dev', repo: 'pidex' },
  async getFileContentsOnBranch(path) {
    assert.equal(path, 'package.json');
    return { parsedContent: '{"name":"pidex","version":"2026.11.4-2"}', sha: 'old-package' };
  },
};

async function releaseFixture() {
  const strategy = new CalverNode({
    github, targetBranch: 'main', releaseAs: '2026.11.5-2',
    includeComponentInTag: false, includeVInTag: false,
  });
  const pr = await strategy.buildReleasePullRequest([
    { sha: 'abc123', message: 'feat!: change the workbench', type: 'feat', scope: '', notes: [{ title: 'BREAKING CHANGE', text: 'new layout' }], references: [], bareMessage: 'change the workbench', files: [] },
  ], { tag: { version: Version.parse('2026.11.4-2') }, sha: 'old-release', notes: '' });
  assert.ok(pr);
  return { strategy, pr, merged: {
    title: pr.title.toString(), body: pr.body.toString(),
    headBranchName: pr.headRefName, baseBranchName: 'main',
    number: 30, labels: ['autorelease: pending'], files: [], sha: 'release-commit',
  } };
}

test('Release Please generates a CalVer PR, real changelog links, and package update', async () => {
  const { pr } = await releaseFixture();
  assert.equal(pr.version.toString(), '2026.11.5-2');
  assert.match(pr.body.toString(), /2026\.11\.04-2\.\.\.2026\.11\.05-2/);
  assert.match(pr.body.toString(), /change the workbench/);
  const packageUpdate = pr.updates.find(u => u.path === 'package.json');
  const updated = JSON.parse(packageUpdate.updater.updateContent('{"name":"pidex","version":"0.0.1"}'));
  assert.equal(updated.version, '2026.11.5-2');
  assert.ok(pr.updates.some(u => u.path === 'CHANGELOG.md'));
});

test('a merged PR releases its reviewed version and commit, with padded tag and install notes', async () => {
  const { strategy, merged } = await releaseFixture();
  const release = await strategy.buildRelease(merged);
  assert.equal(release.tag.toString(), '2026.11.05-2');
  assert.equal(release.name, '2026.11.05-2');
  assert.equal(release.sha, 'release-commit');
  assert.match(release.notes, /pidex-linux-x86_64\.AppImage/);
  assert.match(release.notes, /pidex:2026\.11\.05-2/);
});

test('Release Please keeps same-day builds stable, draft, and tagged before packaging', async () => {
  const { merged } = await releaseFixture();
  const manifest = new Manifest({
    ...github,
    async *pullRequestIterator() { yield merged; },
  }, 'main', {
    '.': { releaseType: 'calver-node', draft: true, forceTag: true, prerelease: false, includeComponentInTag: false, includeVInTag: false },
  }, { '.': Version.parse('2026.11.4-2') });
  const [release] = await manifest.buildReleases();
  assert.equal(release.tag.toString(), '2026.11.05-2');
  assert.equal(release.draft, true);
  assert.equal(release.forceTag, true);
  assert.equal(Boolean(release.prerelease), false);
});

test('ordinary pull requests cannot create releases', async () => {
  const { strategy, merged } = await releaseFixture();
  assert.equal(await strategy.buildRelease({ ...merged, title: 'fix: unrelated change', headBranchName: 'feature' }), undefined);
});

test('checked-in configuration loads through Release Please with the date override', async () => {
  const manifest = await Manifest.fromManifest({
    ...github,
    async getFileJson(path) {
      return JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
    },
  }, 'main', 'release-please-config.json', '.release-please-manifest.json', {}, undefined, '2026.11.5');
  const config = manifest.repositoryConfig['.'];
  assert.equal(config.releaseType, 'calver-node');
  assert.equal(config.releaseAs, '2026.11.5');
  assert.equal(config.forceTag, true);
  assert.equal(config.draft, true);
  assert.equal(config.prerelease, false);
  assert.equal(config.includeVInTag, false);
  assert.equal(manifest.releasedVersions['.'].toString(), '2026.11.4-2');
});
