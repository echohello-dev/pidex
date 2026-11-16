import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
let app: ElectronApplication;
let page: Page;
let fixture: string;
let project: string;
let clean: string;
let source: string;
let rpcLog: string;
const errors: string[] = [];
const projectSubject = 'Prepare streaming parser for workspace inspection and preserve the selected root while reviewing a long repository commit subject';
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
const status = () => page.getByRole('region', { name: 'Workspace Git status' });
async function capture(name: string) {
  for (const directory of ['.tmp/proof', 'test-results/workspace-status']) {
    await fs.mkdir(path.join(ROOT, directory), { recursive: true });
    await page.screenshot({ scale: 'css', path: path.join(ROOT, directory, name) });
  }
}
async function resizeWindow(width: number, height: number) {
  const window = await app.browserWindow(page);
  await window.evaluate((window, size) => window.setContentSize(size.width, size.height), { width, height });
  const [actualWidth, actualHeight] = await window.evaluate((window) => window.getContentSize());
  await page.waitForFunction(
    ({ width, height }) => innerWidth === width && innerHeight === height,
    { width: actualWidth, height: actualHeight },
  );
}
async function select(name: string) {
  await page.getByLabel('Workspace group').selectOption({ label: name });
  await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
}

describe('workspace status in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-status-')));
    project = path.join(fixture, 'project');
    clean = path.join(fixture, 'clean');
    const plain = path.join(fixture, 'plain');
    const userData = path.join(fixture, 'user-data');
    await Promise.all([project, clean, plain, userData].map((dir) => fs.mkdir(dir)));
    const archives = path.join(fixture, 'sessions/workspace');
    await fs.mkdir(archives, { recursive: true });
    source = path.join(archives, 'source.jsonl');
    rpcLog = path.join(fixture, 'rpc.jsonl');
    const message = (id: string, parentId: string | null, role: string, text: string) => ({
      type: 'message', id, parentId, message: { role, content: [{ type: 'text', text }] },
    });
    await fs.writeFile(source, [
      { type: 'session', version: 3, id: 'source', cwd: project, timestamp: new Date().toISOString() },
      message('task', null, 'user', 'Review saved parser work'),
      message('old-tip', 'task', 'assistant', 'The streaming approach needs review.'),
      message('new-tip', 'task', 'assistant', 'The buffered approach is ready.'),
    ].map((record) => JSON.stringify(record)).join('\n') + '\n');
    for (const cwd of [project, clean]) {
      git(cwd, 'init', '-b', 'main');
      await fs.writeFile(path.join(cwd, 'app.ts'), 'export const value = 1;\n');
      git(cwd, 'add', '.');
      git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', cwd === project ? projectSubject : 'Initial clean workspace');
    }
    git(project, 'switch', '-c', 'feature/workspace-status');
    await fs.writeFile(path.join(project, 'app.ts'), 'export const value = 2;\n');
    git(project, 'add', 'app.ts');
    await fs.writeFile(path.join(project, 'app.ts'), 'export const value = 3;\n');
    await fs.writeFile(path.join(project, 'notes.txt'), 'Review before starting Pi.\n');
    await fs.writeFile(path.join(userData, 'workspaces.json'), JSON.stringify([project, clean, plain, path.join(fixture, 'missing')]));
    app = await electron.launch({
      executablePath: require('electron'), args: ['.'], cwd: ROOT,
      env: {
        ...process.env, NODE_ENV: 'development', PIDEX_E2E_CWD: project,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'), PIDEX_E2E_USER_DATA: userData,
        PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
        PIDEX_RPC_LOG: rpcLog,
      },
    });
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await resizeWindow(1280, 900);
    await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
    await select('project');
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('shows mixed Git changes before starting Pi and opens Changes without losing the task draft', async () => {
    await expect.poll(() => status().textContent()).toContain('2 changed files');
    expect(await status().textContent()).toContain('feature/workspace-status · 1 staged · 1 unstaged · 1 untracked');
    expect(await status().getByLabel('Current repository commit').textContent()).toContain(projectSubject);
    expect(await status().locator('code').textContent()).toBe(git(project, 'rev-parse', 'HEAD').toString().trim().slice(0, 8));
    await page.getByLabel('Message pi').fill('Review the existing changes before editing.');
    await page.evaluate(() => document.fonts.ready);
    await capture('workspace-status.png');
    await resizeWindow(900, 700);
    await status().scrollIntoViewIfNeeded();
    const bounds = await status().boundingBox();
    const button = await status().getByRole('button').boundingBox();
    if (!bounds || !button) throw new Error('Workspace status is not visible.');
    expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    await capture('workspace-status-narrow.png');
    await resizeWindow(1280, 900);
    await status().getByRole('button', { name: 'Review workspace changes' }).click();
    await page.getByRole('heading', { name: 'Changes review', exact: true }).waitFor();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Review the existing changes before editing.');
    await page.getByLabel('Commit message').waitFor();
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Review the existing changes before editing.');
    expect(await page.locator('.wb-sidebar .wb-session-item').filter({ hasText: 'this window' }).count()).toBe(0);
  });

  it('reviews current changes from saved history without losing the selected entry or continuation draft', async () => {
    const original = await fs.readFile(source, 'utf8');
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Review saved parser work/ }).click();
    await page.getByLabel('Branch tip').selectOption('old-tip');
    await page.locator('.wb-transcript').getByText('The streaming approach needs review.').waitFor();
    await expect.poll(() => status().textContent()).toContain('2 changed files');
    expect(await status().textContent()).toContain('feature/workspace-status · 1 staged · 1 unstaged · 1 untracked');
    await page.getByLabel('Message pi').fill('Check the current files before continuing this branch.');

    await resizeWindow(1280, 900);
    await page.evaluate(() => document.fonts.ready);
    await capture('history-workspace-status.png');
    await status().locator('summary').click();
    await status().getByText('Saved history does not restore files or switch Git branches.').waitFor();
    expect(await status().getByLabel('Current repository commit').isVisible()).toBe(true);
    await status().getByLabel('Current repository commit').scrollIntoViewIfNeeded();
    await capture('history-workspace-status-expanded.png');
    await resizeWindow(900, 600);
    await status().getByLabel('Current repository commit').scrollIntoViewIfNeeded();
    await capture('history-head-commit-narrow.png');
    expect(await page.locator('.wb-transcript').evaluate((el) => el.clientHeight)).toBeGreaterThan(40);
    const composerBottom = await page.locator('.wb-composer').evaluate((el) => el.getBoundingClientRect().bottom);
    const footerTop = await page.locator('.wb-statusbar').evaluate((el) => el.getBoundingClientRect().top);
    expect(composerBottom).toBeLessThanOrEqual(footerTop);
    await resizeWindow(1280, 900);
    await status().getByRole('button', { name: 'Review workspace changes' }).click();
    await page.getByRole('heading', { name: 'Changes review', exact: true }).waitFor();
    await page.getByLabel('Commit message').waitFor();
    await page.getByRole('button', { name: /^Sessions/ }).click();
    expect(await page.getByLabel('Branch tip').inputValue()).toBe('old-tip');
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Check the current files before continuing this branch.');
    expect(await page.getByRole('button', { name: 'Resume in new fork', exact: true }).isEnabled()).toBe(true);
    expect(await page.locator('.wb-transcript').textContent()).not.toContain('The buffered approach is ready.');

    await fs.writeFile(path.join(project, 'notes.txt'), 'A newer edit outside the saved conversation.\n');
    git(project, 'add', 'notes.txt');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().textContent()).toContain('2 staged · 1 unstaged · 0 untracked');
    await status().locator('summary').click();
    await capture('history-workspace-status-refreshed.png');
    await status().locator('summary').click();
    await resizeWindow(900, 600);
    expect(await page.locator('.wb-transcript').evaluate((el) => el.clientHeight)).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    await capture('history-workspace-status-narrow.png');
    await resizeWindow(1280, 900);
    git(project, 'reset', '--', 'notes.txt');
    expect(await fs.readFile(source, 'utf8')).toBe(original);
    const commands = (await fs.readFile(rpcLog, 'utf8').catch(() => ''))
      .split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(commands.every((command) => command.type === 'get_available_models')).toBe(true);
    expect(await page.locator('.wb-sidebar .wb-session-item').filter({ hasText: 'this window' }).count()).toBe(0);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'New session', exact: true }).click();
  });

  it('refreshes changed counts on focus and keeps clean and detached roots distinct', async () => {
    await fs.unlink(path.join(project, 'notes.txt'));
    git(project, 'add', 'app.ts');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().textContent()).toContain('1 changed file');
    expect(await status().textContent()).toContain('1 staged · 0 unstaged · 0 untracked');
    await select('clean');
    await expect.poll(() => status().textContent()).toContain('No changes in this root');
    expect(await status().textContent()).toContain('main · 0 staged · 0 unstaged · 0 untracked');
    git(clean, 'checkout', '--detach');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().textContent()).toContain('Detached HEAD');
    expect(await status().textContent()).not.toContain('feature/workspace-status');
  });

  it('refreshes repository HEAD on focus, keeps detached commits visible and clears them on root switches', async () => {
    const subject = 'Record a new detached repository tip';
    git(clean, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', subject);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().getByLabel('Current repository commit').textContent()).toContain(subject);
    expect(await status().locator('code').textContent()).toBe(git(clean, 'rev-parse', 'HEAD').toString().trim().slice(0, 8));
    expect(await status().textContent()).toContain('Detached HEAD');
    await page.getByLabel('Workspace group').selectOption({ label: 'project' });
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
    await expect.poll(() => status().getByLabel('Current repository commit').textContent()).toContain(projectSubject);
    expect(await status().textContent()).not.toContain(subject);
    await page.evaluate(() => document.fonts.ready);
    await capture('workspace-head-commit.png');
    await resizeWindow(900, 600);
    await status().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    await capture('workspace-head-commit-narrow.png');
    await resizeWindow(1280, 900);
    expect(errors).toEqual([]);
  });

  it('refreshes local upstream comparison, preserves history space and clears stale tracking on root switches', async () => {
    await select('project');
    git(project, 'remote', 'add', 'origin', path.join(fixture, 'no-remote'));
    git(project, 'update-ref', 'refs/remotes/origin/feature/workspace-status', 'HEAD');
    git(project, 'branch', '--set-upstream-to=origin/feature/workspace-status');
    // An independent commit object models a fetched remote tip without a network request.
    const remoteTip = git(project, '-c', 'user.name=Test', '-c', 'user.email=test@example.test',
      'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Cached upstream tip').toString().trim();
    git(project, 'update-ref', 'refs/remotes/origin/feature/workspace-status', remoteTip);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().getByLabel('Upstream comparison').textContent()).toContain('0 ahead · 1 behind');
    await status().getByText('Local refs only. No fetch performed.').waitFor();
    await capture('workspace-upstream.png');
    await resizeWindow(900, 600);
    await status().getByLabel('Upstream comparison').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    await capture('workspace-upstream-narrow.png');
    await resizeWindow(1280, 900);

    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Review saved parser work/ }).click();
    await status().locator('summary').click();
    await status().getByLabel('Upstream comparison').waitFor();
    expect(await status().getByLabel('Upstream comparison').textContent()).toContain('0 ahead · 1 behind');
    await status().getByLabel('Upstream comparison').scrollIntoViewIfNeeded();
    await capture('history-upstream.png');
    await resizeWindow(900, 600);
    await status().getByLabel('Upstream comparison').scrollIntoViewIfNeeded();
    expect(await page.locator('.wb-transcript').evaluate((el) => el.clientHeight)).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    const composerBottom = await page.locator('.wb-composer').evaluate((el) => el.getBoundingClientRect().bottom);
    const footerTop = await page.locator('.wb-statusbar').evaluate((el) => el.getBoundingClientRect().top);
    expect(composerBottom).toBeLessThanOrEqual(footerTop);
    await capture('history-upstream-narrow.png');
    git(project, 'update-ref', '-d', 'refs/remotes/origin/feature/workspace-status');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().getByLabel('Upstream comparison').textContent()).toContain('Upstream origin/feature/workspace-status unavailable.');
    expect(await status().getByRole('button', { name: 'Review workspace changes' }).isEnabled()).toBe(true);
    await resizeWindow(1280, 900);
    await select('clean');
    await expect.poll(() => status().getByLabel('Upstream comparison').textContent()).toContain('detached HEAD');
    expect(await status().textContent()).not.toContain('origin/feature/workspace-status');
    git(clean, 'switch', 'main');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().getByLabel('Upstream comparison').textContent()).toBe('No upstream configured.');
    expect(errors).toEqual([]);
  });

  it('warns before new and saved continuation, keeps drafts and clears conflicts after resolution', async () => {
    git(clean, 'config', 'user.name', 'Test');
    git(clean, 'config', 'user.email', 'test@example.test');
    git(clean, 'config', 'commit.gpgsign', 'false');
    const longFile = 'src/a long package name/another long folder/café-parser-with-a-long-name.ts';
    await fs.mkdir(path.dirname(path.join(clean, longFile)), { recursive: true });
    await fs.writeFile(path.join(clean, longFile), 'base\n');
    git(clean, 'add', '.');
    const commit = (subject: string) => git(clean, '-c', 'user.name=Test', '-c', 'user.email=test@example.test',
      '-c', 'commit.gpgsign=false', 'commit', '-am', subject);
    commit('Add parser');
    git(clean, 'switch', '-c', 'other');
    for (const file of ['app.ts', longFile]) await fs.writeFile(path.join(clean, file), 'other\n');
    commit('Other changes');
    git(clean, 'switch', 'main');
    for (const file of ['app.ts', longFile]) await fs.writeFile(path.join(clean, file), 'main\n');
    commit('Main changes');
    expect(() => git(clean, 'merge', 'other')).toThrow();
    const archive = path.join(fixture, 'sessions/workspace/conflict.jsonl');
    await fs.writeFile(archive, [
      { type: 'session', version: 3, id: 'conflict', cwd: clean, timestamp: new Date().toISOString() },
      { type: 'message', id: 'request', parentId: null, message: { role: 'user', content: [{ type: 'text', text: 'Continue parser work' }] } },
    ].map((record) => JSON.stringify(record)).join('\n') + '\n');
    await page.getByLabel('Workspace group').selectOption({ label: 'clean' });
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().textContent()).toContain('2 unresolved conflicts');
    expect(await status().textContent()).toContain('main · 0 staged · 2 unstaged · 0 untracked');
    expect(await status().getByText(longFile, { exact: true }).isVisible()).toBe(true);
    await page.getByLabel('Message pi').fill('Resolve these files with care.');
    expect(await page.getByRole('button', { name: 'Send', exact: true }).isEnabled()).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await status().scrollIntoViewIfNeeded();
    await capture('workspace-conflicts.png');
    await resizeWindow(900, 600);
    await status().getByLabel('Unresolved Git conflicts').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    await capture('workspace-conflicts-narrow.png');
    await resizeWindow(1280, 900);
    await status().getByRole('button', { name: 'Review workspace changes' }).click();
    await page.getByRole('heading', { name: 'Changes review', exact: true }).waitFor();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Resolve these files with care.');
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Continue parser work/ }).click();
    await expect.poll(() => status().locator('summary').textContent()).toContain('2 unresolved conflicts');
    await page.getByLabel('Message pi').fill('Help resolve the conflicts before continuing.');
    expect(await page.getByRole('button', { name: 'Resume', exact: true }).isEnabled()).toBe(true);
    await capture('history-conflicts.png');
    await resizeWindow(900, 600);
    const summaryStatus = status().locator('summary .wb-meta > span').last();
    expect(await summaryStatus.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await capture('history-conflicts-narrow.png');
    await status().locator('summary').click();
    await status().getByLabel('Unresolved Git conflicts').waitFor();
    await status().getByLabel('Unresolved Git conflicts').scrollIntoViewIfNeeded();
    expect(await page.locator('.wb-transcript').evaluate((el) => el.clientHeight)).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.wb-composer').evaluate((el) => el.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(await page.locator('.wb-statusbar').evaluate((el) => el.getBoundingClientRect().top));
    await capture('history-conflicts-expanded-narrow.png');
    for (const file of ['app.ts', longFile]) await fs.writeFile(path.join(clean, file), 'resolved\n');
    git(clean, 'add', '.');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => status().getByLabel('Unresolved Git conflicts').count()).toBe(0);
    expect(await status().textContent()).toContain('main · 2 staged · 0 unstaged · 0 untracked');
    expect(await status().locator('summary').textContent()).not.toContain('unresolved conflict');
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Help resolve the conflicts before continuing.');
    await resizeWindow(1280, 900);
    await page.getByLabel('Workspace group').selectOption({ label: 'project' });
    expect(await status().getByLabel('Unresolved Git conflicts').count()).toBe(0);
    await page.getByLabel('Workspace group').selectOption({ label: 'clean' });
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Resolve these files with care.');
    const commands = (await fs.readFile(rpcLog, 'utf8').catch(() => ''))
      .split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(commands.every((command) => command.type === 'get_available_models')).toBe(true);
    expect(errors).toEqual([]);
  });

  it('does not describe non-Git folders or missing roots as clean', async () => {
    await select('plain');
    await expect.poll(() => status().textContent()).toContain('Git changes are unavailable for this folder.');
    expect(await status().getByRole('button').isDisabled()).toBe(true);
    expect(await status().getByLabel('Current repository commit').count()).toBe(0);
    await select('missing');
    await expect.poll(() => status().textContent()).toContain('Restore this folder to inspect Git changes.');
    expect(await status().getByRole('button').isDisabled()).toBe(true);
    expect(await status().textContent()).not.toContain('No changes in this root');
    expect(errors).toEqual([]);
  });
});
