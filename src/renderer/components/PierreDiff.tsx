import { PatchDiff } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef } from 'react';

type PierreDiffProps = {
  oldFile: string;
  newFile: string;
  filename: string;
  className?: string;
};

type DiffRow = { type: '-' | '+' | ' '; text: string };

function diffLines(a: string, b: string): DiffRow[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const m = aLines.length;
  const n = bLines.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: ' ', text: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: '-', text: aLines[i++] });
    } else {
      out.push({ type: '+', text: bLines[j++] });
    }
  }
  while (i < m) out.push({ type: '-', text: aLines[i++] });
  while (j < n) out.push({ type: '+', text: bLines[j++] });
  return out;
}

function buildUnifiedPatch(filename: string, oldFile: string, newFile: string, context = 3): string {
  const rows = diffLines(oldFile, newFile);
  const header = `--- a/${filename}\n+++ b/${filename}`;
  const hunks: string[] = [];
  let i = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < rows.length) {
    while (i < rows.length && rows[i].type === ' ') {
      i++;
      oldLine++;
      newLine++;
    }
    if (i >= rows.length) break;

    const buf: string[] = [];
    let hunkOld = 0;
    let hunkNew = 0;
    let trailingContext = 0;
    let j = i;
    while (j < rows.length) {
      const r = rows[j];
      if (r.type === ' ') {
        if (buf.length > 0 && hunkOld + hunkNew > 0 && trailingContext >= context) break;
        buf.push(` ${r.text}`);
        hunkOld++;
        hunkNew++;
        trailingContext++;
        j++;
      } else if (r.type === '-') {
        buf.push(`-${r.text}`);
        hunkOld++;
        trailingContext = 0;
        j++;
      } else {
        buf.push(`+${r.text}`);
        hunkNew++;
        trailingContext = 0;
        j++;
      }
      if (buf.length > 200) break;
    }
    const startOld = oldLine;
    const startNew = newLine;
    const head = `@@ -${startOld},${hunkOld} +${startNew},${hunkNew} @@`;
    hunks.push([head, ...buf].join('\n'));

    oldLine = startOld + hunkOld;
    newLine = startNew + hunkNew;
    i = j;
  }
  return hunks.length === 0 ? '' : `${header}\n${hunks.join('\n')}`;
}

function PierreDiff({ oldFile, newFile, filename, className }: PierreDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const patch = useMemo(
    () => buildUnifiedPatch(filename, oldFile, newFile),
    [filename, oldFile, newFile],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      el.querySelectorAll('[data-diffs-row]').forEach(node => {
        const html = node as HTMLElement;
        html.style.minHeight = `${html.scrollHeight}px`;
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [patch]);

  if (!patch) {
    return (
      <div className={['pierre-diff', className].filter(Boolean).join(' ')}>
        <div className="pierre-diff-empty">no changes</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={['pierre-diff', className].filter(Boolean).join(' ')}
    >
      <PatchDiff patch={patch} options={{ theme: 'pierre-dark' }} />
    </div>
  );
}

export { PierreDiff };