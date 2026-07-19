import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const ELECTRON_BIN = `${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`;

let app: ElectronApplication | null = null;
let win: Page | null = null;

async function findRendererWindow(): Promise<Page | null> {
  if (!app) return null;
  for (let i = 0; i < 40; i++) {
    const candidate = app.windows().find(w => w.url().includes('localhost:5173'));
    if (candidate) return candidate;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

describe('OpenPi electron app (e2e)', () => {
  beforeAll(async () => {
    app = await electron.launch({
      args: ['.'],
      executablePath: ELECTRON_BIN,
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'development' },
    });
    win = await findRendererWindow();
    if (!win) throw new Error('renderer window not found');
    await win.waitForLoadState('load');
    await win.waitForSelector('.tab', { timeout: 30000 });
    await win.waitForTimeout(3000);
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('renders a workspace sidebar and an auto-opened first session tab', async () => {
    const wsCount = await win!.locator('.ws-row').count();
    expect(wsCount).toBeGreaterThan(0);
    const tabCount = await win!.locator('.tab').count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
  });

  it('locks document scroll so only the timeline scrolls internally', async () => {
    const dims = await win!.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(dims.bodyScrollHeight).toBeLessThanOrEqual(dims.innerHeight + 1);
  });

  it('opens a slash command menu when composer starts with /', async () => {
    const input = win!.locator('.composer-input');
    await input.click();
    await input.fill('/');
    await win!.waitForTimeout(800);
    const items = await win!.locator('.slash-item').count();
    expect(items).toBeGreaterThan(0);
    await input.fill('');
  });

  it('filters the slash menu as the user types', async () => {
    const input = win!.locator('.composer-input');
    await input.click();
    await input.fill('/mcp');
    await win!.waitForTimeout(400);
    const names = await win!.locator('.slash-name').allTextContents();
    expect(names.every(n => n.toLowerCase().includes('mcp'))).toBe(true);
    await input.fill('');
  });

  it('does not draw white button borders on tabs or session rows', async () => {
    const result = await win!.evaluate(() => {
      const targets = [
        document.querySelector('.tab'),
        document.querySelector('.ws-row'),
        document.querySelector('.session-row'),
      ].filter((n): n is Element => n !== null);
      (targets[0] as HTMLElement | null)?.focus();
      return targets.map(t => {
        const cs = getComputedStyle(t as Element);
        return {
          outline: cs.outlineWidth,
          border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
        };
      });
    });
    for (const style of result) {
      expect(style.outline).toBe('0px');
      expect(style.border.join(' ')).toBe('0px 1px 0px 0px');
    }
  });
});