import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { GitHub, Manifest } from 'release-please';
import { calverTag, nextCalver, Version } from './adapter.mjs';

const dryRun = process.argv.includes('--dry-run');
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const branch = process.env.TARGET_BRANCH || 'main';
const github = await GitHub.create({ owner, repo, token: process.env.GH_TOKEN, defaultBranch: branch });
const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split('\n');

function output(release) {
  const values = {
    release_created: Boolean(release),
    tag: release?.tagName || '',
    semver: release?.version || '',
    sha: release?.sha || '',
  };
  console.log(JSON.stringify(values));
  if (process.env.GITHUB_OUTPUT && !dryRun) {
    for (const [key, value] of Object.entries(values)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

// A recovery dispatch reuses a draft and its exact tagged commit. It cannot
// rebuild a published release or silently pick up newer main-branch changes.
if (process.env.RELEASE_TAG) {
  const tag = process.env.RELEASE_TAG;
  if (calverTag(tag) !== tag) throw new Error('Recovery requires a padded CalVer tag');
  const { data: release } = await github.getGitHubApi().octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', { owner, repo, tag });
  if (!release.draft) throw new Error('Recovery only supports draft releases');
  const sha = execFileSync('git', ['rev-parse', `refs/tags/${tag}^{commit}`], { encoding: 'utf8' }).trim();
  execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD']);
  output({ tagName: tag, version: Version.parse(tag).toString(), sha });
} else {
  const current = JSON.parse(readFileSync('.release-please-manifest.json', 'utf8'))['.'];
  const version = nextCalver(current, tags);
  const loadManifest = () => Manifest.fromManifest(
    github, branch, 'release-please-config.json', '.release-please-manifest.json', {}, undefined, version,
  );
  const manifest = await loadManifest();
  if (dryRun) {
    const releases = await manifest.buildReleases();
    const prs = await manifest.buildPullRequests();
    console.log(JSON.stringify({ next_version: version, releases: releases.map(r => ({ tag: r.tag.toString(), sha: r.sha, draft: r.draft })), pull_requests: prs.map(pr => ({ title: pr.title.toString(), body: pr.body.toString(), files: pr.updates.map(u => u.path) })) }, null, 2));
  } else {
    const releases = (await manifest.createReleases()).filter(Boolean);
    if (releases.length > 1) throw new Error('Expected at most one root release');
    output(releases[0]);
    // After a merged release PR, let its draft finish packaging before proposing
    // another version. Ordinary pushes only open or update the pending PR.
    if (!releases.length) {
      const prs = (await manifest.createPullRequests()).filter(Boolean);
      // PR events made with GITHUB_TOKEN do not trigger other workflows.
      // workflow_dispatch is the documented exception and uses the PR branch.
      if (process.env.DISPATCH_CHECKS === 'true') {
        for (const pr of prs) {
          for (const workflow of ['ci.yml', 'e2e.yml']) {
            await github.getGitHubApi().octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
              owner, repo, workflow_id: workflow, ref: pr.headBranchName,
            });
          }
        }
      }
    }
  }
}
