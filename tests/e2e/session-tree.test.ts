import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
let app: ElectronApplication;
let page: Page;
let fixture: string;
let source: string;
let log: string;
const errors: string[] = [];
const proofDir = process.env.PIDEX_BRANCH_PROOF_DIR;
let proofVideo: ReturnType<Page['video']>;
const message = (
  id: string,
  parentId: string | null,
  role: string,
  text: string,
) => ({
  type: 'message',
  id,
  parentId,
  message: { role, content: [{ type: 'text', text }] },
});
const readLog = async () =>
  (await fs.readFile(log, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

describe('session branches in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-branches-'));
    const project = path.join(fixture, 'project');
    const archives = path.join(fixture, 'sessions/workspace');
    await Promise.all([
      fs.mkdir(project),
      fs.mkdir(archives, { recursive: true }),
      fs.mkdir(path.join(fixture, 'user-data')),
    ]);
    source = path.join(archives, 'source.jsonl');
    log = path.join(fixture, 'rpc.jsonl');
    await fs.writeFile(
      source,
      [
        {
          type: 'session',
          version: 3,
          id: 'source',
          cwd: project,
          timestamp: '2026-11-05T01:00:00Z',
        },
        message('task', null, 'user', 'Explore parser branches'),
        message(
          'old-answer',
          'task',
          'assistant',
          'The original branch uses a streaming parser.',
        ),
        message(
          'old-followup',
          'old-answer',
          'user',
          'Keep the streaming approach',
        ),
        message(
          'old-tip',
          'old-followup',
          'assistant',
          'Streaming branch is ready.',
        ),
        message(
          'new-tip',
          'task',
          'assistant',
          'The latest branch uses a buffered parser.',
        ),
      ]
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n',
    );
    await fs.writeFile(
      path.join(archives, 'empty.jsonl'),
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'empty',
        cwd: project,
        timestamp: '2026-11-04T01:00:00Z',
      }) + '\n',
    );
    app = await electron.launch({
      executablePath: require('electron'),
      args: ['.'],
      cwd: ROOT,
      recordVideo: proofDir
        ? {
            dir: path.join(fixture, 'video'),
            size: { width: 1280, height: 840 },
          }
        : undefined,
      env: {
        ...process.env,
        PIDEX_E2E_CWD: project,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
        PIDEX_E2E_USER_DATA: path.join(fixture, 'user-data'),
        PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
        PIDEX_RPC_LOG: log,
      },
    });
    page = await app.firstWindow();
    proofVideo = page.video();
    if (proofDir) await fs.mkdir(proofDir, { recursive: true });
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page
      .getByRole('heading', { name: 'Start a session', exact: true })
      .waitFor();
  });
  afterAll(async () => {
    await app?.close();
    if (proofDir && proofVideo)
      await proofVideo.saveAs(
        path.join(proofDir, 'session-tree-navigation.webm'),
      );
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('previews selected branch and ancestor, forks exact selection and preserves both source branches', async () => {
    const original = await fs.readFile(source, 'utf8');
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .locator('.wb-transcript')
      .getByText('The latest branch uses a buffered parser.')
      .waitFor();
    await page.getByLabel('Branch tip').selectOption('old-tip');
    await page
      .locator('.wb-transcript')
      .getByText('Streaming branch is ready.')
      .waitFor();
    expect(
      await page
        .locator('.wb-transcript')
        .getByText('The latest branch uses a buffered parser.')
        .count(),
    ).toBe(0);
    expect(
      await page
        .getByRole('treeitem', { name: /Streaming branch is ready/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    if (proofDir)
      await page.screenshot({
        path: path.join(proofDir, 'selected-branch.png'),
      });
    // Select an ancestor, not just a leaf. Preview and fork must stop here.
    await page
      .getByRole('treeitem', { name: /assistant: The original branch/ })
      .click();
    await page
      .locator('.wb-transcript')
      .getByText('The original branch uses a streaming parser.')
      .waitFor();
    expect(
      await page
        .locator('.wb-transcript')
        .getByText('Streaming branch is ready.')
        .count(),
    ).toBe(0);
    await page
      .getByRole('button', { name: 'Fork from here', exact: true })
      .click();
    await page
      .getByRole('heading', {
        name: 'Explore parser branches (fork)',
        exact: true,
      })
      .waitFor();
    if (proofDir)
      await page.screenshot({
        path: path.join(proofDir, 'selected-entry-fork.png'),
      });
    const stateRequest = (await readLog())
      .filter((c) => c.type === 'get_state' && c.sessionFile)
      .at(-1);
    const forkPath = stateRequest.sessionFile as string;
    expect(forkPath).not.toBe(await fs.realpath(source));
    const forkRecords = (await fs.readFile(forkPath, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(forkRecords[0].parentSession).toBe(await fs.realpath(source));
    expect(
      forkRecords
        .slice(1)
        .filter((e) => e.type === 'message')
        .map((e) => e.id),
    ).toEqual(['task', 'old-answer']);
    expect(await fs.readFile(source, 'utf8')).toBe(original);
    await page.getByLabel('Message pi').fill('Continue the fork');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    expect(
      (await readLog()).filter((c) => c.type === 'prompt').at(-1).sessionFile,
    ).toBe(forkPath);
    expect(await fs.readFile(source, 'utf8')).toBe(original);
  });

  it('continues an older tip as an explicit new fork and resumes the archive tip in place', async () => {
    const original = await fs.readFile(source, 'utf8');
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem')
      .filter({ hasText: 'Explore parser branches' })
      .first()
      .click();
    await page.getByLabel('Branch tip').selectOption('old-tip');
    await page
      .locator('.wb-transcript')
      .getByText('Streaming branch is ready.')
      .waitFor();
    await page.getByLabel('Message pi').fill('Continue older tip');
    await page
      .getByRole('button', { name: 'Resume in new fork', exact: true })
      .click();
    await page
      .getByRole('heading', {
        name: 'Explore parser branches (fork)',
        exact: true,
      })
      .waitFor();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const prompt = (await readLog()).filter((c) => c.type === 'prompt').at(-1);
    expect(prompt.sessionFile).not.toBe(await fs.realpath(source));
    const content = await fs.readFile(prompt.sessionFile, 'utf8');
    expect(content).toContain('old-tip');
    expect(content).not.toContain('new-tip');
    expect(await fs.readFile(source, 'utf8')).toBe(original);
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem')
      .filter({ hasText: 'Explore parser branches' })
      .first()
      .click();
    await page.getByLabel('Branch tip').selectOption('new-tip');
    await page
      .locator('.wb-transcript')
      .getByText('The latest branch uses a buffered parser.')
      .waitFor();
    await page.getByLabel('Message pi').fill('Continue latest tip');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Explore parser branches', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    expect(
      (await readLog()).filter((c) => c.type === 'prompt').at(-1).sessionFile,
    ).toBe(await fs.realpath(source));
    const resumed = await fs.readFile(source, 'utf8');
    expect(resumed.startsWith(original)).toBe(true);
    expect(resumed).toContain('"parentId":"new-tip"');
    expect(resumed).toContain('old-tip');
    expect(errors).toEqual([]);
  });
  it('handles empty sessions and rejects stale entry selections without opening an unrelated leaf', async () => {
    const original = await fs.readFile(source, 'utf8');
    const cwd = JSON.parse(original.split('\n')[0]).cwd as string;
    const before = (await readLog()).filter(
      (c) => c.type === 'get_state',
    ).length;
    const stale = await page.evaluate(
      async ({ cwd, source }) =>
        window.pidex.openSession({
          cwd,
          sessionFile: source,
          entryId: 'missing-entry',
        }),
      { cwd, source },
    );
    expect(stale.error).toContain('no longer exists');
    const staleEmpty = await page.evaluate(
      async ({ cwd, source }) =>
        window.pidex.openSession({ cwd, sessionFile: source, entryId: null }),
      { cwd, source },
    );
    expect(staleEmpty.error).toContain('has advanced');
    expect((await readLog()).filter((c) => c.type === 'get_state').length).toBe(
      before,
    );
    expect(await fs.readFile(source, 'utf8')).toBe(original);
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page.getByRole('treeitem', { name: /\(empty session\)/ }).click();
    await page
      .getByText('Empty session. Resume to start its first branch.')
      .waitFor();
    expect(
      await page
        .getByRole('button', { name: 'Fork from here', exact: true })
        .isDisabled(),
    ).toBe(true);
    await page.getByLabel('Message pi').fill('Start empty branch');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('heading', { name: '(empty session)', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    expect(
      (await readLog()).filter((c) => c.type === 'prompt').at(-1).sessionFile,
    ).toBe(await fs.realpath(path.join(path.dirname(source), 'empty.jsonl')));
    expect(errors).toEqual([]);
  });
});
