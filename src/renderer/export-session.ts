import { toolStatus, type Entry } from './timeline';
import { sessionSummary } from './session-summary';

export type SessionExportInput = {
  title: string;
  cwd: string;
  model: string;
  exportedAt: Date;
  entries: Entry[];
  source?: {
    sessionId: string;
    archivePath: string;
    entryId: string | null;
    archiveTipId: string | null;
    canContinue: boolean;
  };
};

function inlineCode(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(runs.reduce((max, run) => Math.max(max, run.length), 0) + 1);
  const value = text.replace(/[\r\n]+/g, ' ');
  const pad = value.startsWith('`') || value.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${value}${pad}${fence}`;
}

function sourceSection(source: NonNullable<SessionExportInput['source']>): string {
  return [
    '## Saved selection',
    '',
    `- Pi session ${inlineCode(source.sessionId)}.`,
    `- Source archive ${inlineCode(source.archivePath)}.`,
    source.entryId
      ? `- Selected entry ${inlineCode(source.entryId)}${source.entryId === source.archiveTipId ? ' (archive tip)' : ''}.`
      : '- This archive has no selected conversation entry.',
    source.archiveTipId
      ? `- Archive tip at export ${inlineCode(source.archiveTipId)}.`
      : '- This archive has no conversation tip.',
    '',
    'These identifiers describe the saved selection at export time. The archive may change before you return.',
  ].join('\n');
}

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

function toolHeading(entry: Extract<Entry, { kind: 'tool' }>): string {
  const args =
    entry.args.length > 120 ? `${entry.args.slice(0, 120)}...` : entry.args;
  const summary = args ? ` / ${args}` : '';
  return `## ${entry.tool}${summary} (${toolStatus(entry)})`;
}

function handoffSection(cwd: string, source: SessionExportInput['source']): string {
  const folder = cwd.trim();
  const sameFolder = folder
    ? `Same folder (\`${folder}\`): open that root in Pidex, go to Sessions, select this session, and choose Resume. Choose Resume in new fork when continuing from an earlier entry.`
    : 'Same folder: open the original root in Pidex, go to Sessions, select this session, and choose Resume. Choose Resume in new fork when continuing from an earlier entry.';
  let continuation = sameFolder;
  if (source) {
    if (!source.canContinue || !source.entryId) {
      continuation = 'This history was readable, but Pidex could not validate it for continuation. Use this file as context in a new session, or repair the original archive in Pi before trying to resume.';
    } else {
      const action = source.entryId === source.archiveTipId ? 'Resume' : 'Resume in new fork';
      continuation = `To continue this exact selection, open the original root in Pidex, go to Sessions, find the source archive above, select entry ${inlineCode(source.entryId)}, and choose ${action}. If the archive has advanced, continuing this entry creates a new fork and preserves the source.`;
    }
  }
  return [
    '## Continue elsewhere',
    '',
    'This file is portable context, not a restorable Pi session archive.',
    '',
    `- ${continuation}`,
    '- New folder: open the destination folder as a root in Pidex, start a new session there, and share this file as context for the first message. Attach it or paste its contents.',
    '- Saved history stays with the original folder, so Resume will not find this session under a new folder.',
  ].join('\n');
}

function summarySection(entries: Entry[]): string {
  const { users, assistants, messages, tools, toolsUsed } = sessionSummary(entries);
  const lines = [
    '## Summary',
    '',
    `- ${messages} ${messages === 1 ? 'message' : 'messages'}: ${users} from you, ${assistants} from Pi.`,
  ];
  if (tools.total > 0) {
    const { done, failed, running, interrupted } = tools;
    lines.push(
      `- ${tools.total} ${tools.total === 1 ? 'tool call' : 'tool calls'}: ${done} done, ${failed} failed, ${running} running${interrupted ? `, ${interrupted} interrupted` : ''}.`,
      `- Tools used: ${toolsUsed.join(', ')}.`,
    );
  }
  return lines.join('\n');
}

export function sessionExportMarkdown(input: SessionExportInput): string {
  const parts: string[] = [
    `# ${input.title.trim() || 'Untitled session'}`,
    `Exported from pidex at ${input.exportedAt.toISOString()}.`,
  ];
  if (input.cwd.trim()) parts.push(`It ran in \`${input.cwd.trim()}\`.`);
  if (input.model.trim()) parts.push(`It used \`${input.model.trim()}\`.`);
  if (input.source) parts.push(sourceSection(input.source));
  if (input.entries.length > 0) {
    parts.push(summarySection(input.entries));
    parts.push(handoffSection(input.cwd, input.source));
  }
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
