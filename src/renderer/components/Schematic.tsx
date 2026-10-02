import { useId, type CSSProperties } from 'react';
import type { MascotState } from './LiveMascots';
import { SealStamp } from './Stamps';

/**
 * A technical drawing of the Glyph, in the pi.dev blueprint inks: a dimensioned elevation,
 * an exploded view with a parts list, the session state diagram, and a title block.
 * Reads its inks from a surrounding PiSurface.
 */

const W = 1200;
const H = 760;

// The mark on its grid. Item numbers match the parts list.
const PARTS: { cx: number; cy: number; item: number }[] = [
  { cx: 0, cy: 0, item: 1 },
  { cx: 1, cy: 0, item: 1 },
  { cx: 2, cy: 0, item: 1 },
  { cx: 2, cy: 1, item: 2 },
  { cx: 0, cy: 1, item: 3 },
  { cx: 0, cy: 2, item: 3 },
  { cx: 0, cy: 3, item: 3 },
  { cx: 1, cy: 2, item: 4 },
  { cx: 3, cy: 2, item: 5 },
  { cx: 3, cy: 3, item: 5 },
];

// Which way each item's balloon points, so it clears the other cells when the view closes up.
const BALLOON: Record<number, [number, number]> = { 1: [-1, -1], 2: [1, -1], 3: [-1, 1], 4: [0, 1], 5: [1, 1] };

const BOM = [
  { item: 1, qty: 3, part: 'BAR', note: 'Carries the eyes' },
  { item: 2, qty: 1, part: 'JAMB', note: 'Right of the counter' },
  { item: 3, qty: 3, part: 'STEM', note: 'Left column' },
  { item: 4, qty: 1, part: 'HEEL', note: 'Closes the counter' },
  { item: 5, qty: 2, part: 'DOT', note: 'Takes the state ink' },
];

type NodeId = MascotState;

const NODES: { id: NodeId; label: string; x: number; y: number }[] = [
  { id: 'idle', label: 'IDLE', x: 50, y: 560 },
  { id: 'thinking', label: 'RUNNING', x: 256, y: 560 },
  { id: 'input', label: 'YOUR TURN', x: 440, y: 484 },
  { id: 'blocked', label: 'BLOCKED', x: 440, y: 636 },
  { id: 'done', label: 'SHIPPED', x: 620, y: 560 },
];

const NODE_W = 132;
const NODE_H = 40;

function node(id: NodeId) {
  const n = NODES.find((entry) => entry.id === id)!;
  return { ...n, cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2, r: n.x + NODE_W, b: n.y + NODE_H };
}

const EDGES: { from: NodeId; to: NodeId; d: () => string; label?: string }[] = [
  { from: 'idle', to: 'thinking', d: () => `M${node('idle').r} ${node('idle').cy} H${node('thinking').x - 4}`, label: 'prompt' },
  { from: 'thinking', to: 'input', d: () => `M${node('thinking').cx + 20} ${node('thinking').y} V${node('input').cy} H${node('input').x - 4}`, label: 'asks' },
  { from: 'input', to: 'thinking', d: () => `M${node('input').cx} ${node('input').b} V${node('thinking').y + 8} H${node('thinking').r + 4}` },
  { from: 'thinking', to: 'blocked', d: () => `M${node('thinking').cx + 20} ${node('thinking').b} V${node('blocked').cy} H${node('blocked').x - 4}`, label: 'fails' },
  { from: 'blocked', to: 'thinking', d: () => `M${node('blocked').cx} ${node('blocked').y} V${node('thinking').b - 8} H${node('thinking').r + 4}` },
  { from: 'thinking', to: 'done', d: () => `M${node('thinking').r} ${node('thinking').cy} H${node('done').x - 4}`, label: 'lands' },
  { from: 'done', to: 'idle', d: () => `M${node('done').cx} ${node('done').b} V${node('blocked').b + 22} H${node('idle').cx} V${node('idle').b + 4}`, label: 'next prompt' },
];

function DimH({ x1, x2, y, from, label, marker }: { x1: number; x2: number; y: number; from: number; label: string; marker: string }) {
  return (
    <g className="ds-bp-dim">
      <path className="ds-bp-ext" d={`M${x1} ${from} V${y - 6} M${x2} ${from} V${y - 6}`} />
      <path className="ds-bp-dimline" pathLength={1} d={`M${x1} ${y} H${x2}`} markerStart={`url(#${marker})`} markerEnd={`url(#${marker})`} />
      <text className="ds-bp-label" x={(x1 + x2) / 2} y={y - 8} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function DimV({ y1, y2, x, from, label, marker }: { y1: number; y2: number; x: number; from: number; label: string; marker: string }) {
  const side = x < from ? -1 : 1;
  return (
    <g className="ds-bp-dim">
      <path className="ds-bp-ext" d={`M${from} ${y1} H${x + side * 6} M${from} ${y2} H${x + side * 6}`} />
      <path className="ds-bp-dimline" pathLength={1} d={`M${x} ${y1} V${y2}`} markerStart={`url(#${marker})`} markerEnd={`url(#${marker})`} />
      <text className="ds-bp-label" x={x + side * 10} y={(y1 + y2) / 2 + 4} textAnchor={side < 0 ? 'end' : 'start'}>
        {label}
      </text>
    </g>
  );
}

function Callout({ n, x, y, lx, ly, text }: { n: number; x: number; y: number; lx: number; ly: number; text: string }) {
  return (
    <g className="ds-bp-callout" style={{ '--n': n } as CSSProperties}>
      <circle className="ds-bp-pin" cx={x} cy={y} r="3" />
      <path className="ds-bp-leader" d={`M${x} ${y} L${lx - 26} ${ly} H${lx - 14}`} />
      <circle className="ds-bp-balloon" cx={lx} cy={ly} r="11" />
      <text className="ds-bp-label ds-bp-balloon-n" x={lx} y={ly + 4} textAnchor="middle">
        {n}
      </text>
      <text className="ds-bp-label" x={lx + 18} y={ly + 4}>
        {text}
      </text>
    </g>
  );
}

const STATE_WORD: Record<MascotState, string> = {
  idle: 'IDLE',
  thinking: 'RUNNING',
  input: 'YOUR TURN',
  blocked: 'BLOCKED',
  done: 'SHIPPED',
};

function GlyphSchematic({ state, date = '01 OCT 2026' }: { state: MascotState; date?: string }) {
  const id = useId().replace(/:/g, '');
  const arrow = `bp-arrow-${id}`;
  const arrowHot = `bp-arrow-hot-${id}`;

  // Front elevation, u = 44.
  const u = 44;
  const ox = 116;
  const oy = 148;
  const X = (n: number) => ox + n * u;
  const Y = (n: number) => oy + n * u;
  const pD = `M${X(0)} ${Y(0)} H${X(3)} V${Y(2)} H${X(2)} V${Y(3)} H${X(1)} V${Y(4)} H${X(0)} Z M${X(1)} ${Y(1)} V${Y(2)} H${X(2)} V${Y(1)} Z`;

  // Exploded view origin and cell size.
  const ex = 690;
  const ey = 110;
  const s = 38;

  const zonesX = [1, 2, 3, 4, 5, 6];
  const zonesY = ['A', 'B', 'C', 'D'];

  return (
    <svg className="ds-bp-sheet" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Technical drawing of the Glyph, state ${STATE_WORD[state]}`} data-state={state}>
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path className="ds-bp-arrow" d="M0 1 L10 5 L0 9 Z" />
        </marker>
        <marker id={arrowHot} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path className="ds-bp-arrow ds-bp-arrow--hot" d="M0 1 L10 5 L0 9 Z" />
        </marker>
      </defs>

      {/* Sheet border with zone references */}
      <rect className="ds-bp-frame" x="10" y="10" width={W - 20} height={H - 20} />
      <rect className="ds-bp-frame ds-bp-frame--inner" x="30" y="30" width={W - 60} height={H - 60} />
      {zonesX.map((z, i) => {
        const x = 30 + ((W - 60) / 6) * i;
        return (
          <g key={z}>
            {i > 0 ? <path className="ds-bp-ext" d={`M${x} 10 V30 M${x} ${H - 30} V${H - 10}`} /> : null}
            <text className="ds-bp-label ds-bp-zone" x={x + (W - 60) / 12} y="24" textAnchor="middle">{z}</text>
            <text className="ds-bp-label ds-bp-zone" x={x + (W - 60) / 12} y={H - 16} textAnchor="middle">{z}</text>
          </g>
        );
      })}
      {zonesY.map((z, i) => {
        const y = 30 + ((H - 60) / 4) * i;
        return (
          <g key={z}>
            {i > 0 ? <path className="ds-bp-ext" d={`M10 ${y} H30 M${W - 30} ${y} H${W - 10}`} /> : null}
            <text className="ds-bp-label ds-bp-zone" x="20" y={y + (H - 60) / 8 + 4} textAnchor="middle">{z}</text>
            <text className="ds-bp-label ds-bp-zone" x={W - 20} y={y + (H - 60) / 8 + 4} textAnchor="middle">{z}</text>
          </g>
        );
      })}

      {/* Front elevation */}
      <g className="ds-bp-view">
        {[0, 1, 2, 3, 4].map((n) => (
          <path key={`v${n}`} className="ds-bp-construct" d={`M${X(n)} ${oy - 18} V${Y(4) + 18}`} />
        ))}
        {[0, 1, 2, 3, 4].map((n) => (
          <path key={`h${n}`} className="ds-bp-construct" d={`M${ox - 18} ${Y(n)} H${X(4) + 18}`} />
        ))}
        <path className="ds-bp-center" d={`M${X(2)} ${oy - 34} V${Y(4) + 34}`} />
        <path className="ds-pm-fill ds-bp-part" fillRule="evenodd" d={pD} />
        <rect className="ds-pm-fill ds-pm-dot ds-bp-part" x={X(3)} y={Y(2)} width={u} height={2 * u} />
        <g className="ds-pm-eyes">
          <rect className="ds-pm-eye ds-bp-eye" x={X(0.4)} y={Y(0.22)} width={u * 0.26} height={u * 0.5} />
          <rect className="ds-pm-eye ds-bp-eye" x={X(2.34)} y={Y(0.22)} width={u * 0.26} height={u * 0.5} />
        </g>

        <DimH x1={X(0)} x2={X(4)} y={oy - 46} from={oy - 4} label="4u" marker={arrow} />
        <DimH x1={X(1)} x2={X(2)} y={Y(4) + 40} from={Y(2) + 4} label="u = 44" marker={arrow} />
        <DimV y1={Y(0)} y2={Y(4)} x={ox - 46} from={ox - 4} label="4u" marker={arrow} />
        <DimV y1={Y(2)} y2={Y(4)} x={X(4) + 40} from={X(4) + 4} label="2u" marker={arrow} />

        <Callout n={1} x={X(2.47)} y={Y(0.47)} lx={438} ly={158} text="EYES · 0.26u × 0.5u" />
        <Callout n={2} x={X(1.5)} y={Y(1.5)} lx={438} ly={214} text="COUNTER · A WINDOW" />
        <Callout n={3} x={X(3.5)} y={Y(3.2)} lx={438} ly={252} text="DOT · CARRIES THE STATE" />

        <text className="ds-bp-label ds-bp-view-title" x={X(2)} y={Y(4) + 82} textAnchor="middle">
          FRONT ELEVATION · 4:1
        </text>
        <path className="ds-bp-ext" d={`M${X(2) - 92} ${Y(4) + 90} H${X(2) + 92}`} />
      </g>

      {/* Exploded view */}
      <g className="ds-bp-view ds-bp-explode">
        {PARTS.map((part, i) => {
          const first = PARTS.findIndex((p) => p.item === part.item) === i;
          const x = ex + part.cx * s;
          const y = ey + part.cy * s + (part.item === 5 ? 12 : 0);
          return (
            <g key={i} className="ds-bp-cell" style={{ '--cx': part.cx - 1.5, '--cy': part.cy - 1.5 } as CSSProperties}>
              <path className="ds-bp-depth" d={`M${x} ${y} l10 -10 h${s} v${s} l-10 10`} />
              <path className="ds-bp-ext" d={`M${x + s} ${y} l10 -10`} />
              <rect className={`ds-pm-fill ds-bp-part${part.item === 5 ? ' ds-pm-dot' : ''}`} x={x} y={y} width={s} height={s} />
              {first ? (() => {
                const [bx, by] = BALLOON[part.item];
                const px = x + s / 2 + bx * (s / 2 - 6);
                const py = y + s / 2 + by * (s / 2 - 6);
                const cx = x + s / 2 + bx * (s / 2 + 34) + (bx === 0 ? 0 : 0);
                const cy = y + s / 2 + by * (s / 2 + 34);
                return (
                  <>
                    <path className="ds-bp-leader" d={`M${px} ${py} L${cx - bx * 8} ${cy - by * 8}`} />
                    <circle className="ds-bp-pin" cx={px} cy={py} r="2.5" />
                    <circle className="ds-bp-balloon" cx={cx} cy={cy} r="11" />
                    <text className="ds-bp-label ds-bp-balloon-n" x={cx} y={cy + 4} textAnchor="middle">
                      {part.item}
                    </text>
                  </>
                );
              })() : null}
            </g>
          );
        })}
        <text className="ds-bp-label ds-bp-view-title" x={ex + 2 * s} y={ey + 4 * s + 98} textAnchor="middle">
          EXPLODED VIEW · 10 PARTS
        </text>
        <path className="ds-bp-ext" d={`M${ex + 2 * s - 98} ${ey + 4 * s + 106} H${ex + 2 * s + 98}`} />
      </g>

      {/* Parts list */}
      <g className="ds-bp-bom" transform="translate(890 64)">
        <rect className="ds-bp-frame" x="0" y="0" width="276" height={30 + BOM.length * 30} />
        <path className="ds-bp-ext" d={`M0 30 H276 M40 0 V${30 + BOM.length * 30} M80 0 V${30 + BOM.length * 30} M136 0 V${30 + BOM.length * 30}`} />
        {['ITEM', 'QTY', 'PART', 'NOTE'].map((h, i) => (
          <text key={h} className="ds-bp-label ds-bp-small" x={[20, 60, 108, 146][i]} y="20" textAnchor={i < 3 ? 'middle' : 'start'}>
            {h}
          </text>
        ))}
        {BOM.map((row, r) => (
          <g key={row.item} className={row.item === 5 ? 'ds-bp-hot-row' : undefined}>
            {r > 0 ? <path className="ds-bp-construct" d={`M0 ${30 + r * 30} H276`} /> : null}
            <text className="ds-bp-label" x="20" y={50 + r * 30} textAnchor="middle">{row.item}</text>
            <text className="ds-bp-label" x="60" y={50 + r * 30} textAnchor="middle">{row.qty}</text>
            <text className="ds-bp-label" x="108" y={50 + r * 30} textAnchor="middle">{row.part}</text>
            <text className="ds-bp-label ds-bp-note" x="146" y={50 + r * 30}>{row.note}</text>
          </g>
        ))}
      </g>

      {/* State diagram */}
      <g className="ds-bp-schema">
        {EDGES.map((edge) => {
          const hot = edge.from === state;
          const d = edge.d();
          return (
            <g key={`${edge.from}-${edge.to}`} className={hot ? 'ds-bp-edge ds-bp-edge--hot' : 'ds-bp-edge'}>
              <path className="ds-bp-edge-line" d={d} markerEnd={`url(#${hot ? arrowHot : arrow})`} />
            </g>
          );
        })}
        {EDGES.filter((e) => e.label).map((edge) => {
          const a = node(edge.from);
          const b = node(edge.to);
          const lx = edge.to === 'idle' ? (a.cx + b.cx) / 2 : edge.from === 'idle' || edge.to === 'done' ? (a.r + b.x) / 2 : a.cx + 30;
          const ly = edge.to === 'idle' ? node('blocked').b + 16 : edge.to === 'input' ? b.cy - 8 : edge.to === 'blocked' ? b.cy - 8 : edge.to === 'done' ? a.cy + 18 : a.cy - 8;
          return (
            <text key={edge.label} className="ds-bp-label ds-bp-small" x={lx} y={ly} textAnchor={edge.to === 'input' || edge.to === 'blocked' ? 'start' : 'middle'}>
              {edge.label}
            </text>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id} className={n.id === state ? 'ds-bp-node ds-bp-node--hot' : 'ds-bp-node'}>
            <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} />
            <text className="ds-bp-label" x={n.x + NODE_W / 2} y={n.y + 25} textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
        <text className="ds-bp-label ds-bp-view-title" x="60" y="462">
          STATE SCHEMA · ONE SESSION
        </text>
        <path className="ds-bp-ext" d="M60 470 H280" />
      </g>

      {/* Title block */}
      <g className="ds-bp-titleblock" transform="translate(800 578)">
        <rect className="ds-bp-frame" x="0" y="0" width="370" height="144" />
        <path className="ds-bp-ext" d="M0 44 H370 M0 77 H370 M0 110 H370 M124 44 V144 M248 44 V144" />
        <text className="ds-bp-title" x="14" y="31">
          pidex · Glyph
        </text>
        <text className="ds-bp-label ds-bp-small" x="356" y="28" textAnchor="end">
          DWG PDX-001
        </text>
        {[
          ['SCALE', '4 : 1'],
          ['UNIT', 'u = 44'],
          ['REV', 'A'],
          ['SHEET', '1 / 1'],
          ['DATE', date],
          ['DRAWN', 'pidex'],
          ['CHECKED', 'you'],
          ['STATE', STATE_WORD[state]],
          ['LOOK', 'pi.dev'],
        ].map(([k, v], i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <g key={k} className={k === 'STATE' ? 'ds-bp-hot-text' : undefined}>
              <text className="ds-bp-label ds-bp-tiny" x={8 + col * 124} y={56 + row * 33}>
                {k}
              </text>
              <text className="ds-bp-label" x={8 + col * 124} y={70 + row * 33}>
                {v}
              </text>
            </g>
          );
        })}
      </g>

      <g className="ds-bp-seal" transform="translate(648 372) rotate(-14 80 80)">
        <SealStamp tone={state} size={160} inked text={`PIDEX · PDX-001 · ${date} ·`} />
      </g>
    </svg>
  );
}

export { GlyphSchematic };
