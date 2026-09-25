import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  homebrewCask,
  latestHomebrewCask,
  scoopManifest,
  versionsFromCalver,
  wingetSingleton,
} from '../../scripts/release-manifests';

const checksums = {
  'pidex-mac-arm64.dmg': 'aaa'.repeat(21) + 'aa',
  'pidex-mac-x64.dmg': 'bbb'.repeat(21) + 'bb',
  'pidex-win-x64.exe': 'ccc'.repeat(21) + 'cc',
  'pidex-linux-x64.AppImage': 'ddd'.repeat(21) + 'dd',
};

describe('versionsFromCalver', () => {
  it('maps a first-of-day tag onto semver and winget versions', () => {
    expect(versionsFromCalver('2026.08.09')).toEqual({
      tag: '2026.08.09',
      semver: '2026.8.9',
      winget: '2026.8.9',
    });
  });

  it('maps a same-day suffix onto a semver prerelease and a dotted winget build', () => {
    expect(versionsFromCalver('2026.08.09-2')).toEqual({
      tag: '2026.08.09-2',
      semver: '2026.8.9-2',
      winget: '2026.8.9.2',
    });
  });

  it('rejects a non-calver tag', () => {
    expect(() => versionsFromCalver('v1.2.3')).toThrow(/invalid calver tag/);
  });
});

describe('release manifests', () => {
  it('writes a versioned homebrew cask with per-arch checksums', () => {
    const cask = homebrewCask('2026.08.09-2', checksums);
    expect(cask).toContain('version "2026.08.09-2"');
    expect(cask).toContain(checksums['pidex-mac-arm64.dmg']);
    expect(cask).toContain('pidex-mac-#{arch}.dmg');
    expect(cask).toContain('app "pidex.app"');
  });

  it('keeps the tap cask pointed at latest/download', () => {
    const cask = latestHomebrewCask();
    expect(cask).toContain('version :latest');
    expect(cask).toContain('sha256 :no_check');
    expect(cask).toContain('releases/latest/download/pidex-mac-#{arch}.dmg');
    const onDisk = readFileSync(path.join(process.cwd(), 'Casks/pidex.rb'), 'utf8');
    expect(onDisk).toBe(cask);
  });

  it('writes a winget singleton with the NSIS installer', () => {
    const yaml = wingetSingleton('2026.08.09-2', checksums);
    expect(yaml).toContain('PackageIdentifier: echoHello.Pidex');
    expect(yaml).toContain('Publisher: echoHello');
    expect(yaml).toContain('PackageVersion: 2026.8.9.2');
    expect(yaml).toContain('InstallerType: nullsoft');
    expect(yaml).toContain('pidex-win-x64.exe');
    expect(yaml).toContain(checksums['pidex-win-x64.exe'].toUpperCase());
  });

  it('writes a scoop manifest that checkver can follow', () => {
    const json = JSON.parse(scoopManifest('2026.08.09-2', checksums)) as {
      version: string;
      architecture: { '64bit': { hash: string } };
    };
    expect(json.version).toBe('2026.08.09-2');
    expect(json.architecture['64bit'].hash).toBe(checksums['pidex-win-x64.exe']);
  });

  it('fails closed when a required checksum is missing', () => {
    expect(() => homebrewCask('2026.08.09', {})).toThrow(/missing checksum/);
  });
});
