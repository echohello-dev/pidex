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
let switched: string;
let log: string;
const errors: string[] = [];
const proofDir = process.env.PIDEX_BRANCH_PROOF_DIR;
const summaryShots = path.join(ROOT, 'test-results/history-summary');
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
    fixture = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-branches-')));
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
    switched = path.join(archives, 'switched.jsonl');
    await fs.writeFile(path.join(archives, 'legacy.jsonl'), [
      { type: 'session', version: 2, id: 'legacy', cwd: project, timestamp: '2026-11-01T01:00:00Z' },
      message('legacy-task', null, 'user', 'Recover legacy context'),
      message('legacy-answer', 'legacy-task', 'assistant', 'A readable older archive.'),
    ].map((record) => JSON.stringify(record)).join('\n') + '\n');
    await fs.writeFile(
      path.join(archives, 'recovery.jsonl'),
      [
        { type: 'session', version: 3, id: 'recovery', cwd: project, timestamp: '2026-11-02T01:00:00Z' },
        message('r-task', null, 'user', 'Recover interrupted build'),
        {
          type: 'message', id: 'r-call', parentId: 'r-task',
          message: { role: 'assistant', content: [
            { type: 'text', text: 'Checking the build before updating the parser.' },
            { type: 'toolCall', id: 'build', name: 'bash', arguments: { command: 'bun run build' } },
          ] },
        },
        {
          type: 'message', id: 'r-failed', parentId: 'r-call',
          message: { role: 'toolResult', toolCallId: 'build', isError: true,
            content: [{ type: 'text', text: 'Build failed. Missing parser export.' }] },
        },
        {
          type: 'message', id: 'r-tip', parentId: 'r-failed',
          message: { role: 'assistant', content: [
            { type: 'toolCall', id: 'edit', name: 'write', arguments: { path: 'parser.ts', content: 'export const parser = true;' } },
          ] },
        },
      ].map((record) => JSON.stringify(record)).join('\n') + '\n',
    );
    await fs.writeFile(
      switched,
      [
        {
          type: 'session',
          version: 3,
          id: 'switched',
          cwd: project,
          timestamp: '2026-11-03T01:00:00Z',
        },
        message('b-user', null, 'user', 'Alternate archive after switch'),
        message(
          'b-tip',
          'b-user',
          'assistant',
          'Only the alternate archive history belongs here.',
        ),
      ]
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
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
        PIDEX_RPC_SWITCH_FILE: switched,
      },
    });
    page = await app.firstWindow();
    proofVideo = page.video();
    if (proofDir) await fs.mkdir(proofDir, { recursive: true });
    await fs.mkdir(summaryShots, { recursive: true });
    page.setDefaultTimeout(15000);
    await page.setViewportSize({ width: 1100, height: 700 });
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

  it('summarises unfinished history without launching Pi and follows branch selection', async () => {
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page.getByRole('treeitem', { name: /Recover interrupted build/ }).click();
    const summary = page.locator('.wb-history-summary');
    await summary.getByText('2 messages · 2 tool calls').waitFor();
    expect(await summary.getAttribute('open')).toBeNull();
    await summary.locator('summary').click();
    await summary.getByText('0 done · 1 failed · 0 running · 1 interrupted').waitFor();
    await summary.getByText(/They may have made changes/).waitFor();
    await page.screenshot({ path: path.join(summaryShots, 'unfinished-tools.png') });
    // Native disclosure keeps the transcript accessible on short windows.
    await summary.locator('summary').focus();
    await page.keyboard.press('Enter');
    expect(await summary.getAttribute('open')).toBeNull();
    await page.keyboard.press('Enter');
    expect(await summary.getAttribute('open')).not.toBeNull();
    await page.getByRole('tree', { name: 'Session archives', exact: true }).getByRole('treeitem', { name: /Explore parser branches/ }).click();
    await summary.locator('summary').click();
    await summary.getByText('The latest branch uses a buffered parser.').waitFor();
    await page.getByLabel('Branch tip').selectOption('old-tip');
    await summary.locator('summary').click();
    await summary.getByText('4 messages · 0 tool calls').waitFor();
    await summary.getByText('Keep the streaming approach').waitFor();
    await summary.getByText('Streaming branch is ready.').waitFor();
    expect(await summary.textContent()).not.toContain('buffered parser');
    await page.screenshot({ path: path.join(summaryShots, 'selected-branch.png') });
    await page.getByRole('treeitem', { name: /assistant: The original branch/ }).click();
    await summary.locator('summary').click();
    await summary.getByText('2 messages · 0 tool calls').waitFor();
    await summary.getByText('Explore parser branches').waitFor();
    expect(await summary.textContent()).not.toContain('Keep the streaming approach');
    expect((await readLog()).filter((c) => c.type === 'get_state' || c.type === 'prompt')).toEqual([]);
    await page.getByRole('treeitem', { name: /\(empty session\)/ }).click();
    await summary.locator('summary').click();
    await summary.getByText('No messages in this selection.').waitFor();
    await page.getByRole('tree', { name: 'Session archives', exact: true }).getByRole('treeitem', { name: /Explore parser branches/ }).click();
    await page.locator('.wb-transcript').getByText('The latest branch uses a buffered parser.').waitFor();
    await page.setViewportSize({ width: 1100, height: 700 });
  });

  it('copies only the selected history path as portable context without launching Pi', async () => {
    const original = await fs.readFile(source, 'utf8');
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.getByRole('tree', { name: 'Session archives', exact: true }).getByRole('treeitem', { name: /Explore parser branches/ }).click();
    await page.locator('.wb-transcript').getByText('The latest branch uses a buffered parser.').waitFor();
    await page.getByRole('button', { name: 'Copy context', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Context copied.' }).waitFor();
    const latest = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(latest).toContain('The latest branch uses a buffered parser.');
    expect(latest).toContain('## Continue elsewhere');
    expect(latest).toContain('It ran in `');
    expect(latest).toContain('- Pi session `source`.');
    expect(latest).toContain(`- Source archive \`${source}\`.`);
    expect(latest).toContain('- Selected entry `new-tip` (archive tip).');
    expect(latest).toContain('select entry `new-tip`, and choose Resume.');
    expect(latest).not.toContain('Streaming branch is ready.');
    await page.getByLabel('Branch tip').selectOption('old-tip');
    await page.locator('.wb-transcript').getByText('Streaming branch is ready.').waitFor();
    expect(await page.getByText('Context copied.', { exact: false }).count()).toBe(0);
    await page.getByRole('button', { name: 'Copy context', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Context copied.' }).waitFor();
    const branch = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(branch).toContain('Streaming branch is ready.');
    expect(branch).not.toContain('buffered parser');
    expect(branch).toContain('- Selected entry `old-tip`.');
    expect(branch).toContain('- Archive tip at export `new-tip`.');
    expect(branch).toContain('select entry `old-tip`, and choose Resume in new fork.');
    await page.getByRole('treeitem', { name: /assistant: The original branch/ }).click();
    await page.locator('.wb-transcript').getByText('The original branch uses a streaming parser.').waitFor();
    await page.getByRole('button', { name: 'Copy context', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Context copied.' }).waitFor();
    const ancestor = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(ancestor).toContain('The original branch uses a streaming parser.');
    expect(ancestor).not.toContain('Keep the streaming approach');
    expect(ancestor).not.toContain('Streaming branch is ready.');
    expect(ancestor).toContain('- Selected entry `old-answer`.');
    expect(ancestor).toContain('- Archive tip at export `new-tip`.');
    expect(ancestor).toContain('select entry `old-answer`, and choose Resume in new fork.');
    await fs.mkdir(path.join(ROOT, '.tmp/proof'), { recursive: true });
    const exportedFile = path.join(ROOT, '.tmp/proof/selected-history.md');
    await app.evaluate(({ BrowserWindow }, output) => {
      BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_event, item) => {
        item.setSavePath(output);
      });
    }, exportedFile);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect.poll(() => fs.readFile(exportedFile, 'utf8')).toContain('- Selected entry `old-answer`.');
    const exported = await fs.readFile(exportedFile, 'utf8');
    // Copy and download differ only in the time at which the snapshot was made.
    expect(exported.replace(/^Exported from pidex at .*$/m, '')).toBe(ancestor.replace(/^Exported from pidex at .*$/m, ''));
    await fs.copyFile(exportedFile, path.join(summaryShots, 'selected-history.md'));
    await page.screenshot({ path: path.join(ROOT, '.tmp/proof/copied-history-context.png') });
    expect(await fs.readFile(source, 'utf8')).toBe(original);
    expect((await readLog()).filter((c) => c.type === 'get_state' || c.type === 'prompt')).toEqual([]);
    await page.getByRole('tree', { name: 'Session archives', exact: true }).getByRole('treeitem', { name: /Explore parser branches/ }).click();
    await page.locator('.wb-transcript').getByText('The latest branch uses a buffered parser.').waitFor();
    await page.setViewportSize({ width: 1100, height: 700 });
  });

  it('copies readable legacy history with source identifiers and no unsafe resume instruction', async () => {
    const legacy = path.join(path.dirname(source), 'legacy.jsonl');
    const original = await fs.readFile(legacy, 'utf8');
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Recover legacy context/ }).click();
    await page.locator('.wb-transcript').getByText('A readable older archive.').waitFor();
    await page.getByRole('button', { name: 'Copy context', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Context copied.' }).waitFor();
    const context = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(context).toContain('- Pi session `legacy`.');
    expect(context).toContain('- Selected entry `legacy-answer` (archive tip).');
    expect(context).toContain('Pidex could not validate it for continuation');
    expect(context).not.toContain('and choose Resume');
    expect(await fs.readFile(legacy, 'utf8')).toBe(original);
    expect((await readLog()).filter((c) => c.type === 'get_state' || c.type === 'prompt')).toEqual([]);
    await fs.writeFile(path.join(summaryShots, 'legacy-history-context.md'), context);
    await page.getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Explore parser branches/ }).click();
    await page.locator('.wb-transcript').getByText('The latest branch uses a buffered parser.').waitFor();
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
  it('reuses the live archive owner after sending and reselecting its latest tip', async () => {
    const canonical = await fs.realpath(source);
    const previous = (await readLog())
      .filter((c) => c.type === 'prompt' && c.sessionFile === canonical)
      .at(-1);
    const tabsBefore = await page
      .locator('.wb-sidebar .wb-session-item')
      .filter({ hasText: 'this window' })
      .count();
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem')
      .filter({ hasText: 'Explore parser branches' })
      .first()
      .click();
    await page
      .locator('.wb-transcript')
      .getByText('Continue latest tip', { exact: true })
      .waitFor();
    await page.getByLabel('Message pi').fill('Resume this live branch again');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Explore parser branches', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    const records = (await fs.readFile(source, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const blocked = await page.evaluate(
      async ({ cwd, source, entryId }) =>
        window.pidex.openSession({ cwd, sessionFile: source, entryId }),
      {
        cwd: records[0].cwd as string,
        source,
        entryId: records.at(-1).id as string,
      },
    );
    expect(blocked.error).toContain('running in an open tab');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const prompts = (await readLog()).filter(
      (c) => c.type === 'prompt' && c.sessionFile === canonical,
    );
    expect(prompts.at(-1).runtimePid).toBe(previous.runtimePid);
    expect(new Set(prompts.map((c) => c.runtimePid)).size).toBe(1);
    expect(
      await page
        .locator('.wb-sidebar .wb-session-item')
        .filter({ hasText: 'this window' })
        .count(),
    ).toBe(tabsBefore);
    expect(await fs.readFile(source, 'utf8')).toContain(
      'Resume this live branch again',
    );
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
  it('refreshes identity and history when an existing runtime switched archives', async () => {
    const canonicalSource = await fs.realpath(source);
    const sourcePid = (await readLog())
      .filter((c) => c.type === 'prompt' && c.sessionFile === canonicalSource)
      .at(-1)?.runtimePid;
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem')
      .filter({ hasText: 'Explore parser branches' })
      .first()
      .click();
    await page.getByLabel('Message pi').fill('Switch archive for test');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Explore parser branches', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Send', exact: true }).waitFor();
    const tabsBefore = await page
      .locator('.wb-sidebar .wb-session-item')
      .filter({ hasText: 'this window' })
      .count();
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Alternate archive after switch/ })
      .click();
    await page
      .locator('.wb-transcript')
      .getByText('Only the alternate archive history belongs here.')
      .waitFor();
    await page.getByLabel('Message pi').fill('Continue the switched archive');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('heading', {
        name: 'Alternate archive after switch',
        exact: true,
      })
      .waitFor();
    await page
      .locator('.wb-transcript')
      .getByText('Only the alternate archive history belongs here.')
      .waitFor();
    expect(
      await page
        .locator('.wb-transcript')
        .getByText('The latest branch uses a buffered parser.')
        .count(),
    ).toBe(0);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const prompt = (await readLog())
      .filter(
        (c) =>
          c.type === 'prompt' && c.message === 'Continue the switched archive',
      )
      .at(-1);
    expect(prompt.runtimePid).toBe(sourcePid);
    expect(prompt.sessionFile).toBe(await fs.realpath(switched));
    expect(
      await page
        .locator('.wb-sidebar .wb-session-item')
        .filter({ hasText: 'this window' })
        .count(),
    ).toBe(tabsBefore);
    expect(errors).toEqual([]);
  });

  it('fails closed on an unresponsive owner without launching a competing writer', async () => {
    await page.getByLabel('Message pi').fill('Simulate owner state failure');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const before = await fs.readFile(switched, 'utf8');
    const canonical = await fs.realpath(switched);
    const ownerPid = (await readLog())
      .filter((c) => c.type === 'prompt' && c.sessionFile === canonical)
      .at(-1).runtimePid;
    const promptCount = (await readLog()).filter(
      (c) => c.type === 'prompt',
    ).length;
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /Alternate archive after switch/ })
      .click();
    await page
      .getByLabel('Message pi')
      .fill('This must not start a second writer');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page
      .getByRole('alert')
      .getByText(/Could not verify archive ownership/)
      .waitFor();
    expect(await fs.readFile(switched, 'utf8')).toBe(before);
    const records = await readLog();
    expect(records.filter((c) => c.type === 'prompt')).toHaveLength(
      promptCount,
    );
    expect(
      new Set(
        records
          .filter((c) => c.sessionFile === canonical)
          .map((c) => c.runtimePid),
      ),
    ).toEqual(new Set([ownerPid]));
    expect(errors).toEqual([]);
  });
});
