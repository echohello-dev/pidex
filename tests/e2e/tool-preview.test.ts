import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const oldText = `const settings = {${'enabled: false, '.repeat(400)}}; // old-end`;
const newText = `const settings = {${'enabled: true, '.repeat(400)}}; // new-end`;
const shots = path.join(root, 'test-results/tool-preview');
let app: ElectronApplication;
let page: Page;
let fixture: string;
const errors: string[] = [];

describe('bounded tool previews in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-tool-preview-'));
    const project = path.join(fixture, 'project');
    const archives = path.join(fixture, 'sessions/workspace');
    await Promise.all([
      fs.mkdir(project),
      fs.mkdir(archives, { recursive: true }),
      fs.mkdir(path.join(fixture, 'user-data')),
      fs.mkdir(path.join(root, '.tmp/proof'), { recursive: true }),
      fs.mkdir(shots, { recursive: true }),
    ]);
    for (const tool of ['write', 'edit']) {
      const records = [
        { type: 'session', version: 3, id: tool, cwd: project, timestamp: new Date().toISOString() },
        { type: 'message', id: 'task', parentId: null, message: {
          role: 'user', content: [{ type: 'text', text: `Inspect long ${tool} input` }],
        } },
        { type: 'message', id: 'call', parentId: 'task', message: {
          role: 'assistant', content: [{ type: 'toolCall', id: tool, name: tool, arguments: {
            path: 'settings.js',
            ...(tool === 'write' ? { content: newText } : { oldText, newText }),
          } }],
        } },
        { type: 'message', id: 'result', parentId: 'call', message: {
          role: 'toolResult', toolCallId: tool, toolName: tool,
          content: [{ type: 'text', text: 'Updated settings.js' }],
        } },
      ];
      await fs.writeFile(path.join(archives, `${tool}.jsonl`), records.map((r) => JSON.stringify(r)).join('\n'));
    }
    app = await electron.launch({
      executablePath: require('electron'),
      args: ['.'],
      cwd: root,
      env: {
        ...process.env,
        PIDEX_E2E_CWD: project,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
        PIDEX_E2E_USER_DATA: path.join(fixture, 'user-data'),
        PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
        PIDEX_PI: path.join(root, 'tests/fixtures/pi-rpc.cjs'),
      },
    });
    page = await app.firstWindow();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.getByRole('heading', { name: 'Start a session', exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /^Sessions/ }).click();
  });

  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it.each(['write', 'edit'])('bounds a long %s line, copies the full input and expands on request', async (tool) => {
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: new RegExp(`Inspect long ${tool} input`) }).click();
    const card = page.locator('.wb-tool');
    await card.locator('summary').click();
    await card.getByRole('button', { name: 'Output details' }).click();
    await card.getByRole('button', { name: 'Input details' }).click();
    const diff = card.locator('.wb-tool-diff');
    await expect.poll(async () => (await diff.textContent())?.length).toBe(2000);
    expect(await diff.textContent()).not.toContain('new-end');
    await card.getByText('Input preview shortened. Show more or copy the full input.').waitFor();
    await card.getByRole('button', { name: 'Copy input' }).click();
    await card.getByText('Copied', { exact: true }).waitFor();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(
      tool === 'write' ? `settings.js\n\n${newText}` : `settings.js\n\nOld:\n${oldText}\n\nNew:\n${newText}`,
    );
    await card.getByRole('button', { name: 'Show more' }).focus();
    await page.keyboard.press('Enter');
    expect(await diff.textContent()).toContain(newText);
    if (tool === 'edit') expect(await diff.textContent()).toContain(oldText);
    await card.getByRole('button', { name: 'Show less' }).click();
    expect((await diff.textContent())?.length).toBe(2000);
    await card.locator('summary').scrollIntoViewIfNeeded();
    const screenshot = `${tool}-bounded-preview.png`;
    await page.screenshot({ path: path.join(root, '.tmp/proof', screenshot) });
    await page.screenshot({ path: path.join(shots, screenshot) });

    await page.setViewportSize({ width: 900, height: 600 });
    await card.getByRole('button', { name: 'Show more' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(root, '.tmp/proof', `${tool}-bounded-narrow.png`) });
    await page.screenshot({ path: path.join(shots, `${tool}-bounded-narrow.png`) });
    await page.setViewportSize({ width: 1280, height: 1100 });
    expect(errors).toEqual([]);
  });
});
