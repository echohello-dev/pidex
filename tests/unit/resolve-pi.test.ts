import path from 'path';
import { describe, expect, it } from 'vitest';
import { resolvePi } from '../../src/main/rpc';

const home = '/Users/someone';

function existsAmong(files: string[]) {
  const set = new Set(files);
  return (file: string) => set.has(file);
}

describe('resolvePi', () => {
  it('uses a Finder-invisible Bun or Homebrew install instead of the bare name', () => {
    const bun = path.join(home, '.bun', 'bin', 'pi');
    const brew = '/opt/homebrew/bin/pi';
    const resolved = resolvePi({ PATH: '/usr/bin:/bin' }, existsAmong([bun, brew]), home);
    expect(resolved).toBe(bun);
  });

  it('uses Homebrew when the Bun install is absent', () => {
    const brew = '/opt/homebrew/bin/pi';
    const resolved = resolvePi({ PATH: '/usr/bin:/bin' }, existsAmong([brew]), home);
    expect(resolved).toBe(brew);
  });

  it('honours an absolute PIDEX_PI override', () => {
    const custom = '/opt/pi/bin/pi';
    const resolved = resolvePi({ PATH: '/usr/bin:/bin', PIDEX_PI: custom }, existsAmong([custom]), home);
    expect(resolved).toBe(custom);
  });

  it('skips a missing PIDEX_PI and keeps searching', () => {
    const brew = '/opt/homebrew/bin/pi';
    const resolved = resolvePi(
      { PATH: '/usr/bin:/bin', PIDEX_PI: '/missing/pi' },
      existsAmong([brew]),
      home,
    );
    expect(resolved).toBe(brew);
  });

  it('falls back to PATH when no known install exists', () => {
    const onPath = '/usr/local/custom/bin/pi';
    const resolved = resolvePi({ PATH: '/usr/local/custom/bin:/usr/bin' }, existsAmong([onPath]), home);
    expect(resolved).toBe(onPath);
  });

  it('returns null when pi is not installed', () => {
    expect(resolvePi({ PATH: '/usr/bin:/bin' }, () => false, home)).toBeNull();
  });
});
