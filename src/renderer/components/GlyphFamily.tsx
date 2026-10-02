import { useEffect, useId, useState, type CSSProperties } from 'react';
import { usePrefersReducedMotion, type MascotState } from './LiveMascots';

/**
 * The Glyph family: the Pi mark stood up as a character. The P carries the face, the square
 * dot is its companion. Everything here reads the look and state from a surrounding PiSurface.
 */

// The mark on its 4×4 grid. The dot is one column wide and two cells tall.
const P_CELLS: [number, number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [0, 3]];
const DOT_CELLS: [number, number][] = [[3, 2], [3, 3]];

function pPath(ox: number, oy: number, u: number) {
  const x = (n: number) => ox + n * u;
  const y = (n: number) => oy + n * u;
  return `M${x(0)} ${y(0)} H${x(3)} V${y(2)} H${x(2)} V${y(3)} H${x(1)} V${y(4)} H${x(0)} Z M${x(1)} ${y(1)} V${y(2)} H${x(2)} V${y(1)} Z`;
}

function Eye({ x, y, w = 6, h = 11 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect className="ds-pm-eye" x={x} y={y} width={w} height={h} />;
}

/** The mark with its face, cropped tight. For lockups and small sizes. */
function GlyphMark({ size = 48, face = true }: { size?: number; face?: boolean }) {
  const u = 22;
  return (
    <svg className="ds-gl-mark" width={size} height={size} viewBox="-3 -3 100 94" aria-hidden="true">
      <path className="ds-pm-fill" fillRule="evenodd" d={pPath(0, 0, u)} />
      <rect className="ds-pm-fill ds-pm-dot" x={3 * u + 3} y={2 * u} width={u} height={2 * u} />
      {face ? (
        <g className="ds-pm-eyes">
          <Eye x={9} y={5} />
          <Eye x={51} y={5} />
        </g>
      ) : null}
    </svg>
  );
}

/** Peek: the counter of the P is a window, and the eyes look out through it. */
function GlyphPeek() {
  const id = useId().replace(/:/g, '');
  const u = 24;
  const ox = 18;
  const oy = 36;
  return (
    <svg className="ds-pm-svg ds-gl-svg ds-gl-peek" viewBox="0 0 160 160" role="img" aria-label="Glyph peeking">
      <ellipse className="ds-pm-shadow" cx="72" cy="138" rx="56" ry="5" />
      <defs>
        <clipPath id={`peek-${id}`}>
          <rect x={ox + u} y={oy + u} width={u} height={u} />
        </clipPath>
      </defs>
      <g className="ds-pm-body ds-gl-peek-body">
        <path className="ds-pm-fill" fillRule="evenodd" d={pPath(ox, oy, u)} />
        <g clipPath={`url(#peek-${id})`}>
          <rect className="ds-gl-peek-room" x={ox + u} y={oy + u} width={u} height={u} />
          <g className="ds-gl-peek-eyes">
            <rect className="ds-gl-peek-eye" x={ox + u + 5} y={oy + u + 7} width="5" height="10" />
            <rect className="ds-gl-peek-eye" x={ox + u + 14} y={oy + u + 7} width="5" height="10" />
          </g>
        </g>
      </g>
      <g className="ds-pm-glyph-dot">
        <rect className="ds-pm-fill ds-pm-dot" x={ox + 3 * u + 4} y={oy + 2 * u} width={u} height={2 * u} />
        <Eye x={ox + 3 * u + 8} y={oy + 2 * u + 9} w={4} h={8} />
        <Eye x={ox + 3 * u + 16} y={oy + 2 * u + 9} w={4} h={8} />
      </g>
    </svg>
  );
}

/** Carry: the dot rides on the P's head. */
function GlyphCarry() {
  const u = 22;
  const ox = 36;
  const oy = 58;
  return (
    <svg className="ds-pm-svg ds-gl-svg ds-gl-carry" viewBox="0 0 160 160" role="img" aria-label="Glyph carrying the dot">
      <ellipse className="ds-pm-shadow" cx="69" cy="150" rx="44" ry="5" />
      <g className="ds-pm-body ds-gl-carry-body">
        <path className="ds-pm-fill" fillRule="evenodd" d={pPath(ox, oy, u)} />
        <g className="ds-pm-eyes">
          <Eye x={ox + 8} y={oy + 5} />
          <Eye x={ox + 2 * u + 8} y={oy + 5} />
        </g>
        <g className="ds-gl-rider">
          <rect className="ds-pm-fill ds-pm-dot" x={ox + u} y={oy - 2 * u} width={u} height={2 * u} />
          <Eye x={ox + u + 5} y={oy - 2 * u + 9} w={4} h={8} />
          <Eye x={ox + u + 13} y={oy - 2 * u + 9} w={4} h={8} />
        </g>
      </g>
    </svg>
  );
}

/** Walk: the pair on the road. The ground moves while the run is going. */
function GlyphWalk() {
  const u = 20;
  const ox = 58;
  const oy = 52;
  return (
    <svg className="ds-pm-svg ds-gl-svg ds-gl-walk" viewBox="0 0 160 160" role="img" aria-label="Glyph walking">
      <g className="ds-gl-road">
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={i} x={-24 + i * 12} y="136" width="6" height="2" />
        ))}
      </g>
      <g className="ds-gl-walker">
        <path className="ds-pm-fill" fillRule="evenodd" d={pPath(ox, oy, u)} />
        <g className="ds-pm-eyes">
          <Eye x={ox + 7} y={oy + 5} w={5} h={10} />
          <Eye x={ox + 2 * u + 7} y={oy + 5} w={5} h={10} />
        </g>
      </g>
      <g className="ds-gl-follower">
        <rect className="ds-pm-fill ds-pm-dot" x="24" y="94" width={u} height={2 * u} />
        <Eye x={29} y={102} w={4} h={8} />
        <Eye x={36} y={102} w={4} h={8} />
      </g>
    </svg>
  );
}

// Where each cell flies to while the mark takes itself apart, and where it lands in a heap.
const SCATTER = [
  [-30, -26, -35], [-6, -40, 20], [24, -30, 40], [-40, 4, -20], [36, -6, 25],
  [-26, 30, 15], [10, 26, -30], [-14, 44, 45], [30, 18, -15], [22, 36, 30],
];
const PILE = [
  [16, 118, 0], [40, 118, 6], [64, 118, -4], [88, 118, 3], [112, 118, -8],
  [134, 120, 12], [28, 96, -10], [52, 96, 4], [76, 97, -6], [100, 95, 15],
];

/** Assemble: the mark built from its own grid. It comes apart while it thinks. */
function GlyphAssemble() {
  const u = 22;
  const ox = 36;
  const oy = 40;
  const cells = [...P_CELLS, ...DOT_CELLS];
  return (
    <svg className="ds-pm-svg ds-gl-svg ds-gl-assemble" viewBox="0 0 160 160" role="img" aria-label="Glyph assembling">
      <ellipse className="ds-pm-shadow" cx="80" cy="146" rx="50" ry="5" />
      <rect className="ds-gl-slot" x={ox + 3 * u} y={oy + 2 * u} width={u} height={2 * u} />
      <g className="ds-gl-cells">
        {cells.map(([cx, cy], i) => {
          const x = ox + cx * u;
          const y = oy + cy * u;
          const [sx, sy, sr] = SCATTER[i];
          const [px, py, pr] = PILE[i];
          const isDot = i >= P_CELLS.length;
          return (
            <rect
              key={`${cx}-${cy}`}
              className={`ds-pm-fill ds-gl-cell${isDot ? ' ds-pm-dot ds-gl-cell--dot' : ''}`}
              x={x}
              y={y}
              width={u}
              height={u}
              style={
                {
                  '--i': i,
                  '--sx': `${sx}px`,
                  '--sy': `${sy}px`,
                  '--sr': `${sr}deg`,
                  '--px': `${px - x}px`,
                  '--py': `${py - y}px`,
                  '--pr': `${pr}deg`,
                } as CSSProperties
              }
            />
          );
        })}
      </g>
      <g className="ds-pm-eyes ds-gl-assemble-eyes">
        <Eye x={ox + 8} y={oy + 5} />
        <Eye x={ox + 2 * u + 8} y={oy + 5} />
      </g>
    </svg>
  );
}

const LAYERS = 12;

/** Extrude: the mark as a solid, stacked from flat layers. */
function GlyphExtrude() {
  const u = 22;
  return (
    <div className="ds-gl-extrude" role="img" aria-label="Glyph in 3D">
      <div className="ds-gl-extrude-spin">
        {Array.from({ length: LAYERS }, (_, i) => (
          <svg
            key={i}
            className={`ds-gl-layer${i === 0 ? ' ds-gl-layer--front' : ''}${i === LAYERS - 1 ? ' ds-gl-layer--back' : ''}`}
            viewBox="-3 -3 100 94"
            style={{ '--z': i } as CSSProperties}
            aria-hidden="true"
          >
            <path className={i === 0 ? 'ds-pm-fill' : 'ds-gl-side'} fillRule="evenodd" d={pPath(0, 0, u)} />
            <rect className={i === 0 ? 'ds-pm-fill ds-pm-dot' : 'ds-gl-side'} x={3 * u + 3} y={2 * u} width={u} height={2 * u} />
            {i === 0 ? (
              <g className="ds-pm-eyes">
                <Eye x={9} y={5} />
                <Eye x={51} y={5} />
              </g>
            ) : null}
          </svg>
        ))}
      </div>
      <span className="ds-gl-extrude-floor" />
    </div>
  );
}

/** The wordmark, with the glyph beside it and the square dot as the tittle on the i. */
function GlyphWordmark() {
  return (
    <div className="ds-gl-word" role="img" aria-label="pidex">
      <GlyphMark size={76} />
      <span className="ds-gl-word-text" aria-hidden="true">
        p
        <span className="ds-gl-i">
          ı<span className="ds-gl-tittle" />
        </span>
        dex
      </span>
    </div>
  );
}

// Pixel glyph: 11 × 10 pixels packed into half blocks, two pixel rows per character.
type Eyes = 'center' | 'left' | 'right' | 'shut' | 'wide';
type PixelSpec = { eyes: Eyes; dot: number | 'down' };

const EYE_COLS: Record<Eyes, number[]> = { center: [1, 4], left: [0, 3], right: [2, 5], shut: [], wide: [1, 4] };

function pixelGrid({ eyes, dot }: PixelSpec) {
  const W = 11;
  const H = 10;
  const grid: ('p' | 'd' | null)[][] = Array.from({ length: H }, () => Array<'p' | 'd' | null>(W).fill(null));
  for (const [cx, cy] of P_CELLS) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[2 + cy * 2 + dy][cx * 2 + dx] = 'p';
  }
  for (const col of EYE_COLS[eyes]) {
    grid[3][col] = null;
    if (eyes === 'wide') grid[2][col] = null;
  }
  if (dot === 'down') {
    for (let r = 8; r < 10; r++) for (let c = 7; c < 11; c++) grid[r][c] = 'd';
  } else {
    for (let r = 6 + dot; r < 10 + dot; r++) for (let c = 6; c < 8; c++) grid[r][c] = 'd';
  }
  const rows: { ch: string; dot: boolean }[][] = [];
  for (let r = 0; r < H; r += 2) {
    rows.push(
      grid[r].map((top, c) => {
        const bottom = grid[r + 1][c];
        const ch = top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
        return { ch, dot: top === 'd' || bottom === 'd' };
      }),
    );
  }
  return rows;
}

const GLYPH_PIXEL: Record<MascotState, PixelSpec[]> = {
  idle: [
    { eyes: 'center', dot: 0 },
    { eyes: 'center', dot: 0 },
    { eyes: 'left', dot: 0 },
    { eyes: 'center', dot: 0 },
    { eyes: 'right', dot: 0 },
    { eyes: 'shut', dot: 0 },
  ],
  thinking: [
    { eyes: 'right', dot: 0 },
    { eyes: 'right', dot: -1 },
    { eyes: 'right', dot: -2 },
    { eyes: 'right', dot: -1 },
  ],
  input: [
    { eyes: 'wide', dot: -2 },
    { eyes: 'wide', dot: -2 },
    { eyes: 'wide', dot: 0 },
  ],
  blocked: [
    { eyes: 'right', dot: 'down' },
    { eyes: 'right', dot: 'down' },
    { eyes: 'shut', dot: 'down' },
  ],
  done: [
    { eyes: 'shut', dot: -2 },
    { eyes: 'shut', dot: -1 },
    { eyes: 'shut', dot: 0 },
    { eyes: 'shut', dot: 0 },
  ],
};

/** The glyph in block characters, for the terminal. The dot takes the state colour. */
function GlyphPixel({ state }: { state: MascotState }) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (reduced) return;
    const timer = window.setInterval(() => setFrame((n) => n + 1), state === 'idle' ? 650 : 240);
    return () => window.clearInterval(timer);
  }, [state, reduced]);
  const frames = GLYPH_PIXEL[state];
  const rows = pixelGrid(frames[frame % frames.length]);
  return (
    <pre className="ds-gl-pixel" role="img" aria-label={`Glyph in block characters, ${state}`}>
      {rows.map((row, r) => (
        <span key={r}>
          {row.map((cell, c) => (
            <span key={c} className={cell.dot ? 'ds-gl-pixel-dot' : undefined}>
              {cell.ch}
            </span>
          ))}
          {r < rows.length - 1 ? '\n' : null}
        </span>
      ))}
    </pre>
  );
}

export { GlyphAssemble, GlyphCarry, GlyphExtrude, GlyphMark, GlyphPeek, GlyphPixel, GlyphWalk, GlyphWordmark };
