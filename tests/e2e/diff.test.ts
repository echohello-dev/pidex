import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
let app: ElectronApplication;
let page: Page;
let fixture: string;
let project: string;
const errors: string[] = [];
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: project, encoding: 'utf8' });
const select = (name: string, state = 'Modified') =>
  page
    .locator('.wb-change-files')
    .getByRole('button', {
      name: new RegExp(
        `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*${state}`,
      ),
    })
    .click();
const patchText = () =>
  page.locator('diffs-container [data-code]').allTextContents();

describe('real Git diffs in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-diff-'));
    project = path.join(fixture, 'project');
    await fs.mkdir(project);
    await fs.mkdir(path.join(fixture, 'sessions'));
    await fs.mkdir(path.join(fixture, 'user-data'));
    git('init', '-b', 'main');
    for (const [name, text] of Object.entries({
      'file with spaces.ts': 'export const focus = false;\n',
      'partial.ts': 'export const phase = "original";\n',
      'deleted.ts': 'export const removed = true;\n',
      'binary.bin': '\0before',
    }))
      await fs.writeFile(path.join(project, name), text);
    const longFile = Array.from(
      { length: 260 },
      (_, i) => `export const value${i} = ${i};`,
    );
    await fs.writeFile(
      path.join(project, 'multi-hunk.ts'),
      longFile.join('\n') + '\n',
    );
    git('add', '.');
    git(
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'fixture',
    );
    await fs.writeFile(
      path.join(project, 'partial.ts'),
      'export const phase = "staged";\n',
    );
    git('add', '--', 'partial.ts');
    await fs.writeFile(
      path.join(project, 'partial.ts'),
      'export const phase = "working";\n',
    );
    await fs.writeFile(
      path.join(project, 'file with spaces.ts'),
      'export const focus = true;\n',
    );
    await fs.writeFile(
      path.join(project, 'new-file.ts'),
      'export const created = true;\n',
    );
    await fs.writeFile(path.join(project, 'empty.txt'), '');
    await fs.writeFile(path.join(project, 'binary.bin'), '\0after');
    await fs.rm(path.join(project, 'deleted.ts'));
    longFile[4] = 'export const value4 = 400;';
    longFile[249] = 'export const value249 = 24900;';
    await fs.writeFile(
      path.join(project, 'multi-hunk.ts'),
      longFile.join('\n') + '\n',
    );
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
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page
      .getByRole('heading', { name: 'Start a session', exact: true })
      .waitFor();
    await page.getByRole('button', { name: /^Changes/ }).click();
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('renders changed lines and keeps staged and working-copy patches separate', async () => {
    await select('partial.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('"working"');
    expect((await patchText()).join('\n')).toContain('"staged"');
    await select('partial.ts', 'Staged');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('"original"');
    expect((await patchText()).join('\n')).toContain('"staged"');
    expect((await patchText()).join('\n')).not.toContain('"working"');
  });

  it('stages and unstages the selected path without losing a space-containing filename', async () => {
    await select('file with spaces.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('focus = true');
    expect((await patchText()).join('\n')).toContain('focus = false');
    await page.getByRole('button', { name: 'Stage file', exact: true }).click();
    await page
      .getByRole('button', { name: 'Unstage file', exact: true })
      .waitFor();
    expect(git('diff', '--cached', '--name-only')).toContain(
      'file with spaces.ts',
    );
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('focus = true');
    await page
      .getByRole('button', { name: 'Unstage file', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Stage file', exact: true })
      .waitFor();
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      'file with spaces.ts',
    );
  });

  it('renders new and deleted text and explains empty and binary changes', async () => {
    await select('new-file.ts', 'Untracked');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('created = true');
    await select('deleted.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('removed = true');
    await select('empty.txt', 'Untracked');
    await page
      .getByRole('heading', { name: 'No text changes', exact: true })
      .waitFor();
    await select('binary.bin');
    await page
      .getByRole('heading', { name: 'No text changes', exact: true })
      .waitFor();
    expect(errors).toEqual([]);
  });

  it('renders distant hunks without truncating a long file patch', async () => {
    await select('multi-hunk.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('value249 = 24900');
    const rendered = (await patchText()).join('\n');
    expect(rendered).toContain('value4 = 400');
    expect(rendered).toContain('value4 = 4;');
    expect(rendered).toContain('value249 = 249;');
    expect(errors).toEqual([]);
  });

  it('keeps a long changed-file list selectable at the minimum window size', async () => {
    await page.setViewportSize({ width: 900, height: 600 });
    await select('partial.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('"working"');
    await select('new-file.ts', 'Untracked');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('created = true');
    expect(
      await page.locator('.wb-change-files').evaluate((el) => el.clientHeight),
    ).toBeGreaterThanOrEqual(80);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  it('refreshes the displayed patch when content changes with the same diff statistics', async () => {
    await select('partial.ts');
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('"working"');
    await fs.writeFile(
      path.join(project, 'partial.ts'),
      'export const phase = "refreshed";\n',
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(async () => (await patchText()).join('\n'), { timeout: 10000 })
      .toContain('"refreshed"');
    expect((await patchText()).join('\n')).not.toContain('"working"');
  });
});
