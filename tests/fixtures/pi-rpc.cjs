#!/usr/bin/env node
// Deterministic Pi RPC peer for UI tests. It never calls a model or executes tools.
const fs = require('node:fs');
const readline = require('node:readline');
const args = process.argv.slice(2);
let file = args.includes('--session')
  ? args[args.indexOf('--session') + 1]
  : undefined;
let messages = file
  ? fs
      .readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.type === 'message')
      .map((entry) => entry.message)
  : [];
let streaming = false;
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
      JSON.stringify(command) + '\n',
    );
  switch (command.type) {
    case 'get_state':
      reply({ model, isStreaming: streaming, sessionFile: file });
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
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: command.message }],
      });
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
      break;
    }
    default:
      reply();
  }
});
