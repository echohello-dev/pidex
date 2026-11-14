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
    expect(await page.locator('.wb-transcript').evaluate((el) => el.clientHeight)).toBeGreaterThan(40);
    const composerBottom = await page.locator('.wb-composer').evaluate((el) => el.getBoundingClientRect().bottom);
    const footerTop = await page.locator('.wb-statusbar').evaluate((el) => el.getBoundingClientRect().top);
    expect(composerBottom).toBeLessThanOrEqual(footerTop);
    await capture('history-head-commit-narrow.png');
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
    await select('project');
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
