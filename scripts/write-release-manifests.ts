import { mkdirSync, writeFileSync } from 'node:fs';
import { homebrewCask, scoopManifest, wingetSingleton, type ReleaseChecksums } from './release-manifests';

function parseArgs(argv: string[]): { tag: string; outDir: string; checksumsPath: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = argv[i + 1] ?? '';
    i += 1;
  }
  if (!args.tag || !args.out || !args.checksums) {
    throw new Error('usage: bun scripts/write-release-manifests.ts --tag <calver> --out <dir> --checksums <json>');
  }
  return { tag: args.tag, outDir: args.out, checksumsPath: args.checksums };
}

const { tag, outDir, checksumsPath } = parseArgs(process.argv.slice(2));
const checksums = (await Bun.file(checksumsPath).json()) as ReleaseChecksums;
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/pidex.rb`, homebrewCask(tag, checksums));
writeFileSync(`${outDir}/echoHello.Pidex.yaml`, wingetSingleton(tag, checksums));
writeFileSync(`${outDir}/pidex.json`, scoopManifest(tag, checksums));
