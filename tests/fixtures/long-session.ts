/** Mixed Markdown, code, thinking and tool output from a long coding session. */
export function longSession(cwd: string, turns = 1500) {
  const records: object[] = [
    {
      type: 'session',
      id: 'long-session',
      cwd,
      timestamp: new Date().toISOString(),
    },
  ];
  let parentId: string | null = null;
  const message = (id: string, value: object) => {
    records.push({ type: 'message', id, parentId, message: value });
    parentId = id;
  };
  for (let turn = 0; turn < turns; turn++) {
    message(`user-${turn}`, {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Review iteration ${turn}: check the workspace changes and explain the next step.`,
        },
      ],
    });
    message(`assistant-${turn}`, {
      role: 'assistant',
      content: [
        {
          type: 'thinking',
          thinking:
            'Check the current branch and validate the parser against the existing fixtures.',
        },
        {
          type: 'text',
          text: `### Iteration ${turn}\n\nThe workspace parser now handles **partial writes** and preserves the current session branch. ${'Long sessions should remain responsive when switching workspaces. '.repeat((turn % 5) + 1)}\n\n- Inspect the current changes\n- Run the focused tests\n\n\`\`\`ts\nconst iteration = ${turn};\nawait inspectWorkspace(cwd);\n\`\`\`\n\nSee [the documentation](https://pi.dev) for the runtime protocol.`,
        },
        {
          type: 'toolCall',
          id: `tool-${turn}`,
          name: 'bash',
          arguments: { command: `git diff --stat # iteration ${turn}` },
        },
      ],
    });
    message(`result-${turn}`, {
      role: 'toolResult',
      toolCallId: `tool-${turn}`,
      toolName: 'bash',
      content: [
        {
          type: 'text',
          text: `Iteration ${turn}\n${'src/main/sessions.ts | 12 ++++++------\n'.repeat((turn % 8) + 1)}1 file changed.`,
        },
      ],
    });
  }
  return records.map((record) => JSON.stringify(record)).join('\n');
}
