import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkspaceRegistry } from '../../src/main/workspaces';
import { discoverSessions, sessionsForRoot } from '../../src/main/sessions';

const temporary: string[] = [];
function fixture() {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'pidex-roots-')),
  );
  temporary.push(directory);
  const root = path.join(directory, 'api');
  fs.mkdirSync(root);
  const second = path.join(directory, 'web');
  fs.mkdirSync(second);
  const data = path.join(directory, 'user-data');
  fs.mkdirSync(data);
  return { directory, root, second, data };
}
const defaults = { model: 'sonnet', provider: 'anthropic', thinking: 'high' };
afterEach(() => {
  for (const directory of temporary.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

describe('workspace registry and root discovery', () => {
  it('migrates aliases, missing and defaults-only roots without rewriting legacy files; IDs and selection survive restart', () => {
    const { directory, root, data } = fixture();
    const alias = path.join(directory, 'alias');
    fs.symlinkSync(root, alias);
    const missing = path.join(directory, 'missing');
    const legacy = JSON.stringify([alias, root, missing]);
    fs.writeFileSync(path.join(data, 'workspaces.json'), legacy);
    fs.writeFileSync(
      path.join(data, 'session-defaults.json'),
      JSON.stringify({
        [alias]: { ...defaults, thinking: 'low' },
        [root]: defaults,
        [missing]: defaults,
      }),
    );
    const registry = new WorkspaceRegistry(data);
    expect(registry.snapshot().roots).toHaveLength(2);
    const owned = registry.resolve(root);
    expect(registry.resolve(alias).id).toBe(owned.id);
    expect(owned.defaults).toEqual(defaults);
    expect(registry.resolve(missing, false).defaults).toEqual(defaults);
    expect(() => registry.resolve(missing)).toThrow(/missing or unavailable/);
    const group = registry
      .snapshot()
      .groups.find((g) => g.rootIds.includes(owned.id))!;
    registry.select(group.id, owned.id);
    expect(new WorkspaceRegistry(data).snapshot()).toEqual(registry.snapshot());
    expect(fs.readFileSync(path.join(data, 'workspaces.json'), 'utf8')).toBe(
      legacy,
    );
    expect(
      fs.readFileSync(path.join(data, 'workspaces.json.bak'), 'utf8'),
    ).toBe(legacy);
  });

  it('preserves a missing root and its history when a registered symlink breaks or is retargeted', () => {
    const { directory, root, second, data } = fixture();
    const alias = path.join(directory, 'linked');
    fs.symlinkSync(root, alias);
    const store = path.join(directory, 'sessions');
    fs.mkdirSync(store);
    fs.writeFileSync(
      path.join(store, 'source.jsonl'),
      JSON.stringify({ type: 'session', id: 'linked', cwd: alias }) + '\n',
    );
    const registry = new WorkspaceRegistry(data, discoverSessions(store));
    const original = registry.resolve(alias);
    fs.rmSync(root, { recursive: true });
    registry.discover([alias]);
    expect(registry.snapshot().roots).toHaveLength(1);
    expect(registry.resolve(alias, false).id).toBe(original.id);
    expect(
      sessionsForRoot(original.path, store, original.aliases),
    ).toHaveLength(1);
    fs.unlinkSync(alias);
    fs.symlinkSync(second, alias);
    registry.discover([alias]);
    expect(registry.snapshot().roots).toHaveLength(1);
    expect(() => registry.add(alias)).toThrow('points to a different folder');
    expect(registry.resolve(alias, false).path).toBe(original.path);
  });

  it.each([false, true])(
    'normalizes a restored missing root under a linked parent without losing identity (old record: %s)',
    (oldRecord) => {
      const { directory, data } = fixture();
      const physicalParent = path.join(directory, 'physical');
      fs.mkdirSync(physicalParent);
      const linkedParent = path.join(directory, 'linked-parent');
      fs.symlinkSync(physicalParent, linkedParent);
      const logical = path.join(linkedParent, 'project');
      const physical = path.join(physicalParent, 'project');
      const legacy = JSON.stringify([logical]);
      fs.writeFileSync(path.join(data, 'workspaces.json'), legacy);
      fs.writeFileSync(
        path.join(data, 'session-defaults.json'),
        JSON.stringify({ [logical]: defaults }),
      );
      const store = path.join(directory, 'sessions');
      fs.mkdirSync(store);
      const archive = path.join(store, 'source.jsonl');
      const source =
        JSON.stringify({
          type: 'session',
          version: 3,
          id: 'restored',
          cwd: logical,
        }) + '\n';
      fs.writeFileSync(archive, source);
      const registry = new WorkspaceRegistry(data, discoverSessions(store));
      const original = registry.resolve(logical, false);
      const group = registry.snapshot().groups[0];
      registry.select(group.id, original.id);
      if (oldRecord) {
        const saved = registry.snapshot();
        Reflect.deleteProperty(saved.roots[0], 'pathResolved');
        fs.writeFileSync(
          path.join(data, 'workspace-registry.json'),
          JSON.stringify(saved),
        );
      }
      fs.mkdirSync(physical);
      const recovered = oldRecord
        ? new WorkspaceRegistry(data, discoverSessions(store))
        : registry;
      expect(recovered.resolve(original.id).path).toBe(
        fs.realpathSync(physical),
      );
      expect(recovered.resolve(logical).id).toBe(original.id);
      expect(recovered.resolve(physical).id).toBe(original.id);
      const current = recovered.snapshot();
      expect(current.roots).toHaveLength(1);
      expect(current.roots[0].aliases).toContain(logical);
      expect(current.roots[0].defaults).toEqual(defaults);
      expect(current.groups).toEqual(registry.snapshot().groups);
      expect(current.selected).toEqual({
        groupId: group.id,
        rootId: original.id,
      });
      expect(new WorkspaceRegistry(data).resolve(original.id).path).toBe(
        physical,
      );
      expect(fs.readFileSync(archive, 'utf8')).toBe(source);
      expect(fs.readFileSync(path.join(data, 'workspaces.json'), 'utf8')).toBe(
        legacy,
      );
    },
  );

  it('does not normalize an already resolved root after its path is replaced with a symlink', () => {
    const { root, second, data } = fixture();
    const registry = new WorkspaceRegistry(data);
    const original = registry.add(root);
    fs.rmSync(root, { recursive: true });
    fs.symlinkSync(second, root);
    registry.discover([root]);
    expect(registry.resolve(original.id, false).path).toBe(root);
    expect(() => registry.resolve(original.id)).toThrow(
      'now points to another folder',
    );
  });

  it('keeps defaults-only roots, independent nested folders and roots with identical names', () => {
    const { root, second, data } = fixture();
    const nested = path.join(root, 'web');
    fs.mkdirSync(nested);
    fs.writeFileSync(
      path.join(data, 'session-defaults.json'),
      JSON.stringify({ [root]: defaults }),
    );
    const registry = new WorkspaceRegistry(data);
    registry.add(second);
    registry.add(nested);
    expect(registry.snapshot().roots).toHaveLength(3);
    expect(registry.resolve(nested).id).not.toBe(registry.resolve(second).id);
  });

  it('shares a root between groups, keeps defaults on membership changes, and rejects stale/unknown membership', () => {
    const { root, second, data } = fixture();
    const registry = new WorkspaceRegistry(data);
    const a = registry.add(root),
      b = registry.add(second);
    const group = registry.saveGroup(undefined, 'Commerce', [a.id, b.id]);
    registry.saveDefaults(a.id, defaults);
    registry.saveGroup(group.id, 'Product', [a.id], group.rootIds);
    expect(registry.resolve(a.id).defaults).toEqual(defaults);
    expect(
      registry.snapshot().groups.some((g) => g.rootIds.includes(b.id)),
    ).toBe(true);
    expect(() =>
      registry.saveGroup(group.id, 'Stale', [b.id], group.rootIds),
    ).toThrow(/membership changed/);
    expect(() => registry.saveGroup(undefined, 'Bad', ['unknown'])).toThrow(
      /known roots/,
    );
    expect(() => registry.select(group.id, b.id)).toThrow(/outside/);
  });

  it('fails closed on malformed/unknown/null registry without replacing its bytes', () => {
    const { data } = fixture();
    const file = path.join(data, 'workspace-registry.json');
    for (const invalid of [
      '{',
      'null',
      JSON.stringify({ schemaVersion: 8, roots: [], groups: [] }),
    ]) {
      fs.writeFileSync(file, invalid);
      expect(() => new WorkspaceRegistry(data)).toThrow();
      expect(fs.readFileSync(file, 'utf8')).toBe(invalid);
    }
  });

  it('ignores an interrupted temporary write and retains the last valid registry', () => {
    const { root, data } = fixture();
    const registry = new WorkspaceRegistry(data);
    registry.add(root);
    fs.writeFileSync(path.join(data, 'workspace-registry.json.tmp'), '{');
    expect(new WorkspaceRegistry(data).snapshot()).toEqual(registry.snapshot());
  });

  it('discovers each archive cwd in mixed and multiple directories without conflating copied native IDs or bad siblings', () => {
    const { directory, root, second } = fixture();
    const store = path.join(directory, 'sessions');
    fs.mkdirSync(store);
    const make = (folder: string, name: string, cwd: string) => {
      const dir = path.join(store, folder);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      fs.writeFileSync(
        file,
        JSON.stringify({
          type: 'session',
          id: 'same-native-id',
          cwd,
          timestamp: '2026-11-06T00:00:00Z',
        }) + '\n',
      );
      return file;
    };
    const first = make('mixed', 'a.jsonl', root);
    make('mixed', 'b.jsonl', second);
    make('another', 'copy.jsonl', root);
    fs.writeFileSync(path.join(store, 'mixed', 'bad.jsonl'), '{');
    expect(discoverSessions(store)).toHaveLength(3);
    expect(sessionsForRoot(root, store)).toHaveLength(2);
    expect(sessionsForRoot(second, store)).toHaveLength(1);
    const original = fs.readFileSync(first, 'utf8');
    fs.rmSync(root, { recursive: true });
    const registry = new WorkspaceRegistry(
      path.join(directory, 'new-data'),
      discoverSessions(store),
    );
    expect(registry.resolve(root, false).path).toBe(root);
    expect(sessionsForRoot(root, store)).toHaveLength(2);
    expect(fs.readFileSync(first, 'utf8')).toBe(original);
    fs.writeFileSync(
      first,
      JSON.stringify({ type: 'session', id: 'changed', cwd: second }) + '\n',
    );
    expect(sessionsForRoot(root, store)).toHaveLength(1);
    expect(sessionsForRoot(second, store)).toHaveLength(2);
  });
});
