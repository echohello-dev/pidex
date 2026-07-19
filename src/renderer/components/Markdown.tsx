import MarkdownIt from 'markdown-it';
import { useMemo } from 'react';

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
});

type MarkdownProps = {
  text: string;
  className?: string;
};

function Markdown({ text, className }: MarkdownProps) {
  const html = useMemo(() => md.render(text), [text]);
  return (
    <div
      className={['md', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export { Markdown };
export { md as markdownInstance };