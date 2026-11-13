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

async function resizeWindow(width: number, height: number) {
  const window = await app.browserWindow(page);
  await window.evaluate(
    (window, { width, height }) => window.setContentSize(width, height),
    { width, height },
  );
  // macOS can clamp a requested window to the display's available work area.
  const [actualWidth, actualHeight] = await window.evaluate((window) => window.getContentSize());
  // Device-metrics emulation can make DOM bounds disagree with captured layers.
  // Resize the real window and verify the renderer follows its content bounds.
  await page.waitForFunction(
    ({ width, height }) => innerWidth === width && innerHeight === height,
    { width: actualWidth, height: actualHeight },
  );
  expect(actualWidth).toBeGreaterThanOrEqual(900);
  expect(actualHeight).toBeGreaterThanOrEqual(600);
}

// DOM bounds alone cannot detect a stale compositor layer in a screenshot.
// Inspect the captured pixels where the footer label is meant to be painted.
async function footerPaint(screenshot: Buffer) {
  const label = await page.getByRole('button', { name: 'Fork from here', exact: true }).evaluate((button) => {
    const { x, y, width, height } = button.getBoundingClientRect();
    return {
      x, y, width, height, colour: getComputedStyle(button).color,
      hitTarget: button.contains(document.elementFromPoint(x + width / 2, y + height / 2)),
    };
  });
  return app.evaluate(({ nativeImage }, { png, label }) => {
    const image = nativeImage.createFromBuffer(Buffer.from(png, 'base64'));
    const size = image.getSize();
    const bitmap = image.toBitmap();
    const colour = label.colour.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    let textPixels = 0;
    for (let y = Math.ceil(label.y + 5); y < Math.min(size.height, label.y + label.height - 5); y++) {
      for (let x = Math.ceil(label.x + 20); x < Math.min(size.width, label.x + label.width - 20); x++) {
        const offset = (y * size.width + x) * 4;
        // Electron's bitmap is BGRA. Allow antialiasing at glyph edges.
        if (colour.every((value, channel) => Math.abs(value - bitmap[offset + 2 - channel]) < 20)) textPixels++;
      }
    }
    return { size, label, textPixels };
  }, { png: screenshot.toString('base64'), label });
}

async function captureFooter(name: string) {
  const footer = page.getByRole('button', { name: 'Fork from here', exact: true });
  // Wait for virtual-row measurement after expansion, collapse or resizing.
  await expect.poll(async () => {
    const card = await page.locator('.wb-tool').boundingBox();
    const button = await footer.boundingBox();
    return !!card && !!button && button.y >= card.y + card.height;
  }).toBe(true);
  await footer.scrollIntoViewIfNeeded();
  const screenshot = await page.screenshot({ scale: 'css' });
  const paint = await footerPaint(screenshot);
  const window = await app.browserWindow(page);
  const nativeSize = await window.evaluate((window) => window.getContentSize());
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await Promise.all([
    fs.writeFile(path.join(root, '.tmp/proof', `${name}.png`), screenshot),
    fs.writeFile(path.join(shots, `${name}.png`), screenshot),
    fs.writeFile(path.join(shots, `${name}.json`), JSON.stringify({ ...paint, nativeSize, viewport }, null, 2)),
  ]);
  expect([viewport.width, viewport.height]).toEqual(nativeSize);
  expect(paint.size).toEqual(viewport);
  expect(paint.label.hitTarget).toBe(true);
  expect(paint.textPixels, `Footer label is missing from ${name}.png`).toBeGreaterThan(8);
}

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
    await resizeWindow(1280, 1100);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /^Sessions/ }).click();
  });

  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it.each(['write', 'edit'])('bounds a long %s line and keeps the footer painted through native window resizing', async (tool) => {
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
    await captureFooter(`${tool}-bounded-preview`);

    await resizeWindow(900, 600);
    await card.getByRole('button', { name: 'Show more' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ scale: 'css', path: path.join(root, '.tmp/proof', `${tool}-bounded-narrow.png`) });
    await page.screenshot({ scale: 'css', path: path.join(shots, `${tool}-bounded-narrow.png`) });
    await captureFooter(`${tool}-footer-narrow`);
    await resizeWindow(1280, 1100);
    await captureFooter(`${tool}-footer-restored`);
    await card.locator('summary').click();
    await captureFooter(`${tool}-footer-collapsed`);
    expect(errors).toEqual([]);
  });
});
