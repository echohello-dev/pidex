import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge } from './components/Badge';
import { BracketButton } from './components/BracketButton';
import { CubeMark } from './components/CubeMark';
import { FigureFrame } from './components/FigureFrame';
import { PiMark } from './components/PiMark';
import mark from '../../assets/mark.svg';
import markMono from '../../assets/mark-mono.svg';
import markInverse from '../../assets/mark-inverse.svg';
import icon from '../../assets/icon.svg';
import logo from '../../assets/logo.svg';
import logoStacked from '../../assets/logo-stacked.svg';
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

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Demo />
    </StrictMode>,
  );
}
