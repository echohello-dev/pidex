/** Capture real Electron interactions for the README. Requires ffmpeg and a display. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as tcpServer } from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'vite';
import { _electron as electron } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const exec = promisify(execFile);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-media-'));
const project = path.join(fixture, 'pidex');
const captures = path.join(fixture, 'captures');
let app;
let server;
try {
  await exec('ffmpeg', ['-version']);
  await fs.mkdir(project);
  await fs.mkdir(captures);
  await fs.mkdir(path.join(fixture, 'sessions/workspace'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'user-data'));
  const git = (args) => exec('git', args, { cwd: project });
  await git(['init', '-b', 'main']);
  const before = [
    'export function composerKeyDown(event: KeyboardEvent) {',
    "  if (event.key === 'Enter') {",
    '    event.preventDefault();',
    '    sendMessage();',
    '  }',
    '}',
    '',
    'export const focusRing = false;',
    '',
  ].join('\n');
  const after = [
    'export function composerKeyDown(event: KeyboardEvent) {',
    "  if (event.key === 'Escape') {",
    '    stopSession();',
    '    return;',
    '  }',
    '',
    "  if (event.key === 'Enter' && !event.shiftKey) {",
    '    event.preventDefault();',
    '    sendMessage();',
    '  }',
    '}',
    '',
    'export const focusRing = true;',
    '',
  ].join('\n');
  await fs.writeFile(path.join(project, 'Composer.tsx'), before);
  await fs.writeFile(
    path.join(project, 'README.md'),
    '# Composer keyboard focus\n\nEnter sends. Shift+Enter adds a line. Escape stops Pi.\n',
  );
  await git(['add', '.']);
  await git([
    '-c',
    'user.name=Demo',
    '-c',
    'user.email=demo@example.test',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'Initial composer',
  ]);
  await fs.writeFile(path.join(project, 'Composer.tsx'), after);
  const archive = [
    {
      type: 'session',
      id: 'focus-demo',
      cwd: project,
      timestamp: new Date().toISOString(),
    },
    {
      type: 'message',
      id: 'u',
      parentId: null,
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'Fix composer keyboard focus' }],
      },
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
            text: 'The composer keeps a visible focus ring. Enter sends, Shift+Enter adds a line, and Escape stops the running session.\n\n- Keep keyboard navigation in order.\n- Review the patch before committing.',
          },
        ],
      },
    },
  ];
  await fs.writeFile(
    path.join(fixture, 'sessions/workspace/focus.jsonl'),
    archive.map((x) => JSON.stringify(x)).join('\n'),
  );
  const port = await new Promise((resolve, reject) => {
    const probe = tcpServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
  server = await createServer({
    root: path.join(root, 'src/renderer'),
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await server.listen();
  app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: root,
    env: {
      ...process.env,
      PIDEX_E2E_CWD: project,
      PIDEX_E2E_RENDERER_URL: server.resolvedUrls.local[0],
      PIDEX_E2E_USER_DATA: path.join(fixture, 'user-data'),
      PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
      PIDEX_PI: path.join(root, 'tests/fixtures/pi-rpc.cjs'),
    },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1280, 800),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .getByRole('heading', { name: 'Start a session', exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByLabel('Session model')
    .selectOption({ label: 'Claude Sonnet' });
  await page.screenshot({ path: path.join(captures, 'workbench-boot.png') });
  await page.locator('.wb-sidebar .wb-session-item').first().click();
  await page
    .getByLabel('Message pi')
    .fill('Check keyboard focus in the composer.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
  await page.screenshot({ path: path.join(captures, 'workbench-loaded.png') });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: /^Sessions/ }).click();
  await page.getByRole('button', { name: 'Fork from here' }).waitFor();
  await page.screenshot({ path: path.join(captures, 'workbench-history.png') });
  await page.getByRole('button', { name: /^Changes/ }).click();
  await page
    .locator('.wb-change-files')
    .getByRole('button', { name: /Composer.tsx/ })
    .click();
  await page
    .locator('diffs-container')
    .getByText('export const focusRing = true;', { exact: true })
    .waitFor();
  await page.screenshot({ path: path.join(captures, 'workbench-changes.png') });

  const frames = path.join(captures, 'frames');
  await fs.mkdir(frames);
  let recording = true;
  let index = 0;
  const capture = (async () => {
    while (recording) {
      await page.screenshot({
        path: path.join(frames, `${String(index++).padStart(4, '0')}.png`),
      });
      await pause(160);
    }
  })();
  try {
    await pause(900);
    await page.getByRole('button', { name: 'Stage file', exact: true }).click();
    await page
      .getByRole('button', { name: 'Unstage file', exact: true })
      .waitFor();
    assert.equal(
      (await git(['diff', '--cached', '--name-only'])).stdout.trim(),
      'Composer.tsx',
    );
    await pause(1200);
    await page
      .getByRole('button', { name: 'Unstage file', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Stage file', exact: true })
      .waitFor();
    assert.equal(
      (await git(['diff', '--cached', '--name-only'])).stdout.trim(),
      '',
    );
    await pause(900);
  } finally {
    recording = false;
    await capture;
  }
  assert.deepEqual(errors, []);
  const input = path.join(frames, '%04d.png');
  const palette = path.join(captures, 'palette.png');
  await exec('ffmpeg', [
    '-y',
    '-framerate',
    '4',
    '-i',
    input,
    '-vf',
    'scale=1120:-1:flags=lanczos,palettegen=max_colors=96:stats_mode=diff',
    '-frames:v',
    '1',
    palette,
  ]);
  await exec('ffmpeg', [
    '-y',
    '-framerate',
    '4',
    '-i',
    input,
    '-i',
    palette,
    '-lavfi',
    'scale=1120:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
    '-loop',
    '0',
    path.join(captures, 'workbench-diff-review.gif'),
  ]);
  const files = [
    'workbench-boot.png',
    'workbench-loaded.png',
    'workbench-history.png',
    'workbench-changes.png',
    'workbench-diff-review.gif',
  ];
  for (const name of files) {
    await fs.copyFile(
      path.join(captures, name),
      path.join(root, 'docs/assets', name),
    );
    console.log(
      `${name}: ${(await fs.stat(path.join(captures, name))).size} bytes`,
    );
  }
} finally {
  await app?.close();
  await server?.close();
  await fs.rm(fixture, { recursive: true, force: true });
}
