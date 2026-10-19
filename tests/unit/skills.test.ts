import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listSkills } from '../../src/main/workbench';

let root: string;
let home: string;
let project: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pidex-skills-'));
  home = path.join(root, 'home');
  project = path.join(root, 'project');
  vi.spyOn(os, 'homedir').mockReturnValue(home);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
async function skill(dir: string, text: string) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'SKILL.md'), text);
}

describe('installed skill discovery', () => {
  it('finds global and workspace skills, reads metadata and falls back to the directory name', async () => {
    await skill(
      path.join(home, '.pi/agent/skills/global'),
      '---\nname: "global-name"\ndescription: \'Reusable instructions\'\n---\nBody',
    );
    await skill(
      path.join(project, '.agents/skills/fallback'),
      'Instructions without metadata',
    );
    const result = await listSkills(project);
    expect(result).toEqual([
      {
        name: 'global-name',
        description: 'Reusable instructions',
        file: path.join(home, '.pi/agent/skills/global/SKILL.md'),
        source: 'Global',
      },
      {
        name: 'fallback',
        description: '',
        file: path.join(project, '.agents/skills/fallback/SKILL.md'),
        source: 'Workspace',
      },
    ]);
  });

  it('follows linked skills once and terminates directory cycles', async () => {
    const dir = path.join(project, '.pi/skills/original');
    await skill(dir, '---\nname: original\n---\nBody');
    await fs.symlink(dir, path.join(project, '.pi/skills/alias'));
    await fs.symlink(path.dirname(dir), path.join(dir, 'loop'));
    const result = await listSkills(project);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('original');
    expect(result[0].source).toBe('Workspace');
  });

  it('skips broken links and unreadable skill files without hiding the remaining skills', async () => {
    const dir = path.join(project, '.pi/skills');
    await fs.mkdir(dir, { recursive: true });
    await fs.symlink(path.join(root, 'missing'), path.join(dir, 'a-broken'));
    await skill(path.join(dir, 'b-binary'), '\0binary');
    await skill(path.join(dir, 'z-valid'), 'Valid instructions');
    expect((await listSkills(project)).map((entry) => entry.name)).toEqual([
      'z-valid',
    ]);
  });
});
