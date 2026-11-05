#!/usr/bin/env node
// Deterministic Pi RPC peer for UI tests. It never calls a model or executes tools.
const fs = require('node:fs');
const readline = require('node:readline');
const args = process.argv.slice(2);
let file = args.includes('--session')
  ? args[args.indexOf('--session') + 1]
  : undefined;
// Match Pi: loading a file chooses its last non-header entry and follows
// parentId, rather than combining abandoned branches into one transcript.
let records = file
  ? fs
      .readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];
const branchMessages = () => {
  const entries = records.filter((entry) => entry.type !== 'session');
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const branch = [];
  const seen = new Set();
  let current = entries.at(-1);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.type === 'message') branch.unshift(current.message);
    current = byId.get(current.parentId);
  }
  return branch;
};
// Pi can append setup metadata while opening a session. Model that behavior
// so forks must avoid loading the source, and position checks allow only setup.
if (file) {
  const entry = {
    type: 'thinking_level_change',
    id: `setup-${process.pid}`,
    parentId: records.filter((e) => e.type !== 'session').at(-1)?.id ?? null,
    thinkingLevel: 'medium',
  };
  records.push(entry);
  fs.appendFileSync(file, '\n' + JSON.stringify(entry) + '\n');
}
let messages = branchMessages();
let promptSeq = 0;
let streaming = false;
let failState = false;
let model = {
  id: 'claude-sonnet',
  name: 'Claude Sonnet',
  provider: 'anthropic',
};
let timers = [];
const output = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const event = (type, rest = {}) => output({ type, ...rest });
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const command = JSON.parse(line);
  const reply = (data) =>
    output({
      type: 'response',
      id: command.id,
      command: command.type,
      success: true,
      data,
    });
  if (process.env.PIDEX_RPC_LOG)
    fs.appendFileSync(
      process.env.PIDEX_RPC_LOG,
      JSON.stringify({
        ...command,
        sessionFile: file,
        runtimePid: process.pid,
      }) + '\n',
    );
  switch (command.type) {
    case 'get_state':
      if (failState)
        output({
          type: 'response',
          id: command.id,
          command: command.type,
          success: false,
          error: 'Fixture state refresh failure.',
        });
      else reply({ model, isStreaming: streaming, sessionFile: file });
      break;
    case 'get_entries':
      {
        const entries = records.filter((e) => e.type !== 'session');
        const index = command.since
          ? entries.findIndex((e) => e.id === command.since)
          : -1;
        reply({
          entries: entries.slice(index + 1),
          leafId: entries.at(-1)?.id ?? null,
        });
      }

      break;
    case 'get_messages':
      reply({ messages });
      break;
    case 'get_commands':
      reply({
        commands: [
          { name: 'compact', description: 'Compact the current session' },
          {
            name: 'skill:frontend-design',
            description: 'Design a frontend',
            source: 'skill',
          },
        ],
      });
      break;
    case 'get_available_models':
      reply({
        models: [
          model,
          {
            id: 'gpt-test',
            name: 'GPT test',
            provider: 'openai',
            reasoning: true,
          },
        ],
      });
      break;
    case 'set_model':
      model = {
        id: command.modelId,
        provider: command.provider,
        name: command.modelId,
      };
      reply(model);
      break;
    case 'set_thinking_level':
      reply();
      break;
    case 'clone': {
      file = require('node:path').join(
        require('node:path').dirname(file),
        'fork.jsonl',
      );
      const entries = [
        {
          type: 'session',
          version: 3,
          id: 'fork',
          timestamp: new Date().toISOString(),
          cwd: process.cwd(),
        },
        ...messages.map((message, i) => ({
          type: 'message',
          id: `fork-${i}`,
          parentId: i ? `fork-${i - 1}` : null,
          message,
        })),
      ];
      fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n'));
      reply({ cancelled: false });
      break;
    }
    case 'abort':
      timers.forEach(clearTimeout);
      timers = [];
      streaming = false;
      event('message_end');
      event('agent_end');
      reply();
      break;
    case 'prompt': {
      if (
        command.message === 'Switch archive for test' &&
        process.env.PIDEX_RPC_SWITCH_FILE
      ) {
        file = fs.realpathSync(process.env.PIDEX_RPC_SWITCH_FILE);
        records = fs
          .readFileSync(file, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        messages = branchMessages();
        reply();
        event('agent_end');
        break;
      }
      if (command.message === 'Simulate owner state failure') failState = true;
      if (command.message === 'reject this prompt') {
        output({
          type: 'response',
          id: command.id,
          command: 'prompt',
          success: false,
          error: 'Test provider rejected the prompt.',
        });
        break;
      }
      const message = {
        role: 'user',
        content: [{ type: 'text', text: command.message }],
      };
      if (file) {
        const entry = {
          type: 'message',
          id: `prompt-${process.pid}-${++promptSeq}`,
          parentId:
            records.filter((e) => e.type !== 'session').at(-1)?.id ?? null,
          message,
        };
        records.push(entry);
        // Accept fixtures with or without a final newline.
        fs.appendFileSync(file, '\n' + JSON.stringify(entry) + '\n');
      }
      messages.push(message);
      reply();
      streaming = true;
      event('agent_start');
      event('message_start', { message: { role: 'assistant' } });
      event('message_update', {
        assistantMessageEvent: {
          type: 'text_delta',
          delta:
            'I’m checking the composer input and its toolbar before changing the shared styles.',
        },
      });
      timers.push(
        setTimeout(() => {
          streaming = false;
          event('message_end');
          event('agent_end');
        }, 3000),
      );
      if (command.message === 'stream long-session benchmark') {
        for (let i = 0; i < 30; i++)
          timers.push(
            setTimeout(
              () => {
                event('message_update', {
                  assistantMessageEvent: {
                    type: 'text_delta',
                    delta: `\n\nStreaming check ${i}: the workspace remains responsive while new output arrives.`,
                  },
                });
              },
              (i + 1) * 80,
            ),
          );
      }
      break;
    }
    default:
      reply();
  }
});
