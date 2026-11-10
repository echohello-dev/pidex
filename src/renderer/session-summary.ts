import { toolStatus, type Entry } from './timeline';

const EXCERPT_LIMIT = 240;

function excerpt(text: string): string {
  const plain = text.replace(/\s+/g, ' ').trim();
  return plain.length > EXCERPT_LIMIT
    ? `${plain.slice(0, EXCERPT_LIMIT - 3)}...`
    : plain;
}

export function sessionSummary(entries: Entry[]) {
  let users = 0;
  let assistants = 0;
  let latestRequest = '';
  let latestReply = '';
  const tools = { total: 0, done: 0, failed: 0, running: 0, interrupted: 0 };
  const toolsUsed = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === 'user') {
      users++;
      if (entry.text.trim()) latestRequest = excerpt(entry.text);
    } else if (entry.kind === 'assistant') {
      assistants++;
      if (entry.text.trim()) latestReply = excerpt(entry.text);
    } else {
      tools.total++;
      toolsUsed.add(entry.tool);
      switch (toolStatus(entry)) {
        case 'Done':
          tools.done++;
          break;
        case 'Failed':
          tools.failed++;
          break;
        case 'Running':
          tools.running++;
          break;
        case 'Interrupted':
          tools.interrupted++;
          break;
      }
    }
  }
  return {
    messages: users + assistants,
    users,
    assistants,
    tools,
    toolsUsed: [...toolsUsed],
    latestRequest,
    latestReply,
  };
}
