import { useId, type CSSProperties, type ReactNode } from 'react';
import type { MascotState } from './LiveMascots';
import { PiMark } from './PiMark';

/**
 * The pi.dev set: mascots that are not cubes, and the small assets around them.
 * Every piece reads the same four inks from its look, and the state colour lands on one part only.
 */
type PiLook = 'ink' | 'blueprint' | 'paper' | 'warm';
type PiShape = 'pip' | 'brackets' | 'caret' | 'glyph' | 'stamp';

type SetProps = { look: PiLook; state?: MascotState; children: ReactNode; className?: string };

/** Sets the look and state for everything inside it. */
function PiSurface({ look, state = 'idle', children, className }: SetProps) {
  return (
    <div className={['ds-pm', className].filter(Boolean).join(' ')} data-look={look} data-state={state}>
      {children}
    </div>
  );
}

function Face({ cx, cy, gap = 24, w = 8, h = 14, mouth = 22 }: { cx: number; cy: number; gap?: number; w?: number; h?: number; mouth?: number }) {
  const my = cy + mouth;
  return (
    <g className="ds-pm-face">
      <g className="ds-pm-eyes">
        <rect className="ds-pm-eye" x={cx - gap / 2 - w / 2} y={cy} width={w} height={h} />
        <rect className="ds-pm-eye" x={cx + gap / 2 - w / 2} y={cy} width={w} height={h} />
      </g>
      {mouth > 0 ? (
        <>
          <path className="ds-pm-mouth ds-pm-mouth--flat" d={`M${cx - 7} ${my} H${cx + 7}`} />
          <path className="ds-pm-mouth ds-pm-mouth--smile" d={`M${cx - 10} ${my - 3} L${cx - 6} ${my + 2} H${cx + 6} L${cx + 10} ${my - 3}`} />
          <path className="ds-pm-mouth ds-pm-mouth--frown" d={`M${cx - 10} ${my + 3} L${cx - 6} ${my - 2} H${cx + 6} L${cx + 10} ${my + 3}`} />
          <rect className="ds-pm-mouth ds-pm-mouth--open" x={cx - 5} y={my - 5} width="10" height="10" />
        </>
      ) : null}
    </g>
  );
}

function Shadow({ rx = 40 }: { rx?: number }) {
  return <ellipse className="ds-pm-shadow" cx="80" cy="148" rx={rx} ry="5" />;
}

/** Pip: Pi is a circle, so the first mascot is one. It rolls when a run lands. */
function Pip() {
  return (
    <>
      <Shadow />
      <circle
        className="ds-pm-signal ds-pm-pip-bead"
        r="6"
        style={{ offsetPath: "path('M22 84 A58 58 0 1 0 138 84 A58 58 0 1 0 22 84')" }}
      />
      <g className="ds-pm-body ds-pm-pip">
        <rect className="ds-pm-fill" x="60" y="124" width="14" height="14" />
        <rect className="ds-pm-fill" x="86" y="124" width="14" height="14" />
        <circle className="ds-pm-fill" cx="80" cy="84" r="44" />
        <path className="ds-pm-shine" d="M50 72 A32 32 0 0 1 68 50" />
        <Face cx={80} cy={72} />
      </g>
    </>
  );
}

const CORNERS = [
  { id: 'tl', d: 'M46 66 V44 H68', dx: -1, dy: -1 },
  { id: 'tr', d: 'M92 44 H114 V66', dx: 1, dy: -1 },
  { id: 'bl', d: 'M46 96 V118 H68', dx: -1, dy: 1 },
  { id: 'br', d: 'M114 96 V118 H92', dx: 1, dy: 1 },
];

/** Brackets: the figure-frame corners, with a face floating inside. */
function Brackets() {
  return (
    <>
      <Shadow rx={34} />
      <g className="ds-pm-body ds-pm-brackets">
        <rect className="ds-pm-fill ds-pm-brackets-fill" x="46" y="44" width="68" height="74" />
        <g className="ds-pm-corners">
          {CORNERS.map((c) => (
            <path
              key={c.id}
              className="ds-pm-corner"
              d={c.d}
              style={{ '--dx': c.dx, '--dy': c.dy } as CSSProperties}
            />
          ))}
        </g>
        <Face cx={80} cy={66} />
      </g>
    </>
  );
}

/** Caret: the block cursor. It blinks at rest and leaves a line of type behind it while it works. */
function Caret() {
  return (
    <>
      <Shadow rx={30} />
      <g className="ds-pm-trail">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} className="ds-pm-signal" x={14 + i * 11} y="112" width="7" height="14" style={{ '--i': i } as CSSProperties} />
        ))}
      </g>
      <g className="ds-pm-body ds-pm-caret">
        <rect className="ds-pm-fill ds-pm-caret-block" x="62" y="38" width="38" height="100" />
        <Face cx={81} cy={60} gap={18} w={7} h={13} mouth={24} />
      </g>
    </>
  );
}

/** Glyph: the Pi mark stood up. The P carries the face and the dot is its companion. */
function Glyph() {
  const u = 22;
  const ox = 22;
  const oy = 38;
  const p = (x: number, y: number) => `${ox + x * u} ${oy + y * u}`;
  const d = `M${p(0, 0)} H${ox + 3 * u} V${oy + 2 * u} H${ox + 2 * u} V${oy + 3 * u} H${ox + u} V${oy + 4 * u} H${ox} Z M${p(1, 1)} V${oy + 2 * u} H${ox + 2 * u} V${oy + u} Z`;
  return (
    <>
      <Shadow rx={52} />
      <g className="ds-pm-body ds-pm-glyph">
        <path className="ds-pm-fill" fillRule="evenodd" d={d} />
        <g className="ds-pm-face">
          <g className="ds-pm-eyes">
            <rect className="ds-pm-eye" x={ox + 12} y={oy + 5} width="6" height="12" />
            <rect className="ds-pm-eye" x={ox + 48} y={oy + 5} width="6" height="12" />
          </g>
        </g>
      </g>
      <g className="ds-pm-glyph-dot">
        <rect className="ds-pm-fill ds-pm-dot" x={ox + 3 * u + 4} y={oy + 2 * u} width={u} height={2 * u} />
        <rect className="ds-pm-eye" x={ox + 3 * u + 8} y={oy + 2 * u + 8} width="4" height="8" />
        <rect className="ds-pm-eye" x={ox + 3 * u + 16} y={oy + 2 * u + 8} width="4" height="8" />
      </g>
    </>
  );
}

/** Stamp: the seal, with the ring of type turning around a face. */
function Stamp() {
  const id = useId().replace(/:/g, '');
  return (
    <>
      <Shadow rx={44} />
      <g className="ds-pm-body ds-pm-stamp">
        <circle className="ds-pm-fill" cx="80" cy="84" r="56" />
        <circle className="ds-pm-ring" cx="80" cy="84" r="38" />
        <path id={`ring-${id}`} d="M80 38 A46 46 0 1 1 79.99 38" fill="none" />
        <g className="ds-pm-stamp-type">
          <text className="ds-pm-ring-text">
            <textPath href={`#ring-${id}`}>PIDEX · AGENT · PIDEX · AGENT ·</textPath>
          </text>
        </g>
        <Face cx={80} cy={72} gap={20} w={7} h={12} mouth={20} />
      </g>
    </>
  );
}

const SHAPES: Record<PiShape, () => ReactNode> = { pip: Pip, brackets: Brackets, caret: Caret, glyph: Glyph, stamp: Stamp };

function PiMascot({ shape, label }: { shape: PiShape; label?: string }) {
  const Shape = SHAPES[shape];
  return (
    <svg className={`ds-pm-svg ds-pm-svg--${shape}`} viewBox="0 0 160 160" role="img" aria-label={label ?? `${shape} mascot`}>
      <Shape />
    </svg>
  );
}

type StampTone = 'idle' | 'thinking' | 'input' | 'blocked' | 'done';

/** A rubber stamp in Departure Mono, set slightly crooked. */
function PiStamp({ tone = 'idle', tilt = -3, children }: { tone?: StampTone; tilt?: number; children: ReactNode }) {
  return (
    <span className="ds-pa-stamp" data-tone={tone} style={{ rotate: `${tilt}deg` }}>
      {children}
    </span>
  );
}

type RuleKind = 'ruler' | 'dotted' | 'mark' | 'thread';

function PiRule({ kind }: { kind: RuleKind }) {
  if (kind === 'mark') {
    return (
      <div className="ds-pa-rule ds-pa-rule--mark" role="separator">
        <span />
        <PiMark size={18} />
        <span />
      </div>
    );
  }
  return <div className={`ds-pa-rule ds-pa-rule--${kind}`} role="separator" />;
}

type PiIconName = 'session' | 'terminal' | 'branch' | 'diff' | 'file' | 'check' | 'stop' | 'loop' | 'spark' | 'pi';

const ICONS: Record<Exclude<PiIconName, 'pi'>, ReactNode> = {
  session: (
    <>
      <rect x="3" y="3" width="14" height="14" />
      <path d="M7.5 8 V10.5 M12.5 8 V10.5" />
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="4" width="16" height="12" />
      <path d="M5.5 8.5 L8 10.5 L5.5 12.5 M10 12.5 H14" />
    </>
  ),
  branch: (
    <>
      <path d="M6 3 V17 M6 12 H10 V7 H14" />
      <rect x="12.5" y="5.5" width="3" height="3" />
    </>
  ),
  diff: <path d="M3 5.5 H9 M6 2.5 V8.5 M3 14.5 H9 M14 2 V18" />,
  file: <path d="M5 2 H12 L16 6 V18 H5 Z M12 2 V6 H16" />,
  check: <path d="M4 10.5 L8 14.5 L16 5.5" />,
  stop: <rect x="5" y="5" width="10" height="10" />,
  loop: <path d="M16 10 A6 6 0 1 1 13 4.8 M12.5 2 V5.5 H16" />,
  spark: <path d="M10 2 V7 M10 13 V18 M2 10 H7 M13 10 H18" />,
};

function PiIcon({ name, size = 20 }: { name: PiIconName; size?: number }) {
  if (name === 'pi') return <PiMark size={size} className="ds-pa-icon ds-pa-icon--pi" />;
  return (
    <svg className="ds-pa-icon" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export { PiIcon, PiMascot, PiRule, PiStamp, PiSurface };
export type { PiIconName, PiLook, PiShape, RuleKind, StampTone };
