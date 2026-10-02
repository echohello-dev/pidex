import { useId, type CSSProperties, type ReactNode } from 'react';
import type { MascotState } from './LiveMascots';

/**
 * Stamps: rubber stamps, seals, tickets, postmarks, and stickers in the pi.dev inks.
 * A tone picks the ink. Inside a PiSurface the paper look darkens each ink so it holds on moonstone.
 */
type StampTone = MascotState;

const STAMP_WORD: Record<StampTone, string> = {
  idle: 'draft',
  thinking: 'running',
  input: 'your turn',
  blocked: 'blocked',
  done: 'shipped',
};

type StampBase = { tone?: StampTone; tilt?: number; inked?: boolean };

function stampProps({ tone = 'done', tilt = 0, inked = false }: StampBase, className: string) {
  return {
    className: `ds-st ${className}`,
    'data-tone': tone,
    'data-inked': inked ? 'true' : undefined,
    style: { rotate: `${tilt}deg` } as CSSProperties,
  };
}

/**
 * Worn rubber: speckles the ink and roughens the edge. Render once per page; stamps with
 * inked set point at it.
 */
function InkDefs() {
  return (
    <svg className="ds-st-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="ds-ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 2.05" result="speckle" />
        <feComposite in="SourceGraphic" in2="speckle" operator="in" result="speckled" />
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp" />
        <feDisplacementMap in="speckled" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

// The Glyph cut from the ink: the P and the dot, with the eyes left as holes.
function InkGlyph({ x, y, u }: { x: number; y: number; u: number }) {
  const X = (n: number) => x + n * u;
  const Y = (n: number) => y + n * u;
  const p = `M${X(0)} ${Y(0)} H${X(3)} V${Y(2)} H${X(2)} V${Y(3)} H${X(1)} V${Y(4)} H${X(0)} Z M${X(1)} ${Y(1)} V${Y(2)} H${X(2)} V${Y(1)} Z`;
  const eye = u * 0.26;
  const eyeH = u * 0.5;
  const eyes = `M${X(0.4)} ${Y(0.22)} h${eye} v${eyeH} h${-eye} Z M${X(2.34)} ${Y(0.22)} h${eye} v${eyeH} h${-eye} Z`;
  return (
    <g className="ds-st-ink-fill">
      <path fillRule="evenodd" d={`${p} ${eyes}`} />
      <rect x={X(3) + u * 0.14} y={Y(2)} width={u} height={u * 2} />
    </g>
  );
}

/** Label: the double-bordered word. */
function LabelStamp({ children, ...base }: StampBase & { children?: ReactNode }) {
  return <span {...stampProps(base, 'ds-st-label')}>{children ?? STAMP_WORD[base.tone ?? 'done']}</span>;
}

/** Seal: a ringed stamp with the Glyph in the middle and the state across a band. */
function SealStamp({ text = 'PIDEX · SESSIONS · 01 OCT 2026 ·', size, ...base }: StampBase & { text?: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  const word = STAMP_WORD[base.tone ?? 'done'];
  return (
    // size sets real width and height attributes, which a seal nested inside another SVG needs.
    <svg {...stampProps(base, 'ds-st-seal')} width={size} height={size} viewBox="0 0 180 180" role="img" aria-label={`Seal, ${word}`}>
      <circle className="ds-st-line" cx="90" cy="90" r="84" strokeWidth="4" />
      <circle className="ds-st-line" cx="90" cy="90" r="64" strokeWidth="1.5" />
      <path id={`seal-${id}`} d="M90 16 A74 74 0 1 1 89.99 16" fill="none" />
      <text className="ds-st-type ds-st-ring">
        <textPath href={`#seal-${id}`}>{text}</textPath>
      </text>
      <InkGlyph x={60} y={48} u={14} />
      <rect className="ds-st-ink-fill" x="38" y="112" width="104" height="24" />
      <text className="ds-st-type ds-st-band" x="90" y="129" textAnchor="middle">
        {word.toUpperCase()}
      </text>
    </svg>
  );
}

/** Ticket: ink ground, notched sides, a stub with the Glyph and a number. */
function TicketStamp({ session, number, ...base }: StampBase & { session: string; number: number }) {
  const word = STAMP_WORD[base.tone ?? 'done'];
  return (
    <div {...stampProps(base, 'ds-st-ticket')} role="img" aria-label={`Ticket ${number}, ${session}, ${word}`}>
      <div className="ds-st-ticket-stub">
        <svg viewBox="-2 -2 74 60" aria-hidden="true">
          <InkGlyph x={0} y={0} u={14} />
        </svg>
        <span>№ {String(number).padStart(3, '0')}</span>
      </div>
      <div className="ds-st-ticket-body">
        <span className="ds-st-ticket-kicker">pidex · admit one run</span>
        <span className="ds-st-ticket-title">{session}</span>
        <span className="ds-st-ticket-word">{word}</span>
      </div>
    </div>
  );
}

/** Postmark: a dated circle with cancellation waves running off to the right. */
function PostmarkStamp({ date = '01 OCT 26', place = '~/PROJECTS', ...base }: StampBase & { date?: string; place?: string }) {
  const id = useId().replace(/:/g, '');
  const waves = [30, 44, 58, 72, 86];
  return (
    <svg {...stampProps(base, 'ds-st-postmark')} viewBox="0 0 300 120" role="img" aria-label={`Postmark ${date}`}>
      <circle className="ds-st-line" cx="60" cy="60" r="52" strokeWidth="3" />
      <circle className="ds-st-line" cx="60" cy="60" r="36" strokeWidth="1.25" />
      <path id={`post-top-${id}`} d="M18 60 A42 42 0 0 1 102 60" fill="none" />
      <path id={`post-bot-${id}`} d="M14 60 A46 46 0 0 0 106 60" fill="none" />
      <text className="ds-st-type ds-st-small">
        <textPath href={`#post-top-${id}`} startOffset="50%" textAnchor="middle">
          PIDEX · SESSIONS
        </textPath>
      </text>
      <text className="ds-st-type ds-st-small">
        <textPath href={`#post-bot-${id}`} startOffset="50%" textAnchor="middle">
          {place}
        </textPath>
      </text>
      <text className="ds-st-type ds-st-date" x="60" y="66" textAnchor="middle">
        {date}
      </text>
      {waves.map((y) => (
        <path
          key={y}
          className="ds-st-line"
          strokeWidth="2.5"
          d={`M122 ${y} q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0`}
        />
      ))}
    </svg>
  );
}

/** Review: a small form stamp. The result is ringed by hand. */
function ReviewStamp({ session, turns, by = 'you', ...base }: StampBase & { session: string; turns: number; by?: string }) {
  const word = STAMP_WORD[base.tone ?? 'done'];
  return (
    <div {...stampProps(base, 'ds-st-review')} role="img" aria-label={`Review of ${session}, ${word}`}>
      <div className="ds-st-review-head">pidex · review</div>
      <dl>
        <dt>session</dt>
        <dd>{session}</dd>
        <dt>turns</dt>
        <dd>{turns}</dd>
        <dt>by</dt>
        <dd>{by}</dd>
        <dt>result</dt>
        <dd className="ds-st-review-result">
          {word}
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <path className="ds-st-line" strokeWidth="2" d="M8 22 C6 8 40 3 70 5 C96 7 98 30 70 35 C40 40 4 36 10 18 L16 12" />
          </svg>
        </dd>
      </dl>
    </div>
  );
}

type StickerKind = 'glyph' | 'pi' | 'built' | 'ship';

/** Stickers: die-cut, with a moonstone edge and a lift shadow. Fixed brand inks, no tone. */
function Sticker({ kind, tilt = 0 }: { kind: StickerKind; tilt?: number }) {
  const ringId = `pi-ring-${useId().replace(/:/g, '')}`;
  const style = { rotate: `${tilt}deg` } as CSSProperties;
  if (kind === 'glyph') {
    return (
      <svg className="ds-st-sticker" style={style} viewBox="0 0 120 120" role="img" aria-label="Glyph sticker">
        <rect className="ds-st-sticker-edge" x="6" y="6" width="108" height="108" rx="22" />
        <rect x="14" y="14" width="92" height="92" rx="16" fill="#252f3d" />
        <g fill="#ebe7e4">
          <InkGlyphSolid x={26} y={32} u={15} />
        </g>
        <rect x="30" y="37" width="4" height="8" fill="#252f3d" />
        <rect x="59" y="37" width="4" height="8" fill="#252f3d" />
      </svg>
    );
  }
  if (kind === 'pi') {
    return (
      <svg className="ds-st-sticker" style={style} viewBox="0 0 120 120" role="img" aria-label="Pi sticker">
        <circle className="ds-st-sticker-edge" cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="48" fill="#e1b06e" />
        <path id={ringId} d="M60 22 A38 38 0 1 1 59.99 22" fill="none" />
        <text className="ds-st-sticker-ring">
          <textPath href={`#${ringId}`}>3.14159 26535 89793 23846 ·</textPath>
        </text>
        <text x="60" y="76" textAnchor="middle" className="ds-st-sticker-pi">
          π
        </text>
      </svg>
    );
  }
  if (kind === 'built') {
    return (
      <svg className="ds-st-sticker" style={style} viewBox="0 0 200 70" role="img" aria-label="Built with pi sticker">
        <rect className="ds-st-sticker-edge" x="4" y="4" width="192" height="62" rx="31" />
        <rect x="11" y="11" width="178" height="48" rx="24" fill="#844f3b" />
        <text x="100" y="41" textAnchor="middle" className="ds-st-sticker-word">
          built with pi
        </text>
      </svg>
    );
  }
  return (
    <svg className="ds-st-sticker" style={style} viewBox="0 0 190 70" role="img" aria-label="Ship it sticker">
      <rect className="ds-st-sticker-edge" x="4" y="4" width="182" height="62" rx="6" />
      <rect x="11" y="11" width="168" height="48" rx="2" fill="#6a9fcc" />
      <path d="M26 22 V48 H36 M26 22 H36 M164 22 V48 H154 M164 22 H154" stroke="#13110f" strokeWidth="4" fill="none" />
      <text x="95" y="41" textAnchor="middle" className="ds-st-sticker-word ds-st-sticker-word--ink">
        ship it
      </text>
    </svg>
  );
}

function InkGlyphSolid({ x, y, u }: { x: number; y: number; u: number }) {
  const X = (n: number) => x + n * u;
  const Y = (n: number) => y + n * u;
  return (
    <>
      <path
        fillRule="evenodd"
        d={`M${X(0)} ${Y(0)} H${X(3)} V${Y(2)} H${X(2)} V${Y(3)} H${X(1)} V${Y(4)} H${X(0)} Z M${X(1)} ${Y(1)} V${Y(2)} H${X(2)} V${Y(1)} Z`}
      />
      <rect x={X(3) + 3} y={Y(2)} width={u} height={u * 2} />
    </>
  );
}

/** Slams its child down whenever pressKey changes, with a ring of ink spreading out. */
function StampPress({ pressKey, children }: { pressKey: string; children: ReactNode }) {
  return (
    <div className="ds-st-press" key={pressKey}>
      <span className="ds-st-splash" aria-hidden="true" />
      {children}
    </div>
  );
}

export { InkDefs, LabelStamp, PostmarkStamp, ReviewStamp, SealStamp, StampPress, Sticker, TicketStamp, STAMP_WORD };
export type { StickerKind, StampTone };
