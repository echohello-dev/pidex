type ToolLine = { text: string; tone?: 'add' | 'del' | 'dim' };
type ToolImage = { number: number; source: string };

type Entry =
  | { key: string; kind: 'user'; text: string }
  | { key: string; kind: 'assistant'; text: string; thinking: string; streaming: boolean }
  | {
      key: string;
      kind: 'tool';
      toolId: string;
      tool: string;
      args: string;
      input: string;
      oldText?: string;
      newText?: string;
      output: string;
      images?: ToolImage[];
      running: boolean;
      ok: boolean;
      interrupted?: boolean;
    };

type AgentContent = {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

type AgentMessage = {
  role?: string;
  content?: AgentContent[];
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
};

let keySeq = 0;
const nextKey = () => `e${++keySeq}`;

function textParts(content: AgentContent[] | undefined, type: string): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter(p => p?.type === type && typeof p.text === 'string')
    .map(p => p.text as string)
    .join('\n');
}

function toolArgsSummary(name: string, args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  if (name === 'bash') return String(args.command ?? '');
  if (name === 'read' || name === 'write' || name === 'edit') {
    const p = String(args.path ?? args.file ?? '');
    if (name === 'edit' && typeof args.oldText === 'string') {
      return `${p}`;
    }
    return p;
  }
  return JSON.stringify(args).slice(0, 120);
}

function toolInputText(name: string, args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  if (name === 'bash') return String(args.command ?? '');
  if (name === 'read' || name === 'write' || name === 'edit') {
    const p = String(args.path ?? args.file ?? '');
    const parts = [p];
    if (name === 'write' && typeof args.content === 'string')
      parts.push('', args.content);
    if (name === 'edit') {
      if (typeof args.oldText === 'string') parts.push('', 'Old:', args.oldText);
      if (typeof args.newText === 'string') parts.push('', 'New:', args.newText);
    }
    if (name === 'read') {
      const range: string[] = [];
      if (typeof args.offset === 'number') range.push(`offset ${args.offset}`);
      if (typeof args.limit === 'number') range.push(`limit ${args.limit}`);
      if (range.length) parts.push(range.join(', '));
    }
    return parts.join('\n');
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function toolDiff(
  name: string,
  args: Record<string, unknown> | undefined,
): { oldText: string; newText: string } | undefined {
  if (!args) return undefined;
  if (name === 'edit' && (typeof args.oldText === 'string' || typeof args.newText === 'string'))
    return {
      oldText: typeof args.oldText === 'string' ? args.oldText : '',
      newText: typeof args.newText === 'string' ? args.newText : '',
    };
  if (name === 'write' && typeof args.content === 'string')
    return { oldText: '', newText: args.content };
  return undefined;
}

function resultOutput(content: unknown): { output: string; images: ToolImage[] } {
  const text: string[] = [];
  const images: ToolImage[] = [];
  let imageNumber = 0;
  for (const part of Array.isArray(content) ? content : []) {
    if (!part || typeof part !== 'object') continue;
    const block = part as Record<string, unknown>;
    if (block.type === 'text' && typeof block.text === 'string') text.push(block.text);
    if (block.type !== 'image') continue;
    const number = ++imageNumber;
    // Only inline raster data may reach an img src. Never load a tool-supplied
    // URL or active document format such as SVG.
    if (
      typeof block.mimeType === 'string' && /^image\/(png|jpeg|gif|webp)$/.test(block.mimeType) &&
      typeof block.data === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(block.data)
    ) {
      images.push({ number, source: `data:${block.mimeType};base64,${block.data}` });
      text.push(`Image ${number} (${block.mimeType}). Image data is omitted from text copies and exports.`);
    } else {
      text.push(`Image ${number} cannot be previewed (unsupported format or invalid image data).`);
    }
  }
  return { output: text.join('\n'), images };
}

function entriesFromMessages(messages: unknown[]): Entry[] {
  const entries: Entry[] = [];
  const tools = new Map<string, Extract<Entry, { kind: 'tool' }>>();
  for (const raw of messages) {
    const m = raw as AgentMessage;
    if (m.role === 'user') {
      const text = textParts(m.content, 'text');
      if (text) entries.push({ key: nextKey(), kind: 'user', text });
      continue;
    }
    if (m.role === 'assistant') {
      const thinking = Array.isArray(m.content)
        ? m.content
            .filter(p => p?.type === 'thinking' && typeof p.thinking === 'string')
            .map(p => p.thinking as string)
            .join('\n')
        : '';
      const text = textParts(m.content, 'text');
      if (text || thinking) {
        entries.push({ key: nextKey(), kind: 'assistant', text, thinking, streaming: false });
      }
      for (const p of m.content ?? []) {
        if (p?.type === 'toolCall' && p.id && p.name) {
          const tool: Extract<Entry, { kind: 'tool' }> = {
            key: nextKey(),
            kind: 'tool',
            toolId: p.id,
            tool: p.name,
            args: toolArgsSummary(p.name, p.arguments),
            input: toolInputText(p.name, p.arguments),
            ...toolDiff(p.name, p.arguments),
            output: '',
            running: false,
            ok: true,
            interrupted: true,
          };
          tools.set(p.id, tool);
          entries.push(tool);
        }
      }
      continue;
    }
    if (m.role === 'toolResult' && m.toolCallId) {
      const tool = tools.get(m.toolCallId);
      if (tool) {
        Object.assign(tool, resultOutput(m.content));
        tool.ok = m.isError !== true;
        tool.interrupted = false;
      }
    }
  }
  return entries;
}

function applyEvent(
  entries: Entry[],
  event: Record<string, unknown> & { type: string },
): { entries: Entry[]; running?: boolean } {
  const next = entries.slice();
  let running: boolean | undefined;

  const lastStreamingAssistant = (): number => {
    for (let i = next.length - 1; i >= 0; i--) {
      const e = next[i];
      if (e.kind === 'assistant' && e.streaming) return i;
    }
    return -1;
  };

  switch (event.type) {
    case 'agent_start':
      running = true;
      break;
    case 'agent_end':
      running = false;
      for (let i = 0; i < next.length; i++) {
        const entry = next[i];
        if (entry.kind === 'tool' && entry.running)
          next[i] = { ...entry, running: false, interrupted: true };
      }
      break;
    case 'message_start': {
      const message = event.message as AgentMessage | undefined;
      if (message?.role === 'assistant') {
        next.push({ key: nextKey(), kind: 'assistant', text: '', thinking: '', streaming: true });
      }
      break;
    }
    case 'message_update': {
      const delta = event.assistantMessageEvent as
        | { type?: string; delta?: string }
        | undefined;
      if (delta?.type === 'text_delta' && typeof delta.delta === 'string') {
        const idx = lastStreamingAssistant();
        if (idx !== -1) {
          const cur = next[idx] as Extract<Entry, { kind: 'assistant' }>;
          next[idx] = { ...cur, text: cur.text + delta.delta };
        }
      } else if (delta?.type === 'thinking_delta' && typeof delta.delta === 'string') {
        const idx = lastStreamingAssistant();
        if (idx !== -1) {
          const cur = next[idx] as Extract<Entry, { kind: 'assistant' }>;
          next[idx] = { ...cur, thinking: cur.thinking + delta.delta };
        }
      }
      break;
    }
    case 'message_end': {
      const idx = lastStreamingAssistant();
      if (idx !== -1) {
        next[idx] = { ...next[idx], streaming: false } as Entry;
      }
      break;
    }
    case 'tool_execution_start': {
      const toolCallId = String(event.toolCallId ?? nextKey());
      const toolName = String(event.toolName ?? 'tool');
      next.push({
        key: `tool-${toolCallId}`,
        kind: 'tool',
        toolId: toolCallId,
        tool: toolName,
        args: toolArgsSummary(toolName, event.args as Record<string, unknown>),
        input: toolInputText(toolName, event.args as Record<string, unknown>),
        ...toolDiff(toolName, event.args as Record<string, unknown>),
        output: '',
        running: true,
        ok: true,
      });
      break;
    }
    case 'tool_execution_update': {
      const idx = next.findIndex(e => e.kind === 'tool' && e.toolId === event.toolCallId);
      if (idx !== -1) {
        const partial = event.partialResult as { content?: unknown } | undefined;
        next[idx] = { ...next[idx], ...resultOutput(partial?.content) } as Entry;
      }
      break;
    }
    case 'tool_execution_end': {
      const idx = next.findIndex(e => e.kind === 'tool' && e.toolId === event.toolCallId);
      if (idx !== -1) {
        const result = event.result as { content?: unknown } | undefined;
        next[idx] = {
          ...next[idx],
          ...resultOutput(result?.content),
          running: false,
          ok: event.isError !== true,
          interrupted: false,
        } as Entry;
      }
      break;
    }
  }
  return { entries: next, running };
}

function toolStatus(entry: Extract<Entry, { kind: 'tool' }>): string {
  if (entry.running) return 'Running';
  if (entry.interrupted) return 'Interrupted';
  return entry.ok ? 'Done' : 'Failed';
}

export { entriesFromMessages, applyEvent, toolStatus };
export type { Entry, ToolLine, ToolImage };
