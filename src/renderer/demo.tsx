import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentLoop } from './components/AgentLoop';
import { Badge, type BadgeTone } from './components/Badge';
import { BracketButton } from './components/BracketButton';
import { CubeMark } from './components/CubeMark';
import { PanelStack, SheetTurn, TokenSpin } from './components/DeskObjects';
import { FigureFrame } from './components/FigureFrame';
import { FrameLoader } from './components/FrameLoader';
import {
  BlinkMascot,
  FoldMascot,
  PixelMascot,
  PromptMascot,
  type MascotGear,
  type MascotState,
  type MascotTone,
  type PixelSkin,
} from './components/LiveMascots';
import { Loader } from './components/Loader';
import {
  GlyphAssemble,
  GlyphCarry,
  GlyphExtrude,
  GlyphMark,
  GlyphPeek,
  GlyphPixel,
  GlyphWalk,
  GlyphWordmark,
} from './components/GlyphFamily';
import { PiMark } from './components/PiMark';
import { GlyphSchematic } from './components/Schematic';
import {
  InkDefs,
  LabelStamp,
  PostmarkStamp,
  ReviewStamp,
  SealStamp,
  StampPress,
  Sticker,
  TicketStamp,
} from './components/Stamps';
import { PiIcon, PiMascot, PiRule, PiStamp, PiSurface, type PiIconName, type PiLook, type PiShape, type RuleKind } from './components/PiSet';
import { Hoop, Orb, Ring } from './components/Round';
import { Skeleton } from './components/Skeleton';
import mark from '../../assets/mark.svg';
import markMono from '../../assets/mark-mono.svg';
import markInverse from '../../assets/mark-inverse.svg';
import icon from '../../assets/icon.svg';
import logo from '../../assets/logo.svg';
import logoStacked from '../../assets/logo-stacked.svg';
import plate from '../../assets/mark-plate.svg';
import stencil from '../../assets/mark-stencil.svg';
import blueprint from '../../assets/mark-blueprint.svg';
import seal from '../../assets/mark-seal.svg';
import accent from '../../assets/mark-accent.svg';
import warm from '../../assets/mark-warm.svg';
import wordmark from '../../assets/logo-wordmark.svg';
import editorial from '../../assets/logo-editorial.svg';
import label from '../../assets/logo-label.svg';
import mascot from '../../assets/mascot.svg';
import mascotDot from '../../assets/mascot-dot.svg';
import mascotPage from '../../assets/mascot-page.svg';
import mascotDesk from '../../assets/mascot-desk.svg';
import mascotSignal from '../../assets/mascot-signal.svg';
import mascotHalo from '../../assets/mascot-halo.svg';
import mascotTurn from '../../assets/mascot-turn.svg';
import mascotTwins from '../../assets/mascot-twins.svg';
import mascotCairn from '../../assets/mascot-cairn.svg';
import disc from '../../assets/mark-disc.svg';
import arc from '../../assets/mark-arc.svg';
import orbit from '../../assets/mark-orbit.svg';
import bead from '../../assets/mascot-bead.svg';
import './design-system/index.css';
import './demo.css';

const SWATCHES = [
  ['Parchment', '#dacbc2', 'var(--parchment)'],
  ['Moonstone', '#ebe7e4', 'var(--moonstone)'],
  ['Accent', '#6a9fcc', 'var(--accent)'],
  ['Tidal', '#4b607c', 'var(--tidal-blue)'],
  ['Terracotta', '#844f3b', 'var(--terracotta)'],
  ['Sunkissed', '#e1b06e', 'var(--sunkissed)'],
  ['Sage', '#a3a473', 'var(--sage)'],
  ['Canvas', '#161d27', 'var(--bg-canvas)'],
  ['Panel', '#212730', 'var(--panel)'],
  ['Deep', '#0d1116', 'var(--bg-deep)'],
  ['Success', '#5db87a', 'var(--success)'],
  ['Warning', '#e8993a', 'var(--warning)'],
] as const;

function LogoTile({
  src,
  caption,
  wide = false,
  light = false,
  appIcon = false,
}: {
  src: string;
  caption: string;
  wide?: boolean;
  light?: boolean;
  appIcon?: boolean;
}) {
  const stage = ['stage', wide ? 'stage--wide' : '', light ? 'stage--light' : '', appIcon ? 'stage--icon' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <FigureFrame caption={caption}>
      <div className={stage}>
        <img src={src} alt="" />
      </div>
    </FigureFrame>
  );
}

function Demo() {
  return (
    <main className="board">
      <InkDefs />
      <div className="board-inner">
        <header className="mast">
          <p className="ds-eyebrow">pidex · design system</p>
          <h1>Workbench, set in type.</h1>
          <p className="lede">
            The Pi mark sits on the cube. Newsreader carries the prose, Departure Mono the labels,
            Commit Mono the code.
          </p>
        </header>

        <section className="section" id="logos">
          <h2>Logo</h2>
          <FigureFrame caption="Model">
            <div className="stage stage--model">
              <CubeMark />
            </div>
          </FigureFrame>
          <div className="logo-grid">
            <LogoTile src={mark} caption="Emblem" />
            <LogoTile src={markMono} caption="Mono" />
            <LogoTile src={markInverse} caption="Inverse" light />
            <LogoTile src={icon} caption="App icon" appIcon />
          </div>
          <div className="lockup-grid">
            <LogoTile src={logo} caption="Horizontal lockup" wide />
            <LogoTile src={logoStacked} caption="Stacked lockup" wide />
          </div>
        </section>

        <section className="section" id="styles">
          <h2>Styles</h2>
          <div className="style-grid">
            <LogoTile src={plate} caption="Plate" />
            <LogoTile src={stencil} caption="Stencil" />
            <LogoTile src={blueprint} caption="Blueprint" />
            <LogoTile src={seal} caption="Seal" />
            <LogoTile src={accent} caption="Accent" />
            <LogoTile src={warm} caption="Warm" />
          </div>
          <div className="style-grid style-grid--lockup">
            <LogoTile src={wordmark} caption="Wordmark" wide />
            <LogoTile src={editorial} caption="Editorial" wide />
            <LogoTile src={label} caption="Label" wide />
          </div>
        </section>

        <section className="section" id="round">
          <h2>Round</h2>
          <div className="round-grid">
            <LogoTile src={disc} caption="Disc" />
            <LogoTile src={arc} caption="Arc" />
            <LogoTile src={orbit} caption="Orbit" />
            <LogoTile src={bead} caption="Bead" />
          </div>
          <div className="object-grid">
            <FigureFrame caption="Ring">
              <div className="stage">
                <Ring />
              </div>
            </FigureFrame>
            <FigureFrame caption="Hoop">
              <div className="stage">
                <Hoop />
              </div>
            </FigureFrame>
            <FigureFrame caption="Orb">
              <div className="stage">
                <Orb />
              </div>
            </FigureFrame>
          </div>
        </section>

        <section className="section" id="mascot">
          <h2>Mascot</h2>
          <div className="mascot-grid">
            <FigureFrame caption="The cube and the dot">
              <div className="stage stage--mascot">
                <img src={mascot} alt="" />
              </div>
            </FigureFrame>
            <div className="specimen">
              <p className="ds-eyebrow">Desk pair</p>
              <h3>The mark, stood up.</h3>
              <p>
                The cube carries the Pi. The smaller cube is the square dot, set on the same ground.
                Same faces, same rim.
              </p>
            </div>
          </div>
          <div className="mascot-row">
            <LogoTile src={mascotDot} caption="Dot" />
            <LogoTile src={mascotPage} caption="Page" />
            <LogoTile src={mascotDesk} caption="Desk" />
          </div>
          <div className="mascot-row">
            <LogoTile src={mascotSignal} caption="Signal" />
            <LogoTile src={mascotHalo} caption="Halo" />
            <LogoTile src={mascotTurn} caption="Turn" />
            <LogoTile src={mascotTwins} caption="Twins" />
            <LogoTile src={mascotCairn} caption="Cairn" />
          </div>
          <LiveMascots />
        </section>

        <section className="section" id="piset">
          <h2>pi.dev set</h2>
          <PiSetDemo />
        </section>

        <section className="section" id="glyph">
          <h2>Glyph</h2>
          <GlyphFamilyDemo />
        </section>

        <section className="section" id="stamps">
          <h2>Stamps</h2>
          <StampsDemo />
        </section>

        <section className="section" id="schematic">
          <h2>Schematic</h2>
          <SchematicDemo />
        </section>

        <section className="section" id="objects">
          <h2>Objects</h2>
          <div className="object-grid">
            <FigureFrame caption="Sheet">
              <div className="stage">
                <SheetTurn />
              </div>
            </FigureFrame>
            <FigureFrame caption="Stack">
              <div className="stage">
                <PanelStack />
              </div>
            </FigureFrame>
            <FigureFrame caption="Token">
              <div className="stage">
                <TokenSpin />
              </div>
            </FigureFrame>
          </div>
        </section>

        <section className="section" id="colour">
          <h2>Colour</h2>
          <div className="swatches">
            {SWATCHES.map(([name, hex, fill]) => (
              <div className="swatch" key={name}>
                <div className="swatch-chip" style={{ background: fill }} />
                <span className="swatch-name">{name}</span>
                <span className="swatch-hex">{hex}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="type">
          <h2>Type</h2>
          <div className="type-grid">
            <div className="specimen">
              <p className="ds-eyebrow">Newsreader · prose</p>
              <h3>Every repo, in one glance.</h3>
              <p>
                A desktop workbench for the Pi coding agent. Sessions, branches, and what has gone
                stale, <em>set as a page rather than a chat.</em>
              </p>
            </div>
            <div className="specimen">
              <p className="ds-eyebrow">Departure Mono · labels</p>
              <p className="ds-label">workspaces · sessions</p>
              <p className="ds-eyebrow">Commit Mono · code</p>
              <p className="mono-sample">
                prepare(text, font)
                <br />
                layout(prepared, 780, 24)
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="patterns">
          <h2>Patterns</h2>
          <div className="pattern-grid">
            <FigureFrame caption="Blueprint">
              <div className="ds-blueprint pattern-swatch" />
            </FigureFrame>
            <FigureFrame caption="Hatch">
              <div className="ds-hatch pattern-swatch" />
            </FigureFrame>
            <FigureFrame caption="Loading">
              <div className="pattern-load">
                <Loader label="loading" />
                <Loader label="thinking" />
                <Loader label="opening" variant="rule" />
                <p className="ds-prompt">
                  <span className="ds-prompt-prefix">›</span>
                  <span className="ds-caret" />
                </p>
              </div>
            </FigureFrame>
          </div>
          <div className="pattern-split">
            <FigureFrame caption="Session list">
              <div className="frame-body">
                <Skeleton rows={4} />
              </div>
            </FigureFrame>
            <FigureFrame caption="Frame">
              <div className="stage">
                <FrameLoader label="loading" />
              </div>
            </FigureFrame>
          </div>
          <div className="pattern-split">
            <FigureFrame caption="Agent loop">
              <AgentLoop />
            </FigureFrame>
            <div className="specimen">
              <p className="ds-eyebrow">Session</p>
              <h3>Think, reply, tool, result.</h3>
              <p>
                The four steps a session already runs. The mark travels the square, and the step
                lights as it passes.
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="components">
          <h2>Components</h2>
          <div className="component-row">
            <Badge tone="active" label="live" pulse />
            <Badge tone="stale" label="stale" />
            <Badge tone="blocked" label="blocked" />
            <Badge tone="done" label="done" />
            <span className="ds-label">
              <PiMark size={12} /> agent
            </span>
          </div>
          <div className="component-row">
            <BracketButton>Open session</BracketButton>
            <BracketButton primary>New workspace</BracketButton>
          </div>
          <div className="component-grid">
            <FigureFrame caption="Fig. 01 · session" live>
              <div className="frame-body">
                <div className="ds-stat">
                  <span className="ds-stat-key">Branch</span>
                  <span className="ds-stat-value">main</span>
                </div>
                <div className="ds-stat">
                  <span className="ds-stat-key">Model</span>
                  <span className="ds-stat-value">pi</span>
                </div>
                <div className="ds-stat">
                  <span className="ds-stat-key">Rows</span>
                  <span className="ds-stat-value">measured</span>
                </div>
                <div className="ds-prompt">
                  <span className="ds-prompt-prefix">›</span>
                  <span>steer the workbench…</span>
                </div>
              </div>
            </FigureFrame>
            <div className="specimen">
              <label className="ds-field">
                <span className="ds-field-label">Workspace path</span>
                <input className="ds-input" defaultValue="~/projects/pidex" readOnly />
              </label>
              <p>
                Inline code sits in <code className="ds-code">Commit Mono</code>, with the accent
                kept to the brackets and the live mark.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type StateMode = MascotState | 'auto';

/** Cycles through the states every few seconds until one is picked. */
function useAutoState() {
  const [mode, setMode] = useState<StateMode>('auto');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (mode !== 'auto') return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 5200);
    return () => window.clearInterval(timer);
  }, [mode]);
  const state = mode === 'auto' ? LIVE_STATES[tick % LIVE_STATES.length] : mode;
  return { mode, setMode, state };
}

function StateSwitch({ mode, state, onChange }: { mode: StateMode; state: MascotState; onChange: (mode: StateMode) => void }) {
  return (
    <div className="live-mascots-switch" role="group" aria-label="Mascot state">
      {(['auto', ...LIVE_STATES] as const).map((option) => (
        <BracketButton key={option} primary={mode === option} aria-pressed={mode === option} onClick={() => onChange(option)}>
          {option === 'auto' ? `auto · ${STATE_LABEL[state]}` : STATE_LABEL[option]}
        </BracketButton>
      ))}
    </div>
  );
}

const PI_SHAPES: { id: PiShape; caption: string }[] = [
  { id: 'pip', caption: 'Pip · Pi is a circle' },
  { id: 'brackets', caption: 'Brackets · the frame' },
  { id: 'caret', caption: 'Caret · the cursor' },
  { id: 'glyph', caption: 'Glyph · the mark, stood up' },
  { id: 'stamp', caption: 'Stamp · the seal' },
];

const PI_LOOKS: { id: PiLook; label: string }[] = [
  { id: 'ink', label: 'ink' },
  { id: 'blueprint', label: 'blueprint' },
  { id: 'paper', label: 'paper' },
  { id: 'warm', label: 'warm' },
];

const PI_ICONS: PiIconName[] = ['pi', 'session', 'terminal', 'branch', 'diff', 'file', 'check', 'stop', 'loop', 'spark'];
const PI_RULES: { kind: RuleKind; label: string }[] = [
  { kind: 'ruler', label: 'Ruler · 4px and 20px ticks' },
  { kind: 'mark', label: 'Mark · the Pi between two hairlines' },
  { kind: 'dotted', label: 'Dotted · 8px step' },
  { kind: 'thread', label: 'Thread · tidal fading out' },
];

function LookSwitch({ look, onChange }: { look: PiLook; onChange: (look: PiLook) => void }) {
  return (
    <div className="live-mascots-switch" role="group" aria-label="Look">
      {PI_LOOKS.map((option) => (
        <BracketButton key={option.id} primary={look === option.id} aria-pressed={look === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </BracketButton>
      ))}
    </div>
  );
}

const GLYPH_POSES = [
  { id: 'glyph', caption: 'Glyph · the original', node: <PiMascot shape="glyph" /> },
  { id: 'peek', caption: 'Peek · eyes in the counter', node: <GlyphPeek /> },
  { id: 'carry', caption: 'Carry · the dot rides up top', node: <GlyphCarry /> },
  { id: 'walk', caption: 'Walk · on the road while it runs', node: <GlyphWalk /> },
  { id: 'assemble', caption: 'Assemble · built from its grid', node: <GlyphAssemble /> },
];

const GLYPH_SIZES = [16, 24, 32, 48, 72, 112];

function GlyphFamilyDemo() {
  const { mode, setMode, state } = useAutoState();
  const [look, setLook] = useState<PiLook>('ink');
  return (
    <div className="piset">
      <div className="live-mascots-head">
        <div>
          <p className="ds-eyebrow">Glyph family</p>
          <h3>The mark, stood up, and everything it can do.</h3>
        </div>
        <div className="piset-switches">
          <LookSwitch look={look} onChange={setLook} />
          <StateSwitch mode={mode} state={state} onChange={setMode} />
        </div>
      </div>

      <div className="piset-row">
        {GLYPH_POSES.map((pose) => (
          <FigureFrame key={pose.id} caption={pose.caption}>
            <PiSurface look={look} state={state} className="piset-stage">
              {pose.node}
            </PiSurface>
          </FigureFrame>
        ))}
      </div>

      <div className="glyph-pair">
        <FigureFrame caption="Extrude · twelve layers deep">
          <PiSurface look={look} state={state} className="glyph-stage">
            <GlyphExtrude />
          </PiSurface>
        </FigureFrame>
        <FigureFrame caption="Wordmark · the dot is the tittle">
          <PiSurface look={look} state={state} className="glyph-stage glyph-stage--word">
            <GlyphWordmark />
          </PiSurface>
        </FigureFrame>
      </div>

      <div className="glyph-pair">
        <FigureFrame caption="Terminal · block characters">
          <PiSurface look={look} state={state} className="glyph-stage glyph-stage--pixel">
            <GlyphPixel state={state} />
            <div className="pixel-term-text">
              <span className="pixel-term-title">pidex</span>
              <span>~/projects/pidex · main</span>
              <span className="pixel-term-state" data-state={state}>
                ● {STATE_LABEL[state]}
              </span>
            </div>
          </PiSurface>
        </FigureFrame>
        <FigureFrame caption="Sizes · 16 to 112px">
          <PiSurface look={look} state={state} className="glyph-stage glyph-stage--sizes">
            {GLYPH_SIZES.map((size) => (
              <div key={size} className="glyph-size">
                <GlyphMark size={size} face={size >= 24} />
                <span>{size}</span>
              </div>
            ))}
          </PiSurface>
        </FigureFrame>
      </div>
    </div>
  );
}

const PASSPORT: { node: ReactNode; left: string; top: string }[] = [
  { node: <SealStamp tone="done" tilt={-9} inked />, left: '3%', top: '16%' },
  { node: <PostmarkStamp tone="idle" tilt={3} date="28 SEP 26" inked />, left: '24%', top: '6%' },
  { node: <LabelStamp tone="done" tilt={-12} inked />, left: '62%', top: '12%' },
  { node: <SealStamp tone="blocked" tilt={12} text="PIDEX · FLAKY-E2E · 29 SEP 2026 ·" inked />, left: '76%', top: '34%' },
  { node: <TicketStamp tone="thinking" tilt={-3} session="fix-auth-redirect" number={14} inked />, left: '26%', top: '52%' },
  { node: <LabelStamp tone="input" tilt={7} inked>your turn</LabelStamp>, left: '6%', top: '74%' },
  { node: <PostmarkStamp tone="done" tilt={-5} date="01 OCT 26" inked />, left: '58%', top: '68%' },
];

function StampsDemo() {
  const { mode, setMode, state } = useAutoState();
  const [look, setLook] = useState<PiLook>('ink');
  const [inked, setInked] = useState(true);
  return (
    <div className="piset">
      <div className="live-mascots-head">
        <div>
          <p className="ds-eyebrow">Stamps</p>
          <h3>Seals, tickets, postmarks, and stickers.</h3>
          <p className="live-note">
            Each stamp is pressed again whenever the state changes. Worn ink speckles the ink and
            roughens its edge, like a real rubber stamp.
          </p>
        </div>
        <div className="piset-switches">
          <LookSwitch look={look} onChange={setLook} />
          <StateSwitch mode={mode} state={state} onChange={setMode} />
          <div className="live-mascots-switch">
            <BracketButton primary={inked} aria-pressed={inked} onClick={() => setInked((v) => !v)}>
              worn ink · {inked ? 'on' : 'off'}
            </BracketButton>
          </div>
        </div>
      </div>

      <div className="stamp-row">
        <FigureFrame caption="Label">
          <PiSurface look={look} state={state} className="stamp-stage">
            <StampPress pressKey={state}>
              <LabelStamp tone={state} tilt={-4} inked={inked} />
            </StampPress>
          </PiSurface>
        </FigureFrame>
        <FigureFrame caption="Seal · the Glyph in the middle">
          <PiSurface look={look} state={state} className="stamp-stage">
            <StampPress pressKey={state}>
              <SealStamp tone={state} tilt={-6} inked={inked} />
            </StampPress>
          </PiSurface>
        </FigureFrame>
        <FigureFrame caption="Ticket · one per run">
          <PiSurface look={look} state={state} className="stamp-stage">
            <StampPress pressKey={state}>
              <TicketStamp tone={state} tilt={2} session="fix-auth-redirect" number={14} inked={inked} />
            </StampPress>
          </PiSurface>
        </FigureFrame>
      </div>

      <div className="glyph-pair">
        <FigureFrame caption="Postmark · dated, with cancellation waves">
          <PiSurface look={look} state={state} className="stamp-stage">
            <StampPress pressKey={state}>
              <PostmarkStamp tone={state} tilt={-3} inked={inked} />
            </StampPress>
          </PiSurface>
        </FigureFrame>
        <FigureFrame caption="Review · the result ringed by hand">
          <PiSurface look={look} state={state} className="stamp-stage">
            <StampPress pressKey={state}>
              <ReviewStamp tone={state} tilt={3} session="fix-auth-redirect" turns={14} inked={inked} />
            </StampPress>
          </PiSurface>
        </FigureFrame>
      </div>

      <div className="live-block">
        <div>
          <p className="ds-eyebrow">Inks</p>
          <h3>One ink per state.</h3>
        </div>
        <PiSurface look={look} state={state} className="stamp-inks">
          {LIVE_STATES.map((tone, i) => (
            <div key={tone} className="stamp-ink">
              <SealStamp tone={tone} tilt={[-8, 5, -3, 9, -6][i]} inked={inked} />
              <span>{STATE_LABEL[tone]}</span>
            </div>
          ))}
        </PiSurface>
      </div>

      <div className="live-block">
        <div>
          <p className="ds-eyebrow">Passport</p>
          <h3>A page of collected stamps.</h3>
        </div>
        <div className="passport-scroll">
          <PiSurface look={look} state={state} className="passport">
            <div className="passport-head">
              <span className="passport-title">Passport</span>
              <span className="passport-meta">pidex · sessions this week</span>
            </div>
            {PASSPORT.map((item, i) => (
              <div key={i} className="passport-item" style={{ left: item.left, top: item.top }}>
                {item.node}
              </div>
            ))}
          </PiSurface>
        </div>
      </div>

      <div className="live-block">
        <div>
          <p className="ds-eyebrow">Stickers</p>
          <h3>Die-cut, for laptops and READMEs.</h3>
        </div>
        <PiSurface look={look} state={state} className="sticker-sheet">
          <Sticker kind="glyph" tilt={-8} />
          <Sticker kind="pi" tilt={6} />
          <Sticker kind="built" tilt={-4} />
          <Sticker kind="ship" tilt={5} />
        </PiSurface>
      </div>
    </div>
  );
}

const SHEET_LOOKS: { id: PiLook; label: string }[] = [
  { id: 'blueprint', label: 'blueprint' },
  { id: 'paper', label: 'whiteprint' },
  { id: 'ink', label: 'ink' },
];

function SchematicDemo() {
  const { mode, setMode, state } = useAutoState();
  const [look, setLook] = useState<PiLook>('blueprint');
  return (
    <div className="piset">
      <div className="live-mascots-head">
        <div>
          <p className="ds-eyebrow">Schematic</p>
          <h3>The Glyph, drawn up as a blueprint.</h3>
          <p className="live-note">
            A dimensioned elevation, an exploded view with a parts list, and the session state
            schema. The current state lights its box and flows out along its arrows, and the
            seal is pressed onto the title block.
          </p>
        </div>
        <div className="piset-switches">
          <div className="live-mascots-switch" role="group" aria-label="Sheet look">
            {SHEET_LOOKS.map((option) => (
              <BracketButton key={option.id} primary={look === option.id} aria-pressed={look === option.id} onClick={() => setLook(option.id)}>
                {option.label}
              </BracketButton>
            ))}
          </div>
          <StateSwitch mode={mode} state={state} onChange={setMode} />
        </div>
      </div>
      <div className="sheet-scroll">
        <PiSurface look={look} state={state} className="sheet">
          <GlyphSchematic state={state} />
        </PiSurface>
      </div>
    </div>
  );
}

function PiSetDemo() {
  const { mode, setMode, state } = useAutoState();
  const [look, setLook] = useState<PiLook>('ink');
  return (
    <div className="piset">
      <div className="live-mascots-head">
        <div>
          <p className="ds-eyebrow">Shapes</p>
          <h3>Five shapes, four looks, one set of inks.</h3>
        </div>
        <div className="piset-switches">
          <div className="live-mascots-switch" role="group" aria-label="Look">
            {PI_LOOKS.map((option) => (
              <BracketButton key={option.id} primary={look === option.id} aria-pressed={look === option.id} onClick={() => setLook(option.id)}>
                {option.label}
              </BracketButton>
            ))}
          </div>
          <StateSwitch mode={mode} state={state} onChange={setMode} />
        </div>
      </div>

      <div className="piset-row">
        {PI_SHAPES.map((shape) => (
          <FigureFrame key={shape.id} caption={shape.caption}>
            <PiSurface look={look} state={state} className="piset-stage">
              <PiMascot shape={shape.id} label={`${shape.id}, ${STATE_LABEL[state]}`} />
            </PiSurface>
          </FigureFrame>
        ))}
      </div>

      <div className="live-block">
        <div>
          <p className="ds-eyebrow">Every look</p>
          <h3>Four looks for every shape.</h3>
        </div>
        <div className="piset-matrix">
          {PI_LOOKS.map((row) => (
            <div key={row.id} className="piset-matrix-row">
              <span className="piset-matrix-label">{row.label}</span>
              {PI_SHAPES.map((shape) => (
                <PiSurface key={shape.id} look={row.id} state={state} className="piset-tile">
                  <PiMascot shape={shape.id} label={`${shape.id} in ${row.label}`} />
                </PiSurface>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="live-block">
        <div>
          <p className="ds-eyebrow">Assets</p>
          <h3>Stamps, rules, icons, and an empty state.</h3>
        </div>
        <PiSurface look={look} state={state} className="piset-assets">
          <div className="piset-stamps">
            <PiStamp tone="idle" tilt={-2}>draft</PiStamp>
            <PiStamp tone="thinking" tilt={3}>running</PiStamp>
            <PiStamp tone="input" tilt={-4}>your turn</PiStamp>
            <PiStamp tone="blocked" tilt={2}>blocked</PiStamp>
            <PiStamp tone="done" tilt={-3}>shipped</PiStamp>
          </div>
          <div className="piset-rules">
            {PI_RULES.map((rule) => (
              <div key={rule.kind} className="piset-rule">
                <PiRule kind={rule.kind} />
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
          <div className="piset-icons">
            {PI_ICONS.map((name) => (
              <div key={name} className="piset-icon">
                <PiIcon name={name} size={24} />
                <span>{name}</span>
              </div>
            ))}
          </div>
          <div className="piset-empty">
            <PiSurface look={look} state="idle" className="piset-empty-mascot">
              <PiMascot shape="brackets" label="Empty state" />
            </PiSurface>
            <div className="piset-empty-text">
              <h4>Nothing running yet.</h4>
              <p>Start a session and it will show up here.</p>
              <code>› pidex new "fix the flaky test"</code>
            </div>
          </div>
        </PiSurface>
      </div>
    </div>
  );
}

const LIVE_STATES: MascotState[] = ['idle', 'thinking', 'input', 'blocked', 'done'];

const STATE_LABEL: Record<MascotState, string> = {
  idle: 'idle',
  thinking: 'running',
  input: 'needs input',
  blocked: 'blocked',
  done: 'ready',
};

type RosterRow = {
  name: string;
  meta: string;
  status: string;
  state: MascotState;
  tone: MascotTone;
  gear: MascotGear;
  badge?: BadgeTone;
};

const ROSTER: RosterRow[] = [
  { name: 'fix-auth-redirect', meta: 'pidex · turn 14', status: 'Running the auth tests', state: 'thinking', tone: 'accent', gear: 'antenna', badge: 'active' },
  { name: 'migrate-sqlite', meta: 'pidex · turn 6', status: 'Wants to drop the sessions table', state: 'input', tone: 'warm', gear: 'bead', badge: 'stale' },
  { name: 'flaky-e2e', meta: 'pidex · turn 22', status: 'Chrome would not start in CI', state: 'blocked', tone: 'rust', gear: 'none', badge: 'blocked' },
  { name: 'readme-stills', meta: 'pidex · turn 9', status: 'Four stills are ready to review', state: 'done', tone: 'sage', gear: 'halo', badge: 'done' },
  { name: 'scratch', meta: 'pidex · turn 0', status: 'Waiting for a prompt', state: 'idle', tone: 'blue', gear: 'none' },
];

const VARIANTS: { tone: MascotTone; gear: MascotGear; caption: string }[] = [
  { tone: 'accent', gear: 'antenna', caption: 'Accent · antenna' },
  { tone: 'warm', gear: 'bead', caption: 'Warm · bead' },
  { tone: 'sage', gear: 'halo', caption: 'Sage · halo' },
  { tone: 'rust', gear: 'none', caption: 'Rust · bare' },
];

function MascotRoster() {
  return (
    <div className="live-block">
      <div>
        <p className="ds-eyebrow">Roster</p>
        <h3>One Blink per session.</h3>
        <p className="live-note">
          Each session gets a top face and a piece of gear, so you can tell them apart. The face
          and the signal above the head show what the session is doing, and hold for as long as
          that state lasts.
        </p>
      </div>
      <ul className="roster">
        {ROSTER.map((row) => (
          <li key={row.name} className="roster-row">
            <BlinkMascot
              compact
              state={row.state}
              tone={row.tone}
              gear={row.gear}
              label={`${row.name}, ${STATE_LABEL[row.state]}`}
            />
            <div className="roster-text">
              <span className="roster-name">{row.name}</span>
              <span className="roster-meta">
                {row.meta} · {row.status}
              </span>
            </div>
            {row.badge ? (
              <Badge tone={row.badge} label={STATE_LABEL[row.state]} pulse={row.state === 'thinking'} />
            ) : (
              <span className="roster-idle">{STATE_LABEL[row.state]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MascotVariants({ state }: { state: MascotState }) {
  return (
    <div className="live-block">
      <div>
        <p className="ds-eyebrow">Variants</p>
        <h3>Tone and gear.</h3>
      </div>
      <div className="variant-grid">
        {VARIANTS.map((v) => (
          <FigureFrame key={v.caption} caption={v.caption}>
            <div className="stage stage--variant">
              <BlinkMascot compact state={state} tone={v.tone} gear={v.gear} />
            </div>
          </FigureFrame>
        ))}
      </div>
    </div>
  );
}

const PIXEL_SKINS: { id: PixelSkin; caption: string; note: string }[] = [
  { id: 'mono', caption: 'Mono', note: 'The whole body takes the state colour' },
  { id: 'terminal', caption: 'Terminal', note: 'pi.dev terminal: #142433 and #f8f8f2' },
  { id: 'cube', caption: 'Cube', note: 'Parchment lid, lit right face, tidal left' },
  { id: 'crest', caption: 'Crest', note: 'The Pi mark worn on the head' },
  { id: 'blueprint', caption: 'Blueprint', note: 'Accent linework on the page grid' },
  { id: 'paper', caption: 'Paper', note: 'Light theme: evening blue on moonstone' },
];

function MascotTerminal({ state }: { state: MascotState }) {
  return (
    <div className="live-block">
      <div>
        <p className="ds-eyebrow">Terminal</p>
        <h3>Blink in block characters, in pi.dev colours.</h3>
        <p className="live-note">
          For the CLI and for anywhere without SVG. Seven columns wide, in the same five states.
          Each skin takes its colours from pi.dev, and the signal above the head always takes the
          state colour.
        </p>
      </div>
      <FigureFrame caption="pidex · session header">
        <div className="pixel-term">
          <PixelMascot state={state} skin="crest" />
          <div className="pixel-term-text">
            <span className="pixel-term-title">pidex</span>
            <span>~/projects/pidex · main</span>
            <span className="pixel-term-state" data-state={state}>
              ● {STATE_LABEL[state]}
            </span>
          </div>
        </div>
      </FigureFrame>
      <div className="skin-grid">
        {PIXEL_SKINS.map((skin) => (
          <FigureFrame key={skin.id} caption={skin.caption}>
            <div className={`skin-card skin-card--${skin.id}`}>
              <PixelMascot state={state} skin={skin.id} />
              {skin.id === 'terminal' ? (
                <span className="skin-prompt">
                  › pidex <span className="ds-caret" />
                </span>
              ) : null}
              <span className="skin-note">{skin.note}</span>
            </div>
          </FigureFrame>
        ))}
      </div>
      <div className="pixel-row">
        {LIVE_STATES.map((s) => (
          <div key={s} className="pixel-cell">
            <PixelMascot state={s} />
            <span>{STATE_LABEL[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveMascots() {
  const { mode, setMode, state } = useAutoState();
  return (
    <div className="live-mascots">
      <div className="live-mascots-head">
        <div>
          <p className="ds-eyebrow">Alive</p>
          <h3>Three takes on the pair, moving.</h3>
        </div>
        <StateSwitch mode={mode} state={state} onChange={setMode} />
      </div>
      <div className="object-grid">
        <FigureFrame caption="Blink · watches the pointer">
          <div className="stage">
            <BlinkMascot state={state} />
          </div>
        </FigureFrame>
        <FigureFrame caption="Prompt · the code mascot">
          <div className="stage">
            <PromptMascot state={state} />
          </div>
        </FigureFrame>
        <FigureFrame caption="Fold · opens into its net">
          <div className="stage">
            <FoldMascot state={state} />
          </div>
        </FigureFrame>
      </div>
      <MascotVariants state={state} />
      <MascotRoster />
      <MascotTerminal state={state} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Demo />
    </StrictMode>,
  );
}
