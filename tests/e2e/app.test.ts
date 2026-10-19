import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  afterEach,
  inject,
} from 'vitest';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const ELECTRON_BIN = `${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`;
let app: ElectronApplication;
let win: Page;
let fixtureRoot: string;
let project: string;
let rpcLog: string;
const errors: string[] = [];
const shots = path.join(ROOT, 'test-results/workbench');
const waitFor = async (condition: () => Promise<boolean>) => {
  for (let i = 0; i < 80; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('UI condition did not become true.');
};

describe('Figma workbench in Electron', () => {
  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-ui-'));
    project = path.join(fixtureRoot, 'pidex');
    rpcLog = path.join(fixtureRoot, 'rpc.jsonl');
    const sessionDir = path.join(fixtureRoot, 'sessions', 'workspace');
    const userData = path.join(fixtureRoot, 'user-data');
    await Promise.all([
      fs.mkdir(project, { recursive: true }),
      fs.mkdir(sessionDir, { recursive: true }),
      fs.mkdir(userData),
      fs.mkdir(shots, { recursive: true }),
    ]);
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: project, stdio: 'pipe' });
    git('init', '-b', 'main');
    await fs.writeFile(
      path.join(project, 'Composer.tsx'),
      'export const focus = false;\n',
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
      path.join(project, 'Composer.tsx'),
      'export const focus = true;\n',
    );
    await fs.mkdir(path.join(project, '.pi', 'skills', 'frontend-design'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(project, '.pi', 'skills', 'frontend-design', 'SKILL.md'),
      '---\nname: frontend-design\ndescription: Visual and interaction patterns for interfaces.\n---\nBuild a frontend.\n',
    );
    for (const [i, title] of [
      'Fix composer focus',
      'Add slash command search',
      'Review session streaming',
    ].entries()) {
      const timestamp = new Date(
        Date.now() - (i + 1) * 15 * 60_000,
      ).toISOString();
      const records = [
        { type: 'session', id: `session-${i}`, timestamp, cwd: project },
        {
          type: 'model_change',
          id: 'm',
          parentId: null,
          modelId: 'claude-sonnet',
        },
        {
          type: 'message',
          id: 'u',
          parentId: 'm',
          message: { role: 'user', content: [{ type: 'text', text: title }] },
        },
        {
          type: 'message',
          id: 'a',
          parentId: 'u',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The composer now keeps a visible focus ring when reached by keyboard. Tab moves through the toolbar in order.',
              },
            ],
          },
        },
      ];
      await fs.writeFile(
        path.join(sessionDir, `${i}.jsonl`),
        records.map((record) => JSON.stringify(record)).join('\n'),
      );
    }
    app = await electron.launch({
      args: ['.'],
      executablePath: ELECTRON_BIN,
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
        PIDEX_E2E_CWD: project,
        PIDEX_E2E_USER_DATA: userData,
        PIDEX_SESSIONS_ROOT: path.join(fixtureRoot, 'sessions'),
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
        PIDEX_RPC_LOG: rpcLog,
      },
    });
    win = await app.firstWindow();
    await win
      .context()
      .tracing.start({ screenshots: true, snapshots: true, sources: true });
    win.setDefaultTimeout(10_000);
    win.on('pageerror', (error) => errors.push(error.message));
    await win.waitForLoadState('load');
    await app.evaluate(
      ({ BrowserWindow }, url) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().startsWith(url))
          ?.setContentSize(1440, 900),
      inject('rendererUrl'),
    );
    await win.setViewportSize({ width: 1440, height: 900 });
    await win
      .getByRole('heading', { name: 'Start a session', exact: true })
      .waitFor();
    await waitFor(
      async () =>
        (await win.getByLabel('Session model').locator('option').count()) >= 3,
    );
    await win.evaluate(() => document.fonts.ready);
  }, 60_000);

  afterAll(async () => {
    try {
      if (win && !win.isClosed())
        await win
          .context()
          .tracing.stop({ path: path.join(shots, 'trace.zip') });
    } finally {
      await app?.close();
      if (fixtureRoot)
        await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  afterEach(async ({ task }) => {
    if (task.result?.state === 'fail' && win && !win.isClosed()) {
      const name = task.name.replace(/[^a-z0-9]+/gi, '-');
      await win.screenshot({ path: path.join(shots, `failed-${name}.png`) });
    }
  });

  it('matches the new-session shell and loads every local icon at its design size', async () => {
    await win.screenshot({ path: path.join(shots, '01-new-session.png') });
    const result = await win.evaluate(() => ({
      bodyHeight: document.body.scrollHeight,
      height: window.innerHeight,
      sidebar: document.querySelector('.wb-sidebar')!.getBoundingClientRect()
        .width,
      composer: document.querySelector('.wb-composer')!.getBoundingClientRect()
        .width,
      icons: [
        ...document.querySelectorAll<HTMLImageElement>('.wb-icon img'),
      ].map((img) => ({
        loaded: img.complete && img.naturalWidth > 0,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
      })),
    }));
    expect(result.bodyHeight).toBeLessThanOrEqual(result.height);
    expect(result.sidebar).toBe(248);
    expect(result.composer).toBe(848);
    for (const icon of result.icons)
      expect(icon).toEqual({ loaded: true, width: 16, height: 16 });
    expect(
      await win.getByRole('button', { name: 'Send', exact: true }).isDisabled(),
    ).toBe(true);
  });

  it('opens a saved session, streams a prompt, and stops the runtime', async () => {
    await win
      .locator('.wb-sidebar')
      .getByRole('button', { name: /Fix composer focus/ })
      .click();
    await win
      .getByRole('heading', { name: 'Fix composer focus', exact: true })
      .waitFor();
    await win
      .getByLabel('Message pi')
      .fill('Check keyboard focus in the composer.');
    await win.getByRole('button', { name: 'Send', exact: true }).click();
    await win.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await win.screenshot({ path: path.join(shots, '02-active-session.png') });
    await win.getByRole('button', { name: 'Stop', exact: true }).click();
    await waitFor(
      async () =>
        await win
          .getByRole('button', { name: 'Send', exact: true })
          .isVisible(),
    );
  });

  it('previews history without starting a runtime and resumes the same session', async () => {
    const before = (await fs.readFile(rpcLog, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((c) => c.type === 'get_state').length;
    await win.getByRole('button', { name: /^Sessions/ }).click();
    await win
      .getByText('The composer now keeps a visible focus ring', {
        exact: false,
      })
      .waitFor();
    await win.screenshot({ path: path.join(shots, '04-session-history.png') });
    const after = (await fs.readFile(rpcLog, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((c) => c.type === 'get_state').length;
    expect(after).toBe(before);
    await win.getByLabel('Message pi').fill('Continue checking focus.');
    await win.getByRole('button', { name: 'Resume', exact: true }).click();
    await win
      .getByRole('heading', { name: 'Fix composer focus', exact: true })
      .waitFor();
    await win.getByRole('button', { name: 'Stop', exact: true }).click();
  });

  it('renders real Git patches and stages just the selected file', async () => {
    await win.getByRole('button', { name: /^Changes/ }).click();
    await win
      .locator('.wb-change-files')
      .getByRole('button', { name: /Composer.tsx/ })
      .click();
    await win
      .getByRole('button', { name: 'Stage file', exact: true })
      .waitFor();
    await waitFor(
      async () => (await win.locator('diffs-container').count()) > 0,
    );
    await win.screenshot({ path: path.join(shots, '03-changes-review.png') });
    await win.getByRole('button', { name: 'Stage file', exact: true }).click();
    await win
      .getByRole('button', { name: 'Unstage file', exact: true })
      .waitFor();
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: project,
      encoding: 'utf8',
    });
    expect(staged.trim()).toBe('Composer.tsx');
  });

  it('saves workspace model defaults and displays an honest runtime policy', async () => {
    await win.getByRole('button', { name: /^Settings/ }).click();
    await win
      .getByRole('heading', { name: 'Models & access', exact: true })
      .waitFor();
    await win
      .getByLabel('Reasoning effort', { exact: true })
      .selectOption('high');
    await win.screenshot({ path: path.join(shots, '05-models-access.png') });
    await win
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await win.getByText('Changes saved', { exact: true }).waitFor();
    expect(await win.getByLabel('Default tool permissions').isDisabled()).toBe(
      true,
    );
    const settings = JSON.parse(
      await fs.readFile(
        path.join(fixtureRoot, 'user-data', 'session-defaults.json'),
        'utf8',
      ),
    );
    expect(settings[project].thinking).toBe('high');
  });

  it('supports quick-switch keyboard navigation, files, skills and collapsed navigation', async () => {
    await win
      .getByRole('button', { name: 'Quick switch', exact: true })
      .click();
    await win.screenshot({ path: path.join(shots, '09-command-palette.png') });
    await win.getByRole('dialog').getByRole('combobox').press('ArrowDown');
    expect(
      await win
        .getByRole('dialog')
        .getByRole('combobox')
        .getAttribute('aria-activedescendant'),
    ).toBe('palette-result-1');
    await win.getByRole('tab', { name: /^Files/ }).click();
    await win.getByRole('dialog').getByRole('combobox').fill('Composer');
    await win.getByRole('dialog').getByRole('combobox').press('Enter');
    await win.getByRole('heading', { name: 'Files & preview' }).waitFor();
    await win
      .getByText('export const focus = true;', { exact: true })
      .waitFor();
    await win.screenshot({ path: path.join(shots, '06-files.png') });
    await win.getByRole('button', { name: 'Skills', exact: true }).click();
    await win.getByText('frontend-design', { exact: true }).first().waitFor();
    await win.screenshot({ path: path.join(shots, '07-skills.png') });
    await win.getByLabel('Search skills').fill('no such skill');
    await win.getByRole('heading', { name: 'No skills found' }).waitFor();
    await win.getByRole('button', { name: 'Toggle sidebar' }).click();
    expect(
      await win
        .getByRole('complementary', { name: 'Workspace navigation' })
        .count(),
    ).toBe(0);
    await win.getByRole('button', { name: 'Toggle sidebar' }).click();
    expect(errors).toEqual([]);
  });

  it('forks a saved conversation without modifying the source session', async () => {
    const source = path.join(fixtureRoot, 'sessions', 'workspace', '0.jsonl');
    const before = await fs.readFile(source, 'utf8');
    await win.getByRole('button', { name: /^Sessions/ }).click();
    await win.getByRole('button', { name: 'Fork from here' }).click();
    await win
      .getByRole('heading', { name: 'Fix composer focus (fork)', exact: true })
      .waitFor();
    expect(await fs.readFile(source, 'utf8')).toBe(before);
    expect(
      await fs.readFile(
        path.join(fixtureRoot, 'sessions', 'workspace', 'fork.jsonl'),
        'utf8',
      ),
    ).toContain('The composer now keeps');
  });

  it('recovers a rejected prompt and applies saved reasoning defaults to a new session', async () => {
    await win.getByRole('button', { name: 'New session', exact: true }).click();
    await win.getByLabel('Message pi').fill('reject this prompt');
    await win.getByRole('button', { name: 'Send', exact: true }).click();
    await win
      .getByRole('alert')
      .getByText('Test provider rejected the prompt.', { exact: true })
      .waitFor();
    expect(await win.getByLabel('Message pi').inputValue()).toBe(
      'reject this prompt',
    );
    const commands = (await fs.readFile(rpcLog, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(commands).toContainEqual(
      expect.objectContaining({ type: 'set_thinking_level', level: 'high' }),
    );
    expect(errors).toEqual([]);
  });

  it('keeps the desktop layouts usable at the minimum window size', async () => {
    await win.getByRole('button', { name: 'New session', exact: true }).click();
    await win.setViewportSize({ width: 900, height: 600 });
    for (const label of ['New session', 'Sessions', 'Changes', 'Settings']) {
      await win
        .getByRole('button', { name: new RegExp(`^${label}`) })
        .first()
        .click();
      const geometry = await win.evaluate(() => ({
        overflow: document.body.scrollHeight - window.innerHeight,
        mainRight: document.querySelector('.wb-main')!.getBoundingClientRect()
          .right,
        composerRight:
          document.querySelector('.wb-composer')?.getBoundingClientRect()
            .right ?? 0,
      }));
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.mainRight).toBeLessThanOrEqual(900);
      expect(geometry.composerRight).toBeLessThanOrEqual(900);
    }
    await win.setViewportSize({ width: 1440, height: 900 });
  });

  it('shows the workspace picker when no projects have been added', async () => {
    const userData = path.join(fixtureRoot, 'empty-user-data');
    const archive = path.join(fixtureRoot, 'empty-sessions');
    await fs.mkdir(userData);
    await fs.mkdir(archive);
    const emptyApp = await electron.launch({
      args: ['.'],
      executablePath: ELECTRON_BIN,
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PIDEX_E2E_CWD: path.join(fixtureRoot, 'missing-project'),
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
        PIDEX_E2E_USER_DATA: userData,
        PIDEX_SESSIONS_ROOT: archive,
        PIDEX_PI: path.join(ROOT, 'tests/fixtures/pi-rpc.cjs'),
      },
    });
    try {
      const page = await emptyApp.firstWindow();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('heading', { name: 'Welcome to pidex' }).waitFor();
      expect(
        await page
          .getByRole('button', { name: 'Browse folder', exact: true })
          .isEnabled(),
      ).toBe(true);
      expect(
        await page
          .getByRole('button', { name: 'New session', exact: true })
          .isDisabled(),
      ).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page
          .locator('.wb-welcome > img')
          .evaluate((img: HTMLImageElement) => ({
            loaded: img.complete && img.naturalWidth > 0,
            width: img.getBoundingClientRect().width,
            height: img.getBoundingClientRect().height,
          })),
      ).toEqual({ loaded: true, width: 80, height: 80 });
      await page.screenshot({
        path: path.join(shots, '08-workspace-picker.png'),
      });
    } finally {
      await emptyApp.close();
    }
  });
});
