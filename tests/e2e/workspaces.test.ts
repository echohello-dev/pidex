import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
let app: ElectronApplication;
let page: Page;
let fixture: string;
let api: string;
let web: string;
let missing: string;
let archive: string;
let missingArchive: string;
let restoredAlias: string;
let restoredPhysical: string;
let restoredArchive: string;
let log: string;
let userData: string;
const errors: string[] = [];
const header = (id: string, cwd: string) =>
  [
    { type: 'session', version: 3, id, cwd, timestamp: '2026-11-06T00:00:00Z' },
    {
      type: 'message',
      id: 'u',
      parentId: null,
      message: {
        role: 'user',
        content: [{ type: 'text', text: `History for ${id}` }],
      },
    },
    {
      type: 'message',
      id: 'a',
      parentId: 'u',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: `Stored answer for ${id}` }],
      },
    },
  ]
    .map((record) => JSON.stringify(record))
    .join('\n') + '\n';
async function launch() {
  app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PIDEX_E2E_CWD: api,
      PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
      PIDEX_E2E_USER_DATA: userData,
      PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
      PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
      PIDEX_RPC_LOG: log,
      PIDEX_RPC_STATE_DELAY_CWD: api,
      PIDEX_RPC_SWITCH_FILE: path.join(
        fixture,
        'sessions',
        'mixed',
        'web.jsonl',
      ),
    },
  });
  page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .getByRole('heading', { name: 'Start a session', exact: true })
    .waitFor();
}
async function root(cwd: string) {
  await page.locator('.wb-root-list button').filter({ hasText: cwd }).click();
}
async function records() {
  return (await fs.readFile(log, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('grouped roots in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-multi-')),
    );
    api = path.join(fixture, 'api');
    web = path.join(fixture, 'web');
    missing = path.join(fixture, 'offline');
    userData = path.join(fixture, 'user-data');
    log = path.join(fixture, 'rpc.jsonl');
    const store = path.join(fixture, 'sessions', 'mixed');
    await Promise.all([
      fs.mkdir(api),
      fs.mkdir(web),
      fs.mkdir(userData),
      fs.mkdir(store, { recursive: true }),
    ]);
    const physicalParent = path.join(fixture, 'physical-parent');
    const linkedParent = path.join(fixture, 'linked-parent');
    await fs.mkdir(physicalParent);
    await fs.symlink(physicalParent, linkedParent);
    restoredAlias = path.join(linkedParent, 'restored-project');
    restoredPhysical = path.join(physicalParent, 'restored-project');
    restoredArchive = path.join(store, 'restored.jsonl');
    await fs.writeFile(restoredArchive, header('restored', restoredAlias));
    await fs.writeFile(
      path.join(userData, 'workspaces.json'),
      JSON.stringify([api, web, missing, restoredAlias]),
    );
    await fs.writeFile(
      path.join(userData, 'session-defaults.json'),
      JSON.stringify({
        [api]: { model: '', provider: '', thinking: 'high' },
        [web]: { model: '', provider: '', thinking: 'low' },
      }),
    );
    archive = path.join(store, 'api.jsonl');
    missingArchive = path.join(store, 'offline.jsonl');
    await fs.writeFile(archive, header('api', api));
    await fs.writeFile(path.join(store, 'web.jsonl'), header('web', web));
    await fs.writeFile(missingArchive, header('offline', missing));
    await launch();
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('creates and renames a group of existing roots while keeping root history separate', async () => {
    await page
      .getByRole('button', { name: 'Create workspace', exact: true })
      .click();
    await page.getByLabel('Workspace name').fill('Commerce');
    await page.getByRole('checkbox', { name: /^web/ }).check();
    await page.getByRole('checkbox', { name: /^offline/ }).check();
    await page
      .getByRole('button', { name: 'Save workspace', exact: true })
      .click();
    await page
      .getByLabel('Workspace group')
      .locator('option:checked')
      .filter({ hasText: 'Commerce' })
      .waitFor({ state: 'attached' });
    await page
      .getByRole('button', { name: 'Edit workspace', exact: true })
      .click();
    await page.getByLabel('Workspace name').fill('Product');
    await page
      .getByRole('button', { name: 'Save workspace', exact: true })
      .click();
    await page
      .getByLabel('Workspace group')
      .locator('option:checked')
      .filter({ hasText: 'Product' })
      .waitFor({ state: 'attached' });
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /History for api/ })
      .waitFor();
    expect(
      await page
        .getByRole('tree', { name: 'Session archives', exact: true })
        .getByRole('treeitem', { name: /History for web/ })
        .count(),
    ).toBe(0);
    await root(web);
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /History for web/ })
      .waitFor();
    expect(
      await page
        .getByRole('tree', { name: 'Session archives', exact: true })
        .getByRole('treeitem', { name: /History for api/ })
        .count(),
    ).toBe(0);
  });

  it('does not carry a commit draft into another root when both restore Changes', async () => {
    await root(web);
    await page.getByRole('button', { name: /^Changes/ }).click();
    await page.getByLabel('Commit message').waitFor();
    await root(api);
    await page.getByRole('button', { name: /^Changes/ }).click();
    await page.getByLabel('Commit message').fill('API-only commit draft');
    await root(web);
    expect(await page.getByLabel('Commit message').inputValue()).toBe('');
    expect(await page.locator('.wb-execution-root').textContent()).toContain(
      web,
    );
  });

  it('starts, resumes and forks in a restored canonical root while retaining its identity and source', async () => {
    const before = await page.evaluate(() => window.pidex.workspaceCatalog());
    const original = before.roots.find((r) => r.cwd === restoredAlias)!;
    expect(original.availability).toBe('missing');
    await fs.mkdir(restoredPhysical);
    const after = await page.evaluate(() => window.pidex.workspaceCatalog());
    const recovered = after.roots.find((r) => r.dirName === original.dirName)!;
    expect(recovered.cwd).toBe(restoredPhysical);
    expect(recovered.availability).toBe('available');
    expect(after.groups).toEqual(before.groups);
    const resumed = await page.evaluate(
      ({ cwd, file }) => window.pidex.openSession({ cwd, sessionFile: file }),
      { cwd: recovered.cwd, file: restoredArchive },
    );
    expect(resumed.error).toBeUndefined();
    expect(resumed.cwd).toBe(restoredPhysical);
    expect(resumed.state?.sessionFile).toBe(restoredArchive);
    await page.evaluate(
      (id) => window.pidex.closeSession(id!),
      resumed.sessionId,
    );
    const originalBytes = await fs.readFile(restoredArchive, 'utf8');
    const forked = await page.evaluate(
      ({ cwd, file }) =>
        window.pidex.openSession({
          cwd,
          sessionFile: file,
          entryId: 'u',
          fork: true,
        }),
      { cwd: recovered.cwd, file: restoredArchive },
    );
    expect(forked.error).toBeUndefined();
    expect(forked.cwd).toBe(restoredPhysical);
    expect(forked.state?.sessionFile).not.toBe(restoredArchive);
    expect(await fs.readFile(restoredArchive, 'utf8')).toBe(originalBytes);
    const fork = (await fs.readFile(forked.state!.sessionFile!, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(fork[0].cwd).toBe(restoredAlias);
    expect(fork[0].parentSession).toBe(restoredArchive);
    expect(fork.some((entry) => entry.id === 'u')).toBe(true);
    expect(fork.some((entry) => entry.id === 'a')).toBe(false);
    await page.evaluate(
      (id) => window.pidex.closeSession(id!),
      forked.sessionId,
    );
    const fresh = await page.evaluate(
      (cwd) => window.pidex.openSession({ cwd }),
      recovered.cwd,
    );
    expect(fresh.error).toBeUndefined();
    expect(fresh.cwd).toBe(restoredPhysical);
    await page.evaluate(
      (id) => window.pidex.closeSession(id!),
      fresh.sessionId,
    );
  });

  it('adds an existing folder through the picker and removes only its group membership', async () => {
    const docs = path.join(fixture, 'docs');
    await fs.mkdir(docs);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, docs);
    await page.getByRole('button', { name: 'Add root', exact: true }).click();
    await page
      .locator('.wb-root-list button')
      .filter({ hasText: docs })
      .waitFor();
    expect(await page.locator('.wb-execution-root').textContent()).toContain(
      docs,
    );
    await page
      .getByRole('button', { name: 'Edit workspace', exact: true })
      .click();
    await page.getByRole('checkbox', { name: /^docs/ }).uncheck();
    await page
      .getByRole('button', { name: 'Save workspace', exact: true })
      .click();
    await expect
      .poll(() => page.locator('.wb-root-list button').count())
      .toBe(3);
    expect((await fs.stat(docs)).isDirectory()).toBe(true);
    const catalog = await page.evaluate(() => window.pidex.workspaceCatalog());
    const docRoot = catalog.roots.find((r) => r.cwd === docs)!;
    expect(
      catalog.groups.some((g) => g.rootIds.includes(docRoot.dirName)),
    ).toBe(true);
  });

  it('refreshes roots and their groups together when external Pi history appears', async () => {
    const external = path.join(fixture, 'external');
    await fs.mkdir(external);
    await fs.writeFile(
      path.join(fixture, 'sessions', 'mixed', 'external.jsonl'),
      header('external', external),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page
      .getByLabel('Workspace group')
      .locator('option')
      .filter({ hasText: 'external' })
      .waitFor({ state: 'attached' });
    await page
      .getByLabel('Workspace group')
      .selectOption({ label: 'external' });
    await expect
      .poll(() => page.locator('.wb-execution-root').textContent())
      .toContain(external);
    await page.getByLabel('Workspace group').selectOption({ label: 'Product' });
  });

  it('retains a late opening in the background without submitting the source draft to another root', async () => {
    await root(api);
    await page
      .getByRole('button', { name: 'New session', exact: true })
      .click();
    await page.getByLabel('Message pi').fill('API draft during launch');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await root(web);
    await page
      .getByRole('button', { name: 'New session', exact: true })
      .click();
    await expect
      .poll(async () =>
        page
          .locator('.wb-sidebar .wb-session-item')
          .filter({ hasText: 'this window' })
          .count(),
      )
      .toBe(1);
    expect(
      (await records()).some(
        (r) => r.type === 'prompt' && r.message === 'API draft during launch',
      ),
    ).toBe(false);
    await root(api);
    expect(await page.getByLabel('Message pi').inputValue()).toBe(
      'API draft during launch',
    );
    await root(web);
    await page
      .getByRole('button', { name: 'New session', exact: true })
      .click();
    await page.getByLabel('Message pi').fill('Web task');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Web task', exact: true })
      .waitFor();
    expect(
      (await records()).find(
        (r) => r.type === 'prompt' && r.message === 'Web task',
      )?.cwd,
    ).toBe(web);
    await root(api);
    expect(await page.getByLabel('Message pi').inputValue()).toBe(
      'API draft during launch',
    );
    const webTab = page
      .locator('.wb-sidebar .wb-session-item')
      .filter({ hasText: 'this window' })
      .filter({ hasText: 'Web task' });
    await webTab.click();
    await page
      .getByRole('heading', { name: 'Web task', exact: true })
      .waitFor();
    expect(await page.getByLabel('Working directory').count()).toBe(0);
    expect(await page.locator('.wb-execution-root').textContent()).toContain(
      web,
    );
    const shots = path.join(ROOT, 'test-results/workspaces');
    await fs.mkdir(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'background-roots.png') });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  });

  it('keeps root defaults and unsaved settings drafts separate across switches', async () => {
    await root(api);
    await page.getByRole('button', { name: /^Settings/ }).click();
    await expect
      .poll(() =>
        page.getByLabel('Reasoning effort', { exact: true }).inputValue(),
      )
      .toBe('high');
    await page
      .getByLabel('Reasoning effort', { exact: true })
      .selectOption('medium');
    await root(web);
    await page.getByRole('button', { name: /^Settings/ }).click();
    await expect
      .poll(() =>
        page.getByLabel('Reasoning effort', { exact: true }).inputValue(),
      )
      .toBe('low');
    await root(api);
    await expect
      .poll(() =>
        page.getByLabel('Reasoning effort', { exact: true }).inputValue(),
      )
      .toBe('medium');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await page.getByText('Changes saved', { exact: true }).waitFor();
    const saved = JSON.parse(
      await fs.readFile(path.join(userData, 'workspace-registry.json'), 'utf8'),
    );
    expect(
      saved.roots.find((r: { path: string }) => r.path === api).defaults
        .thinking,
    ).toBe('medium');
    expect(
      saved.roots.find((r: { path: string }) => r.path === web).defaults
        .thinking,
    ).toBe('low');
  });

  it('rejects unknown or mismatched owner roots before modifying or opening the source', async () => {
    const before = await fs.readFile(archive, 'utf8');
    const wrong = await page.evaluate(
      async ({ web, archive }) =>
        window.pidex.openSession({
          cwd: web,
          sessionFile: archive,
          entryId: 'a',
          fork: true,
        }),
      { web, archive },
    );
    expect(wrong.error).toContain('belongs to another root');
    const unknown = await page.evaluate(
      async ({ fixture }) => window.pidex.openSession({ cwd: fixture }),
      { fixture },
    );
    expect(unknown.error).toContain('Unknown workspace root');
    expect(await fs.readFile(archive, 'utf8')).toBe(before);
    const alias = path.join(fixture, 'linked-api');
    await fs.symlink(api, alias);
    const linkedArchive = path.join(
      fixture,
      'sessions',
      'mixed',
      'linked.jsonl',
    );
    const linkedSource = header('linked', alias);
    await fs.writeFile(linkedArchive, linkedSource);
    const catalog = await page.evaluate(() => window.pidex.workspaceCatalog());
    await fs.unlink(alias);
    await fs.symlink(web, alias);
    const retargeted = await page.evaluate(
      ({ web, linkedArchive }) =>
        window.pidex.openSession({ cwd: web, sessionFile: linkedArchive }),
      { web, linkedArchive },
    );
    expect(retargeted.error).toContain('belongs to another root');
    expect(await fs.readFile(linkedArchive, 'utf8')).toBe(linkedSource);
    const webRoot = catalog.roots.find((r) => r.cwd === web)!;
    const history = await page.evaluate(
      (id) => window.pidex.sessions(id),
      webRoot.dirName,
    );
    expect(history.some((s) => s.file === linkedArchive)).toBe(false);
  });

  it('serializes concurrent opens to a single live archive writer', async () => {
    const opened = await page.evaluate(
      async ({ api, archive }) =>
        Promise.all([
          window.pidex.openSession({ cwd: api, sessionFile: archive }),
          window.pidex.openSession({ cwd: api, sessionFile: archive }),
        ]),
      { api, archive },
    );
    expect(opened[0].error).toBeUndefined();
    expect(opened[1].error).toBeUndefined();
    expect(opened[0].sessionId).toBe(opened[1].sessionId);
    const owners = (await records()).filter(
      (r) => r.type === 'get_state' && r.sessionFile === archive,
    );
    expect(new Set(owners.map((r) => r.runtimePid)).size).toBe(1);
    await page.evaluate(
      (id) => window.pidex.closeSession(id!),
      opened[0].sessionId,
    );
  });

  it('refuses prompts after an extension switches an active archive to another root', async () => {
    const opened = await page.evaluate(
      ({ api, archive }) =>
        window.pidex.openSession({ cwd: api, sessionFile: archive }),
      { api, archive },
    );
    expect(opened.error).toBeUndefined();
    const switched = await page.evaluate(
      (sessionId) =>
        window.pidex.sendPrompt({
          sessionId: sessionId!,
          text: 'Switch archive for test',
          streaming: false,
        }),
      opened.sessionId,
    );
    expect(switched.success).toBe(true);
    const refused = await page.evaluate(
      (sessionId) =>
        window.pidex.sendPrompt({
          sessionId: sessionId!,
          text: 'Do not send across roots',
          streaming: false,
        }),
      opened.sessionId,
    );
    expect(refused.error).toContain('changed execution roots');
    expect(
      (await records()).some(
        (r) => r.type === 'prompt' && r.message === 'Do not send across roots',
      ),
    ).toBe(false);
    await page.evaluate(
      (id) => window.pidex.closeSession(id!),
      opened.sessionId,
    );
  });

  it('previews unavailable-root history but disables continuation and preserves saved groups across relaunch', async () => {
    await root(missing);
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .getByRole('tree', { name: 'Session archives', exact: true })
      .getByRole('treeitem', { name: /History for offline/ })
      .click();
    await page
      .getByText('Stored answer for offline', { exact: true })
      .waitFor();
    expect(await page.getByLabel('Message pi').isDisabled()).toBe(true);
    expect(
      await page
        .getByRole('button', { name: 'Fork from here', exact: true })
        .isDisabled(),
    ).toBe(true);
    const failed = await page.evaluate(
      async ({ missing, missingArchive }) =>
        window.pidex.openSession({ cwd: missing, sessionFile: missingArchive }),
      { missing, missingArchive },
    );
    expect(failed.error).toContain('missing or unavailable');
    const before = JSON.parse(
      await fs.readFile(path.join(userData, 'workspace-registry.json'), 'utf8'),
    );
    await app.close();
    await launch();
    expect(
      await page
        .getByLabel('Workspace group')
        .locator('option:checked')
        .textContent(),
    ).toBe('Product');
    expect(await page.locator('.wb-root-list button').count()).toBe(3);
    expect(
      await page
        .locator('.wb-sidebar .wb-session-item')
        .filter({ hasText: 'this window' })
        .count(),
    ).toBe(0);
    const after = JSON.parse(
      await fs.readFile(path.join(userData, 'workspace-registry.json'), 'utf8'),
    );
    expect(after.selected).toEqual(before.selected);
    expect(after.roots.map((r: { id: string }) => r.id)).toEqual(
      before.roots.map((r: { id: string }) => r.id),
    );
    expect(errors).toEqual([]);
  });
});
