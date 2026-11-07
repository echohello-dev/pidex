import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { canonicalCwd, type SessionInfo } from './sessions';
import { DEFAULTS, validateDefaults, type Defaults } from './workbench';

export type WorkspaceRoot = {
  id: string;
  path: string;
  pathResolved?: boolean;
  aliases: string[];
  defaults: Defaults;
};
export type WorkspaceGroup = { id: string; name: string; rootIds: string[] };
export type Registry = {
  schemaVersion: 1;
  roots: WorkspaceRoot[];
  groups: WorkspaceGroup[];
  selected?: { groupId: string; rootId: string };
  legacyDefaults: Record<string, Defaults>;
};
export type Availability = 'available' | 'missing' | 'unavailable';

export function availability(cwd: string): Availability {
  try {
    if (!fs.statSync(cwd).isDirectory()) return 'missing';
    fs.accessSync(cwd, fs.constants.R_OK | fs.constants.X_OK);
    return 'available';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'missing'
      : 'unavailable';
  }
}

function readJson(file: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw new Error(
      `Cannot read ${path.basename(file)}. Restore a valid backup before continuing.`,
    );
  }
}

function validate(value: unknown): Registry {
  const v = value as Registry | null;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    !Array.isArray(v.roots) ||
    !Array.isArray(v.groups)
  )
    throw new Error(
      'Invalid workspace registry version or contents. Restore a valid backup before continuing.',
    );
  const ids = new Set<string>();
  for (const root of v.roots) {
    if (
      !root ||
      typeof root.id !== 'string' ||
      !root.id ||
      ids.has(root.id) ||
      typeof root.path !== 'string' ||
      !path.isAbsolute(root.path) ||
      (root.pathResolved !== undefined &&
        typeof root.pathResolved !== 'boolean') ||
      !Array.isArray(root.aliases) ||
      !root.aliases.every((p) => typeof p === 'string' && path.isAbsolute(p))
    )
      throw new Error('Invalid workspace root record.');
    validateDefaults(root.defaults);
    ids.add(root.id);
  }
  const groupIds = new Set<string>();
  for (const group of v.groups) {
    if (
      !group ||
      typeof group.id !== 'string' ||
      !group.id ||
      groupIds.has(group.id) ||
      typeof group.name !== 'string' ||
      !group.name.trim() ||
      !Array.isArray(group.rootIds) ||
      new Set(group.rootIds).size !== group.rootIds.length ||
      !group.rootIds.every((id) => ids.has(id))
    )
      throw new Error('Invalid workspace group record.');
    groupIds.add(group.id);
  }
  if (
    v.selected &&
    !v.groups.some(
      (g) =>
        g.id === v.selected?.groupId && g.rootIds.includes(v.selected.rootId),
    )
  )
    throw new Error('Invalid saved workspace selection.');
  if (
    !v.legacyDefaults ||
    typeof v.legacyDefaults !== 'object' ||
    Array.isArray(v.legacyDefaults)
  )
    throw new Error('Invalid workspace migration provenance.');
  return v;
}

/** Main owns synchronous, atomic registry transactions. Native archives are never written here. */
export class WorkspaceRegistry {
  private state: Registry;
  private file: string;
  constructor(
    private directory: string,
    discovered: SessionInfo[] = [],
    extra: string[] = [],
  ) {
    this.file = path.join(directory, 'workspace-registry.json');
    const saved = readJson(this.file, undefined);
    if (saved !== undefined) this.state = validate(saved);
    else {
      const folders = readJson(path.join(directory, 'workspaces.json'), []);
      const defaults = readJson(
        path.join(directory, 'session-defaults.json'),
        {},
      );
      if (
        !Array.isArray(folders) ||
        !folders.every((p) => typeof p === 'string') ||
        !defaults ||
        typeof defaults !== 'object' ||
        Array.isArray(defaults)
      )
        throw new Error(
          'Invalid legacy workspace records. Restore a valid backup before continuing.',
        );
      const legacyDefaults: Record<string, Defaults> = {};
      for (const [cwd, value] of Object.entries(defaults))
        legacyDefaults[cwd] = validateDefaults(value);
      this.state = { schemaVersion: 1, roots: [], groups: [], legacyDefaults };
      // Exact canonical key wins, then lexical alias order. Preserve all original values.
      for (const cwd of [
        ...new Set([
          ...folders,
          ...Object.keys(defaults),
          ...extra,
          ...discovered.map((s) => s.cwd),
        ]),
      ]
        .filter((p) => path.isAbsolute(p))
        .sort())
        this.addRootTo(this.state, cwd);
      for (const root of this.state.roots) {
        const key = legacyDefaults[root.path]
          ? root.path
          : root.aliases.find((p) => legacyDefaults[p]);
        root.defaults = key ? legacyDefaults[key] : { ...DEFAULTS };
      }
      fs.mkdirSync(directory, { recursive: true });
      for (const name of ['workspaces.json', 'session-defaults.json']) {
        try {
          fs.copyFileSync(
            path.join(directory, name),
            path.join(directory, `${name}.bak`),
            fs.constants.COPYFILE_EXCL,
          );
        } catch (error) {
          if (
            !['ENOENT', 'EEXIST'].includes(
              (error as NodeJS.ErrnoException).code ?? '',
            )
          )
            throw error;
        }
      }
      this.commit(this.state);
    }
    this.discover([...extra, ...discovered.map((s) => s.cwd)]);
  }
  snapshot(): Registry {
    return structuredClone(this.state);
  }
  private commit(next: Registry) {
    validate(next);
    fs.mkdirSync(this.directory, { recursive: true });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2));
    fs.renameSync(temporary, this.file);
    this.state = next;
  }
  // Only paths that were unresolved may acquire their canonical spelling.
  // A previously pinned path must never follow a newly retargeted symlink.
  private normalizePaths(next: Registry) {
    for (const root of next.roots) {
      if (root.pathResolved) continue;
      if (availability(root.path) !== 'available') {
        root.pathResolved = false;
        continue;
      }
      const previous = root.path;
      try {
        root.path = fs.realpathSync(previous);
        root.pathResolved = true;
        if (!root.aliases.includes(previous)) root.aliases.push(previous);
      } catch {
        root.pathResolved = false;
      }
    }
  }
  private addRootTo(next: Registry, cwd: string): WorkspaceRoot {
    if (typeof cwd !== 'string' || !path.isAbsolute(cwd))
      throw new Error('Choose an absolute folder path.');
    let canonical = path.resolve(cwd);
    let pathResolved = false;
    try {
      canonical = fs.realpathSync(cwd);
      pathResolved = availability(canonical) === 'available';
    } catch {
      /* Preserve a missing root's lexical path until it can be resolved. */
    }
    const existing = next.roots.find(
      (r) =>
        r.aliases.some((alias) => path.resolve(alias) === path.resolve(cwd)) ||
        canonicalCwd(r.path) === canonical,
    );
    if (existing) {
      if (!existing.aliases.includes(cwd)) existing.aliases.push(cwd);
      return existing;
    }
    const root = {
      id: randomUUID(),
      path: canonical,
      pathResolved,
      aliases: [cwd],
      defaults: { ...DEFAULTS },
    };
    next.roots.push(root);
    next.groups.push({
      id: randomUUID(),
      name: path.basename(canonical) || canonical,
      rootIds: [root.id],
    });
    return root;
  }
  discover(cwds: string[]) {
    const next = this.snapshot();
    this.normalizePaths(next);
    for (const cwd of cwds) if (path.isAbsolute(cwd)) this.addRootTo(next, cwd);
    if (JSON.stringify(next) !== JSON.stringify(this.state)) this.commit(next);
  }
  add(cwd: string, groupId?: string): WorkspaceRoot {
    if (availability(cwd) !== 'available')
      throw new Error('Choose an available folder.');
    const next = this.snapshot();
    this.normalizePaths(next);
    const group = groupId
      ? next.groups.find((g) => g.id === groupId)
      : undefined;
    if (groupId && !group) throw new Error('Unknown workspace group.');
    const root = this.addRootTo(next, cwd);
    if (canonicalCwd(root.path) !== canonicalCwd(cwd))
      throw new Error(
        "This registered alias points to a different folder. Add the folder's real path instead.",
      );
    if (group && !group.rootIds.includes(root.id)) group.rootIds.push(root.id);
    this.commit(next);
    return root;
  }
  resolve(cwdOrId: unknown, requireAvailable = true): WorkspaceRoot {
    let root =
      typeof cwdOrId === 'string'
        ? (this.state.roots.find(
            (r) =>
              r.id === cwdOrId ||
              r.path === cwdOrId ||
              (path.isAbsolute(cwdOrId) &&
                r.aliases.some(
                  (alias) => path.resolve(alias) === path.resolve(cwdOrId),
                )),
          ) ??
          (path.isAbsolute(cwdOrId)
            ? this.state.roots.find(
                (r) => canonicalCwd(r.path) === canonicalCwd(cwdOrId),
              )
            : undefined))
        : undefined;
    if (root && !root.pathResolved && availability(root.path) === 'available') {
      const id = root.id;
      const next = this.snapshot();
      this.normalizePaths(next);
      this.commit(next);
      root = next.roots.find((candidate) => candidate.id === id);
    }
    if (!root) throw new Error('Unknown workspace root.');
    if (requireAvailable && availability(root.path) !== 'available')
      throw new Error(
        'Workspace root is missing or unavailable. Restore its original folder to continue.',
      );
    if (requireAvailable && canonicalCwd(root.path) !== root.path)
      throw new Error(
        'The registered root path now points to another folder. Restore its original location before continuing.',
      );
    return structuredClone(root);
  }
  saveDefaults(cwd: unknown, value: unknown): Defaults {
    const root = this.resolve(cwd, false);
    const defaults = validateDefaults(value);
    const next = this.snapshot();
    next.roots.find((r) => r.id === root.id)!.defaults = defaults;
    this.commit(next);
    return defaults;
  }
  saveGroup(
    id: unknown,
    name: unknown,
    rootIds: unknown,
    expectedRoots?: string[],
  ): WorkspaceGroup {
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 100 ||
      !Array.isArray(rootIds) ||
      !rootIds.every(
        (r) =>
          typeof r === 'string' &&
          this.state.roots.some((root) => root.id === r),
      )
    )
      throw new Error('Choose a workspace name and known roots.');
    const next = this.snapshot();
    let group = next.groups.find((g) => g.id === id);
    if (id && !group) throw new Error('Unknown workspace group.');
    if (
      group &&
      JSON.stringify(group.rootIds) !== JSON.stringify(expectedRoots)
    )
      throw new Error(
        'Workspace membership changed. Reopen its settings before saving.',
      );
    if (!group) {
      group = { id: randomUUID(), name: '', rootIds: [] };
      next.groups.push(group);
    }
    group.name = name.trim();
    group.rootIds = [...new Set<string>(rootIds)];
    if (
      next.selected?.groupId === group.id &&
      !group.rootIds.includes(next.selected.rootId)
    )
      next.selected = undefined;
    // Orphaned roots remain reachable in a singleton group.
    for (const root of next.roots)
      if (!next.groups.some((g) => g.rootIds.includes(root.id)))
        next.groups.push({
          id: randomUUID(),
          name: path.basename(root.path),
          rootIds: [root.id],
        });
    this.commit(next);
    return group;
  }
  select(groupId: string, rootId: string) {
    const next = this.snapshot();
    if (
      !next.groups.some((g) => g.id === groupId && g.rootIds.includes(rootId))
    )
      throw new Error('Root is outside this workspace group.');
    next.selected = { groupId, rootId };
    this.commit(next);
  }
}
