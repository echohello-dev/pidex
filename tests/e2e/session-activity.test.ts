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
let rpcLog: string;
const errors: string[] = [];
const task = 'Review API changes';
const session = () => page.locator('.wb-sidebar .wb-session-item')
  .filter({ hasText: 'this window' }).filter({ hasText: task });
async function resize(width: number, height: number) {
  const window = await app.browserWindow(page);
  await window.evaluate((window, size) => window.setContentSize(size.width, size.height), { width, height });
  const [actualWidth, actualHeight] = await window.evaluate((window) => window.getContentSize());
  await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height,
    { width: actualWidth, height: actualHeight });
}
async function capture(name: string) {
  for (const directory of ['.tmp/proof', 'test-results/session-activity']) {
    await fs.mkdir(path.join(ROOT, directory), { recursive: true });
    await page.screenshot({ scale: 'css', path: path.join(ROOT, directory, name) });
  }
}
async function prompts() {
  const text = await fs.readFile(rpcLog, 'utf8');
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    .filter((record) => record.type === 'prompt');
}

describe('background session activity in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-activity-')));
    const api = path.join(fixture, 'api');
    const web = path.join(fixture, 'web');
    const userData = path.join(fixture, 'user-data');
    const sessions = path.join(fixture, 'sessions');
    rpcLog = path.join(fixture, 'rpc.jsonl');
    await Promise.all([api, web, userData, sessions].map((dir) => fs.mkdir(dir)));
    for (const cwd of [api, web]) {
      const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
      git('init', '-b', 'main');
      await fs.writeFile(path.join(cwd, 'app.ts'), 'export const ready = true;\n');
      git('add', '.');
      git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Prepare workspace');
    }
    await fs.writeFile(path.join(userData, 'workspaces.json'), JSON.stringify([api, web]));
    app = await electron.launch({
      executablePath: require('electron'), args: ['.'], cwd: ROOT,
      env: {
        ...process.env, NODE_ENV: 'development', PIDEX_E2E_CWD: api,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'), PIDEX_E2E_USER_DATA: userData,
        PIDEX_SESSIONS_ROOT: sessions, PIDEX_RPC_LOG: rpcLog,
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
      },
    });
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await resize(1280, 840);
    await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
    await page.getByLabel('Workspace group').selectOption({ label: 'api' });
    await page.evaluate(() => document.fonts.ready);
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('marks a completion in another root and acknowledges it on opening at native window sizes', async () => {
    await page.getByLabel('Message pi').fill(task);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    expect(await session().locator('.wb-session-unread').count()).toBe(0);
    await page.getByLabel('Workspace group').selectOption({ label: 'web' });
    await session().getByText('Unread activity', { exact: true }).waitFor();
    expect(await session().textContent()).toContain('Ready');
    expect(await page.getByLabel('Workspace group').locator('option:checked').textContent()).toBe('web');
    await session().scrollIntoViewIfNeeded();
    await capture('background-completion.png');
    await resize(900, 600);
    const unread = session().getByText('Unread activity', { exact: true });
    await unread.scrollIntoViewIfNeeded();
    const bounds = await unread.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await capture('background-completion-minimum.png');
    const before = await prompts();
    await session().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: task, exact: true }).waitFor();
    await expect.poll(() => session().locator('.wb-session-unread').count()).toBe(0);
    expect(await session().getAttribute('aria-current')).toBe('page');
    expect(await page.getByLabel('Workspace group').locator('option:checked').textContent()).toBe('api');
    expect(await prompts()).toEqual(before);
    await capture('acknowledged-completion-minimum.png');
    await resize(1280, 840);
    await capture('acknowledged-completion.png');
    expect(errors).toEqual([]);
  });

  it('marks a runtime exit while Changes is open and preserves the exited transcript on acknowledgement', async () => {
    await page.getByRole('button', { name: /^Changes/ }).click();
    // Terminate only the deterministic subprocess created by this test.
    const runtime = (await prompts()).find((record) => record.message === task)!;
    process.kill(runtime.runtimePid, 'SIGTERM');
    await session().getByText('Unread activity', { exact: true }).waitFor();
    expect(await session().textContent()).toContain('Exited');
    await session().scrollIntoViewIfNeeded();
    await capture('background-exit.png');
    await session().click();
    await page.getByRole('heading', { name: task, exact: true }).waitFor();
    await expect.poll(() => session().locator('.wb-session-unread').count()).toBe(0);
    expect(await session().textContent()).toContain('Exited');
    expect(await prompts()).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
