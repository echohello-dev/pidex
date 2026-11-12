import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { longSession } from '../fixtures/long-session';

const root = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
let app: ElectronApplication;
let page: Page;
let fixture: string;
const shotDir = path.join(root, 'test-results/long-session');
const errors: string[] = [];
const rows = () => page.locator('.wb-transcript-row');
const scroll = async (end: boolean) => {
  await page.locator('.wb-transcript').evaluate((el, end) => {
    el.scrollTop = end ? el.scrollHeight : 0;
  }, end);
};
const settle = () =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

describe('long session in Electron', () => {
  beforeAll(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-long-'));
    await fs.mkdir(path.join(fixture, 'sessions/workspace'), {
      recursive: true,
    });
    await fs.mkdir(path.join(fixture, 'user-data'));
    await fs.mkdir(shotDir, { recursive: true });
    await fs.writeFile(
      path.join(fixture, 'sessions/workspace/long.jsonl'),
      longSession(root),
    );
    app = await electron.launch({
      executablePath: require('electron'),
      args: ['.'],
      cwd: root,
      env: {
        ...process.env,
        PIDEX_E2E_CWD: root,
        PIDEX_E2E_RENDERER_URL: inject('rendererUrl'),
        PIDEX_E2E_USER_DATA: path.join(fixture, 'user-data'),
        PIDEX_SESSIONS_ROOT: path.join(fixture, 'sessions'),
        PIDEX_PI: path.join(root, 'tests/fixtures/pi-rpc.cjs'),
      },
    });
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await page
      .getByRole('heading', { name: 'Start a session', exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
  });
  afterAll(async () => {
    await app?.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
  });

  it('opens 4,500 mixed entries with a bounded DOM and revisits them quickly', async () => {
    const start = performance.now();
    await page.locator('.wb-sidebar .wb-session-item').first().click();
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 1499', { exact: true })
      .waitFor();
    await settle();
    const openMs = performance.now() - start;
    expect(await rows().count()).toBeGreaterThan(0);
    expect(await rows().count()).toBeLessThan(80);
    const nodes = await page.locator('.wb-transcript *').count();
    await page
      .getByRole('button', { name: 'New session', exact: true })
      .click();
    const switchStart = performance.now();
    await page.locator('.wb-sidebar .wb-session-item').first().click();
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 1499', { exact: true })
      .waitFor();
    const switchMs = performance.now() - switchStart;
    await scroll(false);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    const frames = await page.locator('.wb-transcript').evaluate(async (el) => {
      const samples: number[] = [];
      let last = performance.now();
      for (let i = 0; i < 40; i++) {
        el.scrollTop += 120;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        samples.push(now - last);
        last = now;
      }
      return {
        meanFrameMs:
          samples.reduce((sum, value) => sum + value) / samples.length,
        maxFrameMs: Math.max(...samples),
      };
    });
    await scroll(true);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 1499', { exact: true })
      .waitFor();
    await fs.writeFile(
      path.join(shotDir, 'metrics.json'),
      JSON.stringify(
        {
          entries: 4500,
          openMs,
          switchMs,
          mountedRows: await rows().count(),
          nodes,
          ...frames,
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: path.join(shotDir, 'active.png') });
  });

  it('follows streaming at the bottom and lets the reader scroll away', async () => {
    await page.getByLabel('Message pi').fill('stream long-session benchmark');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText(/Streaming check 3:/).waitFor();
    await expect
      .poll(() =>
        page
          .locator('.wb-transcript')
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeLessThan(50);
    // Exercise real navigation input while the virtualizer is still correcting
    // the growing tail's height. User input must cancel that pending scroll.
    await page.locator('.wb-transcript').press('Home');
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    // The stream completes while the reader remains at the start of the archive.
    await page.getByRole('button', { name: 'Send', exact: true }).waitFor();
    // Dynamic row measurement can adjust the exact offset (including on macOS).
    // Assert the reader's first turn remains inside the viewport, rather than
    // assuming the native Home key must leave scrollTop at a particular pixel.
    const readingPosition = await page
      .locator('.wb-transcript')
      .evaluate((el) => {
        const viewport = el.getBoundingClientRect();
        const heading = el
          .querySelector('.wb-message--assistant h3')!
          .getBoundingClientRect();
        return {
          visible:
            heading.top >= viewport.top && heading.bottom <= viewport.bottom,
          distanceFromEnd: el.scrollHeight - el.scrollTop - el.clientHeight,
        };
      });
    expect(readingPosition.visible).toBe(true);
    expect(readingPosition.distanceFromEnd).toBeGreaterThan(1000);
    expect(await rows().count()).toBeLessThan(80);
    await scroll(true);
    await page.getByText(/Streaming check 29:/).waitFor();
  });

  it('respects upward wheel input during streaming', async () => {
    await page.getByLabel('Message pi').fill('stream long-session benchmark');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    const bounds = await page.locator('.wb-transcript').boundingBox();
    if (!bounds) throw new Error('The transcript is not visible.');
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.wheel(0, -3000);
    await expect
      .poll(() =>
        page
          .locator('.wb-transcript')
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeGreaterThan(500);
    await page.getByRole('button', { name: 'Send', exact: true }).waitFor();
    expect(
      await page
        .locator('.wb-transcript')
        .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    ).toBeGreaterThan(500);
  });

  it('inspects tool sections independently and retains choices after row recycling', async () => {
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await scroll(false);
    const card = page.locator('.wb-tool').first();
    await card.locator('summary').click();
    const input = card.getByRole('button', { name: 'Input details' });
    const output = card.getByRole('button', { name: 'Output details' });
    expect(await input.getAttribute('aria-expanded')).toBe('false');
    expect(await output.getAttribute('aria-expanded')).toBe('true');
    expect(await card.getByText('git diff --stat # iteration 0', { exact: true }).count()).toBe(0);
    await card.locator('pre').getByText(/1 file changed/).waitFor();
    await card.scrollIntoViewIfNeeded();
    const proof = path.join(root, '.tmp/proof');
    await fs.mkdir(proof, { recursive: true });
    await page.screenshot({ path: path.join(proof, 'tool-output-first.png') });
    await page.screenshot({ path: path.join(shotDir, 'tool-output-first.png') });

    await input.focus();
    await input.press('Enter');
    await card.getByText('git diff --stat # iteration 0', { exact: true }).waitFor();
    await output.focus();
    await output.press('Space');
    expect(await output.getAttribute('aria-expanded')).toBe('false');
    await card.getByRole('button', { name: 'Copy input' }).click();
    await card.getByRole('button', { name: 'Copy input' }).getByText('Copied', { exact: true }).waitFor();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('git diff --stat # iteration 0');

    // Remove focus from the row so the virtualizer can actually recycle it.
    await page.locator('.wb-transcript').focus();
    await scroll(true);
    await page.locator('.wb-transcript').getByText('Iteration 1499', { exact: true }).waitFor();
    await expect.poll(() => page.getByText('git diff --stat # iteration 0', { exact: true }).count()).toBe(0);
    await scroll(false);
    await page.locator('.wb-transcript').getByText('Iteration 0', { exact: true }).waitFor();
    expect(await input.getAttribute('aria-expanded')).toBe('true');
    expect(await output.getAttribute('aria-expanded')).toBe('false');
    await card.getByText('git diff --stat # iteration 0', { exact: true }).waitFor();
    expect(await card.locator('pre').count()).toBe(1);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(proof, 'tool-input-restored.png') });
    await page.screenshot({ path: path.join(shotDir, 'tool-input-restored.png') });
    await output.click();
    await card.locator('summary').click();
    await scroll(false);
    expect(errors).toEqual([]);
  });

  it('preserves selection, expansion and measured layout while browsing history', async () => {
    await page.getByRole('button', { name: /^Sessions/ }).click();
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    const tool = page.locator('.wb-tool').first();
    await tool.locator('summary').click();
    await expect.poll(() => tool.getAttribute('open')).not.toBeNull();
    await scroll(true);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 1499', { exact: true })
      .waitFor();
    await scroll(false);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    await expect
      .poll(() => page.locator('.wb-tool').first().getAttribute('open'))
      .not.toBeNull();
    const selected = await page.locator('.wb-transcript').evaluate((el) => {
      const selection = document.getSelection()!;
      const range = document.createRange();
      range.setStartBefore(el.querySelector('.wb-message--user p')!);
      range.setEndAfter(el.querySelector('.wb-message--assistant .md p')!);
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.toString();
    });
    await settle();
    await scroll(true);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 1499', { exact: true })
      .waitFor();
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(
      selected,
    );
    await page.evaluate(() => document.getSelection()?.removeAllRanges());
    await settle();
    expect(await rows().count()).toBeLessThan(80);
    await page.locator('.wb-transcript .md a').last().focus();
    await scroll(false);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('href')),
    ).toBe('https://pi.dev');
    await page.locator('.wb-transcript').focus();
    await page.setViewportSize({ width: 900, height: 600 });
    await scroll(false);
    await page
      .locator('.wb-transcript')
      .getByText('Iteration 0', { exact: true })
      .waitFor();
    await settle();
    expect(
      await page.locator('.wb-transcript').evaluate((el) => el.clientHeight),
    ).toBeGreaterThan(120);
    await expect
      .poll(() =>
        rows().evaluateAll((elements) =>
          elements
            .slice(1)
            .some(
              (el, i) =>
                elements[i].getBoundingClientRect().bottom >
                el.getBoundingClientRect().top + 1,
            ),
        ),
      )
      .toBe(false);
    await page.screenshot({ path: path.join(shotDir, 'history-narrow.png') });
    expect(errors).toEqual([]);
  });
});
