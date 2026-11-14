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
let empty: string;
let source: string;
let sourceBytes: string;
let rpcLog: string;
const errors: string[] = [];
const choice = () => page.getByRole('region', { name: 'Continue saved work' });
const newSession = () => page.getByRole('button', { name: 'New session', exact: true }).click();
async function resize(width: number, height: number) {
  const window = await app.browserWindow(page);
  await window.evaluate((window, size) => window.setContentSize(size.width, size.height), { width, height });
  const [actualWidth, actualHeight] = await window.evaluate((window) => window.getContentSize());
  await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height,
    { width: actualWidth, height: actualHeight });
}
async function capture(name: string) {
  for (const directory of ['.tmp/proof', 'test-results/session-start']) {
    await fs.mkdir(path.join(ROOT, directory), { recursive: true });
    await page.screenshot({ scale: 'css', path: path.join(ROOT, directory, name) });
  }
}
async function sessionRecords() {
  const log = await fs.readFile(rpcLog, 'utf8').catch(() => '');
  return log.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    .filter((record) => record.type !== 'get_available_models');
}

describe('session start choice in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-start-')));
    project = path.join(fixture, 'parser');
    empty = path.join(fixture, 'empty');
    rpcLog = path.join(fixture, 'rpc.jsonl');
    const userData = path.join(fixture, 'user-data');
    const archives = path.join(fixture, 'sessions/workspace');
    await Promise.all([project, empty, userData, archives].map((dir) => fs.mkdir(dir, { recursive: true })));
    for (const cwd of [project, empty]) {
      const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
      git('init', '-b', 'main');
      await fs.writeFile(path.join(cwd, 'app.ts'), 'export const ready = true;\n');
      git('add', '.');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Prepare workspace');
    }
    const alias = path.join(fixture, 'parser-alias');
    await fs.symlink(project, alias, 'dir');
    for (const [index, title] of ['Review parser recovery', 'Check keyboard focus', 'Older saved task'].entries()) {
      const file = path.join(archives, `${index}.jsonl`);
      const records = [
        { type: 'session', version: 3, id: `saved-${index}`, cwd: index === 0 ? alias : project, timestamp: new Date(Date.now() - index * 60_000).toISOString() },
        { type: 'message', id: 'u', parentId: null, message: { role: 'user', content: [{ type: 'text', text: title }] } },
        { type: 'message', id: 'a', parentId: 'u', message: { role: 'assistant', content: [{ type: 'text', text: `Saved response for ${title}.` }] } },
      ];
      await fs.writeFile(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
      if (index === 0) source = file;
    }
    sourceBytes = await fs.readFile(source, 'utf8');
    await fs.writeFile(path.join(userData, 'workspaces.json'), JSON.stringify([project, empty]));
    app = await electron.launch({
      executablePath: require('electron'), args: ['.'], cwd: ROOT,
      env: {
        ...process.env, NODE_ENV: 'development', PIDEX_E2E_CWD: project,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'), PIDEX_E2E_USER_DATA: userData,
        PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'), PIDEX_RPC_LOG: rpcLog,
      },
    });
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await resize(1280, 1000);
    await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
    await page.getByLabel('Workspace group').selectOption({ label: 'parser' });
    await choice().getByRole('button', { name: 'Preview Review parser recovery', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('previews a chosen saved conversation before opening a runtime session and preserves the separate task draft', async () => {
    await page.getByLabel('Message pi').fill('Keep this separate task for later.');
    await choice().scrollIntoViewIfNeeded();
    const order = await page.evaluate(() => ({
      choice: document.querySelector('.wb-session-choice')!.getBoundingClientRect().bottom,
      composer: document.querySelector('.wb-composer')!.getBoundingClientRect().top,
    }));
    expect(order.choice).toBeLessThan(order.composer);
    await page.getByText('Send starts a separate session in this root.', { exact: false }).waitFor();
    await capture('new-or-saved-session.png');

    // Use the second card so accidental auto-selection of the latest archive fails.
    const preview = choice().getByRole('button', { name: 'Preview Check keyboard focus', exact: true });
    await preview.focus();
    await page.keyboard.press('Enter');
    await page.locator('.wb-transcript').getByText('Saved response for Check keyboard focus.', { exact: true }).waitFor();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('');
    await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await page.getByLabel('Message pi').fill('Keep this unsent continuation too.');
    await capture('saved-conversation-preview.png');
    await newSession();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Keep this separate task for later.');
    await choice().getByRole('button', { name: 'View all saved sessions', exact: true }).click();
    await page.getByRole('tree', { name: 'Session archives', exact: true }).getByRole('treeitem', { name: /Older saved task/ }).waitFor();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Keep this unsent continuation too.');
    expect(await fs.readFile(source, 'utf8')).toBe(sourceBytes);
    expect(await sessionRecords()).toEqual([]);
    expect(await page.locator('.wb-sidebar .wb-session-item').filter({ hasText: 'this window' }).count()).toBe(0);
    await newSession();
  });

  it('keeps both choices reachable by scrolling at the native minimum window size', async () => {
    await newSession();
    await page.getByLabel('Message pi').fill('Keep this separate task for later.');
    await resize(900, 600);
    await choice().scrollIntoViewIfNeeded();
    await capture('new-or-saved-session-narrow.png');
    for (const button of await choice().getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(900);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(600);
    }
    await page.getByLabel('Message pi').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Send', exact: true }).scrollIntoViewIfNeeded();
    await capture('new-task-composer-narrow.png');
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Keep this separate task for later.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await sessionRecords()).toEqual([]);
    await resize(1280, 1000);
  });

  it('scopes choices to the selected root and starts a fresh conversation only after Send', async () => {
    await newSession();
    await page.getByLabel('Message pi').fill('Keep this separate task for later.');
    await page.getByLabel('Workspace group').selectOption({ label: 'empty' });
    await expect.poll(() => choice().count()).toBe(0);
    expect(await page.getByLabel('Message pi').inputValue()).toBe('');
    await page.getByText('Send starts a separate session in this root.', { exact: false }).waitFor();
    await capture('empty-root-new-session.png');
    await page.getByLabel('Workspace group').selectOption({ label: 'parser' });
    await choice().getByRole('button', { name: 'Preview Review parser recovery', exact: true }).waitFor();
    expect(await page.getByLabel('Message pi').inputValue()).toBe('Keep this separate task for later.');
    expect(await sessionRecords()).toEqual([]);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await expect.poll(async () => fs.readFile(rpcLog, 'utf8').catch(() => '')).toContain('"type":"prompt"');
    const records = (await fs.readFile(rpcLog, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    const prompt = records.find((record) => record.type === 'prompt');
    expect(prompt).toMatchObject({ cwd: project, message: 'Keep this separate task for later.' });
    expect(prompt.sessionFile).not.toBe(source);
    expect(prompt.sessionFile).toContain(`${path.sep}rpc-new${path.sep}`);
    expect(await page.locator('.wb-transcript').textContent()).not.toContain('Saved response for');
    expect(await fs.readFile(source, 'utf8')).toBe(sourceBytes);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    expect(errors).toEqual([]);
  });
});
