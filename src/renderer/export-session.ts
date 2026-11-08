import type { Entry } from './timeline';

export type SessionExportInput = {
  title: string;
  cwd: string;
  model: string;
  exportedAt: Date;
  entries: Entry[];
};

function fenced(text: string): string {
  let longest = 0;
  let run = 0;
  for (const ch of text) {
    run = ch === '`' ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text.replace(/\n$/, '')}\n${fence}`;
}

function toolStatus(entry: Extract<Entry, { kind: 'tool' }>): string {
  if (entry.running) return 'Running';
  return entry.ok ? 'Done' : 'Failed';
}

function toolHeading(entry: Extract<Entry, { kind: 'tool' }>): string {
  const args =
    entry.args.length > 120 ? `${entry.args.slice(0, 120)}...` : entry.args;
  const summary = args ? ` / ${args}` : '';
  return `## ${entry.tool}${summary} (${toolStatus(entry)})`;
}

export function sessionExportMarkdown(input: SessionExportInput): string {
  const parts: string[] = [
    `# ${input.title.trim() || 'Untitled session'}`,
    `Exported from pidex at ${input.exportedAt.toISOString()}.`,
  ];
  if (input.cwd.trim()) parts.push(`It ran in \`${input.cwd.trim()}\`.`);
  if (input.model.trim()) parts.push(`It used \`${input.model.trim()}\`.`);
  if (input.entries.length === 0) {
    parts.push('No messages in this selection.');
    return `${parts.join('\n\n')}\n`;
  }
  for (const entry of input.entries) {
    if (entry.kind === 'user') {
      parts.push(`## You\n\n${entry.text}`);
    } else if (entry.kind === 'assistant') {
      const body: string[] = [];
      if (entry.text) body.push(entry.text);
      if (entry.thinking) body.push(`### Thinking\n\n${entry.thinking}`);
      parts.push(`## Pi\n\n${body.join('\n\n') || 'No message text.'}`);
    } else {
      const inputBlock = entry.input ? fenced(entry.input) : 'No input.';
      const outputBlock = entry.output ? fenced(entry.output) : 'No output.';
      parts.push(
        `${toolHeading(entry)}\n\n### Input\n\n${inputBlock}\n\n### Output\n\n${outputBlock}`,
      );
    }
  }
  return `${parts.join('\n\n')}\n`;
}

export function sessionExportFilename(title: string, exportedAt: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  const day = exportedAt.toISOString().slice(0, 10);
  return `pidex-${slug || 'session'}-${day}.md`;
}
