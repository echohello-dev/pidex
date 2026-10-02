import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PiMark } from './PiMark';

type MascotState = 'idle' | 'thinking' | 'input' | 'blocked' | 'done';
type MascotTone = 'blue' | 'accent' | 'warm' | 'sage' | 'rust';
type MascotGear = 'none' | 'antenna' | 'halo' | 'bead';

const PI_D =
  'M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z';
const PI_DOT_D = 'M517.36 400H634.72V634.72H517.36Z';
const PI_SPAN = 634.72 - 165.29;
const RX = 0.8660254037844386;

// Isometric cube, top-face centre at (cx, cy), edge e. Same geometry as build-identity.py.
function cubeFaces(cx: number, cy: number, e: number) {
  const dx = e * RX;
  const dy = e / 2;
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return {
    top: pts([[cx, cy - dy], [cx + dx, cy], [cx, cy + dy], [cx - dx, cy]]),
    right: pts([[cx + dx, cy], [cx, cy + dy], [cx, cy + dy + e], [cx + dx, cy + e]]),
    left: pts([[cx - dx, cy], [cx, cy + dy], [cx, cy + dy + e], [cx - dx, cy + e]]),
    // Maps (along, down) on the right face, origin at its front-top corner.
    rightFace: `matrix(${RX} -0.5 0 1 ${cx.toFixed(2)} ${(cy + dy).toFixed(2)})`,
    leftFace: `matrix(${-RX} -0.5 0 1 ${cx.toFixed(2)} ${(cy + dy).toFixed(2)})`,
    topFace: (() => {
      const b = dy / PI_SPAN;
      const ty = cy - dy - 2 * b * 165.29;
      return `matrix(${(dx / PI_SPAN).toFixed(6)} ${b.toFixed(6)} ${(-dx / PI_SPAN).toFixed(6)} ${b.toFixed(6)} ${cx.toFixed(2)} ${ty.toFixed(2)})`;
    })(),
  };
}

function Cube({ cx, cy, e, pi = false, children }: { cx: number; cy: number; e: number; pi?: boolean; children?: ReactNode }) {
  const f = cubeFaces(cx, cy, e);
  return (
    <>
      <polygon className="ds-live-face ds-live-face--left" points={f.left} />
      <polygon className="ds-live-face ds-live-face--right" points={f.right} />
      <polygon className="ds-live-face ds-live-face--top" points={f.top} />
      {pi ? (
        <g transform={f.topFace} className="ds-live-ink">
          <path fillRule="evenodd" d={PI_D} />
          <path d={PI_DOT_D} />
        </g>
      ) : null}
      {children}
    </>
  );
}

// Writes the pointer position into --look-x / --look-y, each -1..1, on the stage element.
function usePointerLook<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const move = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 2 - 1;
      const y = ((event.clientY - box.top) / box.height) * 2 - 1;
      node.style.setProperty('--look-x', Math.max(-1, Math.min(1, x)).toFixed(3));
      node.style.setProperty('--look-y', Math.max(-1, Math.min(1, y)).toFixed(3));
    };
    const leave = () => {
      node.style.setProperty('--look-x', '0');
      node.style.setProperty('--look-y', '0');
    };
    window.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    };
  }, []);
  return ref;
}

function Eyes({ at, down, gap, w, h }: { at: number; down: number; gap: number; w: number; h: number }) {
  return (
    <g className="ds-live-eyes">
      <rect className="ds-live-eye" x={at - w / 2} y={down} width={w} height={h} />
      <rect className="ds-live-eye" x={at + gap - w / 2} y={down} width={w} height={h} />
    </g>
  );
}

/** Signals drawn above the head. Only the one for the current state is visible. */
function HeadSignals({ cx, y }: { cx: number; y: number }) {
  return (
    <g className="ds-live-signals">
      <g className="ds-live-ticks">
        <rect x={cx - 18} y={y} width="8" height="8" />
        <rect x={cx - 4} y={y} width="8" height="8" />
        <rect x={cx + 10} y={y} width="8" height="8" />
      </g>
      <g className="ds-live-bang">
        <rect x={cx - 4} y={y - 16} width="8" height="18" />
        <rect x={cx - 4} y={y + 6} width="8" height="8" />
      </g>
      <g className="ds-live-cross">
        <path d={`M${cx - 9} ${y - 7} L${cx + 9} ${y + 11} M${cx + 9} ${y - 7} L${cx - 9} ${y + 11}`} />
      </g>
      <g className="ds-live-sparks">
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sy) => (
            <rect
              key={`${sx}${sy}`}
              x={cx - 3 + sx * 26}
              y={y + 2 + sy * 10}
              width="6"
              height="6"
              style={{ '--sx': sx, '--sy': sy } as CSSProperties}
            />
          )),
        )}
      </g>
    </g>
  );
}

function Gear({ gear, cx, top }: { gear: MascotGear; cx: number; top: number }) {
  if (gear === 'antenna') {
    return (
      <g className="ds-live-gear ds-live-gear--antenna">
        <line x1={cx + 26} y1={top + 12} x2={cx + 34} y2={top - 22} />
        <circle cx={cx + 34} cy={top - 26} r="6" />
      </g>
    );
  }
  if (gear === 'halo') {
    return (
      <g className="ds-live-gear ds-live-gear--halo">
        <ellipse cx={cx} cy={top - 14} rx="44" ry="11" />
        <circle
          className="ds-live-halo-bead"
          r="4.5"
          style={{ offsetPath: `path('M${cx - 44} ${top - 14} A44 11 0 1 0 ${cx + 44} ${top - 14} A44 11 0 1 0 ${cx - 44} ${top - 14}')` }}
        />
      </g>
    );
  }
  if (gear === 'bead') {
    return (
      <g className="ds-live-gear ds-live-gear--bead">
        <circle cx={cx + 74} cy={top + 4} r="10" />
      </g>
    );
  }
  return null;
}

type BlinkProps = {
  state: MascotState;
  tone?: MascotTone;
  gear?: MascotGear;
  /** Body only, cropped tight. For avatars in lists. */
  compact?: boolean;
  label?: string;
};

/** The cube and the dot with faces. Eyes follow the pointer, and the face and signals carry the agent state. */
function BlinkMascot({ state, tone = 'blue', gear = 'none', compact = false, label }: BlinkProps) {
  const ref = usePointerLook<HTMLDivElement>();
  const body = cubeFaces(110, 70, 90);
  const dot = cubeFaces(226, 150, 40);
  return (
    <div
      ref={ref}
      className={`ds-live ds-live--blink${compact ? ' ds-live--compact' : ''}`}
      data-state={state}
      data-tone={tone}
      role="img"
      aria-label={label ?? `Blink mascot, ${state}`}
    >
      <svg viewBox={compact ? '22 -44 176 254' : '0 -40 290 270'} aria-hidden="true">
        <ellipse className="ds-live-shadow" cx="112" cy="214" rx="86" ry="7" />
        {compact ? null : <ellipse className="ds-live-shadow ds-live-shadow--dot" cx="226" cy="214" rx="38" ry="5" />}
        <g className="ds-live-body">
          <Cube cx={110} cy={70} e={90} pi />
          <g transform={body.rightFace}>
            <g className="ds-live-look">
              <Eyes at={26} down={26} gap={32} w={12} h={20} />
              <path className="ds-live-mouth ds-live-mouth--flat" d="M36 60 H50" />
              <path className="ds-live-mouth ds-live-mouth--smile" d="M32 58 L37 64 H50 L55 58" />
              <path className="ds-live-mouth ds-live-mouth--frown" d="M32 65 L37 59 H50 L55 65" />
              <rect className="ds-live-mouth ds-live-mouth--open" x="38" y="56" width="10" height="10" />
            </g>
          </g>
          <Gear gear={gear} cx={110} top={25} />
          <HeadSignals cx={112} y={-16} />
        </g>
        {compact ? null : (
          <g className="ds-live-dot">
            <Cube cx={226} cy={150} e={40}>
              <polygon className="ds-live-ink" points={cubeFaces(226, 150, 19).top} />
            </Cube>
            <g transform={dot.rightFace}>
              <g className="ds-live-look ds-live-look--small">
                <Eyes at={11} down={11} gap={14} w={5} h={9} />
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// Text-only Blink for terminals and notifications. 7 columns, block elements only.
const PIXEL_FEET = ' ▀▘ ▝▀ ';
// Eyes and mouths are quarter- and half-cell holes, the way Clawd draws its eyes.
const PIXEL_EYES = { center: '▐█▛█▜█▌', left: '▐▛█▛██▌', right: '▐██▜█▜▌', shut: '▐█▀█▀█▌', wide: '▐█ █ █▌', flat: '▐█▄█▄█▌' };
const PIXEL_MOUTH = { rest: '▐█████▌', smile: '▐█▙▄▟█▌', frown: '▐█▛▀▜█▌', open: '▐██▄██▌' };

// Six rows: signal, headroom, lid, eyes, mouth, feet. A lifted frame spends the headroom and tucks the feet.
function pixelFrame(signal: string, eyes: string, mouth: string, lift = false, shift = 0) {
  const blank = '       ';
  const rows = lift
    ? [signal, '▗▄▄▄▄▄▖', eyes, mouth, '  ▘ ▝  ', blank]
    : [signal, blank, '▗▄▄▄▄▄▖', eyes, mouth, PIXEL_FEET];
  const pad = (row: string) => (shift > 0 ? ` ${row.slice(0, -1)}` : shift < 0 ? `${row.slice(1)} ` : row);
  return rows.map(pad).join('\n');
}

const PIXEL_FRAMES: Record<MascotState, string[]> = {
  idle: [
    pixelFrame('       ', PIXEL_EYES.center, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.center, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.left, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.center, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.right, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.shut, PIXEL_MOUTH.rest),
  ],
  thinking: [
    pixelFrame(' ▪     ', PIXEL_EYES.right, PIXEL_MOUTH.rest),
    pixelFrame(' ▪ ▪   ', PIXEL_EYES.right, PIXEL_MOUTH.rest),
    pixelFrame(' ▪ ▪ ▪ ', PIXEL_EYES.right, PIXEL_MOUTH.rest),
    pixelFrame('       ', PIXEL_EYES.right, PIXEL_MOUTH.rest),
  ],
  input: [
    pixelFrame('   ▮   ', PIXEL_EYES.wide, PIXEL_MOUTH.open),
    pixelFrame('   ▮   ', PIXEL_EYES.wide, PIXEL_MOUTH.open, true),
    pixelFrame('       ', PIXEL_EYES.wide, PIXEL_MOUTH.open),
  ],
  blocked: [
    pixelFrame('   ✕   ', PIXEL_EYES.flat, PIXEL_MOUTH.frown),
    pixelFrame('   ✕   ', PIXEL_EYES.flat, PIXEL_MOUTH.frown, false, 1),
    pixelFrame('   ✕   ', PIXEL_EYES.flat, PIXEL_MOUTH.frown, false, -1),
    pixelFrame('   ✕   ', PIXEL_EYES.flat, PIXEL_MOUTH.frown),
    pixelFrame('   ✕   ', PIXEL_EYES.flat, PIXEL_MOUTH.frown),
  ],
  done: [
    pixelFrame('       ', PIXEL_EYES.shut, PIXEL_MOUTH.smile),
    pixelFrame('▪     ▪', PIXEL_EYES.shut, PIXEL_MOUTH.smile, true),
    pixelFrame(' ▪   ▪ ', PIXEL_EYES.shut, PIXEL_MOUTH.smile),
    pixelFrame('       ', PIXEL_EYES.center, PIXEL_MOUTH.smile),
  ],
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

type PixelSkin = 'mono' | 'terminal' | 'cube' | 'crest' | 'blueprint' | 'paper';

// The Pi mark on its 4×4 grid, packed two pixel rows per character with half blocks.
//   ■■■·    █▀█·
//   ■·■·
//   ■■·■    █▀·█
//   ■··■
const PIXEL_PI = ['  █▀█  ', '  █▀ █ '];
const PIXEL_LID = '▗▄▄▄▄▄▖';

type PixelRow = { kind: 'signal' | 'pi' | 'lid' | 'body' | 'feet' | 'air'; text: string; shift: number };

function pixelRows(frame: string, skin: PixelSkin): PixelRow[] {
  const lines = frame.split('\n');
  const lidAt = lines.findIndex((line) => line.includes('▄▄▄▄▄'));
  const lid = lines[lidAt];
  const shift = lid.startsWith(' ') ? 1 : lid.startsWith(PIXEL_LID[0]) ? 0 : -1;
  const rows: PixelRow[] = lines.map((text, i) => {
    let kind: PixelRow['kind'] = 'body';
    if (i === 0) kind = 'signal';
    else if (i === lidAt) kind = 'lid';
    else if (i < lidAt || !text.trim()) kind = 'air';
    else if (i > lidAt + 2) kind = 'feet';
    return { kind, text, shift };
  });
  if (skin !== 'crest') return rows;
  const pad = (row: string) => (shift > 0 ? ` ${row.slice(0, -1)}` : shift < 0 ? `${row.slice(1)} ` : row);
  return [rows[0], ...PIXEL_PI.map((text) => ({ kind: 'pi' as const, text: pad(text), shift })), ...rows.slice(1)];
}

// The cube skin lights the right half of the body and shades the left, like the emblem faces.
function PixelCells({ row }: { row: PixelRow }) {
  return (
    <>
      {[...row.text].map((ch, i) => {
        const col = i - row.shift;
        const face = col < 3 ? 'l' : col > 3 ? 'r' : 'm';
        return (
          <span key={i} className={`ds-pixel-c ds-pixel-c--${face}`}>
            {ch}
          </span>
        );
      })}
    </>
  );
}

/** Blink drawn in block characters. Loops its state until the state changes. */
function PixelMascot({ state, skin = 'mono' }: { state: MascotState; skin?: PixelSkin }) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (reduced) return;
    const timer = window.setInterval(() => setFrame((n) => n + 1), state === 'idle' ? 700 : 260);
    return () => window.clearInterval(timer);
  }, [state, reduced]);
  const frames = PIXEL_FRAMES[state];
  const rows = pixelRows(frames[frame % frames.length], skin);
  return (
    <pre className="ds-pixel" data-state={state} data-skin={skin} role="img" aria-label={`Pixel mascot, ${state}`}>
      {rows.map((row, i) => (
        <span key={i} className={`ds-pixel-row ds-pixel-row--${row.kind}`}>
          {skin === 'cube' && row.kind === 'body' ? <PixelCells row={row} /> : row.text}
          {i < rows.length - 1 ? '\n' : null}
        </span>
      ))}
    </pre>
  );
}

const PROMPT_LINES = [34, 58, 22, 46, 64, 30];
const STEAM = ['{', 'π', '}', '›', ';', '_'];

/** The code mascot. The right face is a terminal that types while the agent works. */
function PromptMascot({ state }: { state: MascotState }) {
  const ref = usePointerLook<HTMLDivElement>();
  const f = cubeFaces(140, 90, 110);
  return (
    <div ref={ref} className="ds-live ds-live--prompt" data-state={state} role="img" aria-label={`Prompt mascot, ${state}`}>
      <svg viewBox="0 -40 280 300" aria-hidden="true">
        <defs>
          <radialGradient id="ds-live-bead" cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#f3f2f0" />
            <stop offset="0.55" stopColor="currentColor" />
            <stop offset="1" stopColor="#1c2838" />
          </radialGradient>
        </defs>
        <ellipse className="ds-live-shadow" cx="140" cy="250" rx="104" ry="8" />
        <g className="ds-live-steam">
          {STEAM.map((glyph, i) => (
            <text key={glyph} x={104 + i * 14} y="18" style={{ '--i': i } as CSSProperties}>
              {glyph}
            </text>
          ))}
        </g>
        <g className="ds-live-body">
          <line className="ds-live-stem" x1="140" y1="52" x2="140" y2="8" />
          <circle className="ds-live-bead" cx="140" cy="2" r="9" fill="url(#ds-live-bead)" />
          <Cube cx={140} cy={90} e={110} pi />
          <g transform={f.rightFace}>
            <rect className="ds-live-screen" x="8" y="8" width="94" height="94" rx="2" />
            <text className="ds-live-prompt" x="14" y="24">
              ›
            </text>
            <g className="ds-live-code">
              {PROMPT_LINES.map((w, i) => (
                <rect key={i} x="24" y={16 + i * 12} width={w} height="5" style={{ '--i': i } as CSSProperties} />
              ))}
            </g>
            <rect className="ds-live-caret" x="24" y="88" width="6" height="8" />
            <text className="ds-live-status ds-live-status--done" x="18" y="62">
              ✓ done
            </text>
            <text className="ds-live-status ds-live-status--input" x="18" y="62">
              ? input
            </text>
            <text className="ds-live-status ds-live-status--blocked" x="14" y="62">
              ✕ blocked
            </text>
          </g>
          <g transform={f.leftFace} className="ds-live-vents">
            <rect x="18" y="74" width="30" height="3" />
            <rect x="18" y="82" width="30" height="3" />
            <rect x="18" y="90" width="30" height="3" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** A real 3D cube. It turns at rest, unfolds into its net while thinking, and snaps shut when done. */
function FoldMascot({ state }: { state: MascotState }) {
  const ref = usePointerLook<HTMLDivElement>();
  return (
    <div ref={ref} className="ds-live ds-live--fold" data-state={state} role="img" aria-label={`Fold mascot, ${state}`}>
      <div className="ds-fold-scene">
        <div className="ds-fold-tilt">
          <div className="ds-fold-hop">
            <div className="ds-fold-spin">
              <div className="ds-fold-face ds-fold-bottom">
                <span className="ds-fold-dot" />
              </div>
              <div className="ds-fold-face ds-fold-side ds-fold-side--front" style={{ '--k': 0 } as CSSProperties} />
              <div className="ds-fold-face ds-fold-side ds-fold-side--right" style={{ '--k': 1 } as CSSProperties} />
              <div className="ds-fold-face ds-fold-side ds-fold-side--left" style={{ '--k': 3 } as CSSProperties} />
              <div className="ds-fold-face ds-fold-side ds-fold-side--back" style={{ '--k': 2 } as CSSProperties}>
                <div className="ds-fold-face ds-fold-top">
                  <PiMark size={62} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="ds-fold-ground" />
      <span className="ds-fold-pulse" />
    </div>
  );
}

export { BlinkMascot, FoldMascot, PixelMascot, PromptMascot, usePrefersReducedMotion };
export type { MascotGear, MascotState, MascotTone, PixelSkin };
