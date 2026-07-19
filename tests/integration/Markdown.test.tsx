import { describe, expect, it, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Markdown } from '../../src/renderer/components/Markdown';

describe('<Markdown>', () => {
  beforeEach(() => cleanup());

  it('renders headings, paragraphs, and bold', () => {
    const { container } = render(
      <Markdown text="# Hello\n\nWorld **strong** here." />,
    );
    expect(container.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toContain('Hello');
    expect(container.querySelector('strong')?.textContent).toBe('strong');
    expect(container.textContent ?? '').toContain('World');
  });

  it('renders inline code with monospace styling', () => {
    const { container } = render(<Markdown text="use `npm install`" />);
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('npm install');
  });

  it('renders fenced code blocks', () => {
    const text = '```js\nconst x = 1;\nconsole.log(x);\n```';
    const { container } = render(<Markdown text={text} />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')?.textContent).toContain('const x = 1');
  });

  it('escapes raw HTML so scripts cannot execute', () => {
    const { container } = render(
      <Markdown text='<script>alert("xss")</script>\n\nhello' />,
    );
    expect(container.querySelector('script')).toBeNull();
    const html = container.innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders unordered lists with list items', () => {
    const { container } = render(
      <Markdown text={'- one\n- two\n- three'} />,
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toBe('one');
    expect(items[2]?.textContent).toBe('three');
  });

  it('renders GFM tables when enabled', () => {
    const text = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    const { container } = render(<Markdown text={text} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('renders blockquotes with accent left border', () => {
    const { container } = render(<Markdown text="> a quoted line" />);
    const bq = container.querySelector('blockquote');
    expect(bq).not.toBeNull();
    expect(bq?.textContent?.trim()).toBe('a quoted line');
  });

  it('renders links', () => {
    const { container } = render(
      <Markdown text="see [pi](https://pi.dev) for details" />,
    );
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://pi.dev');
    expect(a?.textContent).toBe('pi');
  });
});