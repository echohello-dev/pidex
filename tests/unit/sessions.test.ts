import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseSession } from '../../src/main/sessions';

const SESSIONS_PATH = path.join(os.homedir(), '.pi', 'agent', 'sessions');

describe('session JSONL parsing', () => {
  it('parses a synthetic session record', () => {
    const tmpFile = path.join(os.tmpdir(), `pidex-test-${Date.now()}.jsonl`);
    const lines = [
      JSON.stringify({
        type: 'session',
        version: 3,
        id: 'abc-123',
        timestamp: '2026-07-19T00:00:00.000Z',
        cwd: '/tmp/test',
      }),
      JSON.stringify({
        type: 'model_change',
        id: 'm1',
        parentId: null,
        timestamp: '2026-07-19T00:00:00.000Z',
        provider: 'openai',
        modelId: 'gpt-5',
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg1',
        parentId: 'm1',
        timestamp: '2026-07-19T00:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'hello there friend' }],
          timestamp: 0,
        },
      }),
      JSON.stringify({
        type: 'message',
        id: 'msg2',
        parentId: 'msg1',
        timestamp: '2026-07-19T00:00:01.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'hi' }],
          timestamp: 0,
        },
      }),
    ].join('\n');
    fs.writeFileSync(tmpFile, lines);
    const row = parseSession(tmpFile);
    expect(row).not.toBeNull();
    expect(row!.id).toBe('abc-123');
    expect(row!.cwd).toBe('/tmp/test');
    expect(row!.model).toBe('gpt-5');
    expect(row!.messageCount).toBe(2);
    expect(row!.title).toBe('hello there friend');
  });

  it('returns null for a file with no session header', () => {
    const tmpFile = path.join(os.tmpdir(), `pidex-empty-${Date.now()}.jsonl`);
    fs.writeFileSync(tmpFile, 'garbage\n' + JSON.stringify({ type: 'model_change', modelId: 'x' }));
    expect(parseSession(tmpFile)).toBeNull();
  });

  it('clamps long user titles to 90 chars and collapses whitespace', () => {
    const longText = 'a   b\nc\td    e    '.repeat(50);
    const tmpFile = path.join(os.tmpdir(), `pidex-long-${Date.now()}.jsonl`);
    const lines = [
      JSON.stringify({ type: 'session', id: 'x', timestamp: 't', cwd: '/x' }),
      JSON.stringify({
        type: 'message',
        message: { role: 'user', content: [{ type: 'text', text: longText }] },
      }),
    ].join('\n');
    fs.writeFileSync(tmpFile, lines);
    const row = parseSession(tmpFile);
    expect(row!.title.length).toBeLessThanOrEqual(90);
    expect(row!.title).not.toMatch(/\s{2,}/);
  });

  it('falls back to "(empty session)" placeholder when no user text', () => {
    const tmpFile = path.join(os.tmpdir(), `pidex-notext-${Date.now()}.jsonl`);
    const lines = [
      JSON.stringify({ type: 'session', id: 'y', timestamp: 't', cwd: '/y' }),
      JSON.stringify({
        type: 'message',
        message: { role: 'assistant', content: [{ type: 'text', text: 'no user msg' }] },
      }),
    ].join('\n');
    fs.writeFileSync(tmpFile, lines);
    const row = parseSession(tmpFile);
    expect(row!.title).toBe('(empty session)');
  });

  it('handles bad JSON lines without crashing', () => {
    const tmpFile = path.join(os.tmpdir(), `pidex-badjson-${Date.now()}.jsonl`);
    fs.writeFileSync(
      tmpFile,
      [
        JSON.stringify({ type: 'session', id: 'z', timestamp: 't', cwd: '/z' }),
        'not valid json {',
        JSON.stringify({
          type: 'message',
          message: { role: 'user', content: [{ type: 'text', text: 'real user msg' }] },
        }),
      ].join('\n'),
    );
    const row = parseSession(tmpFile);
    expect(row!.title).toBe('real user msg');
  });

  it('parses live pi sessions without crashing when present', () => {
    if (!fs.existsSync(SESSIONS_PATH)) return;
    const dirs = fs.readdirSync(SESSIONS_PATH).slice(0, 3);
    for (const dir of dirs) {
      const jsonl = path.join(SESSIONS_PATH, dir);
      const files = fs
        .readdirSync(jsonl)
        .filter((f: string) => f.endsWith('.jsonl'))
        .slice(0, 3);
      for (const f of files) {
        const row = parseSession(path.join(jsonl, f));
        if (row !== null) {
          expect(typeof row.id).toBe('string');
          expect(row.id.length).toBeGreaterThan(0);
        }
      }
    }
  });
});