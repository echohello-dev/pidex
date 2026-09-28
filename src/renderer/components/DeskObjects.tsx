import type { ReactNode } from 'react';
import { PiMark } from './PiMark';

function ObjectStage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-object" role="img" aria-label={label}>
      <div className="ds-object-scene">{children}</div>
      <span className="ds-loader">
        <span>{label}</span>
      </span>
    </div>
  );
}

function SheetTurn() {
  return (
    <ObjectStage label="sheet">
      <div className="ds-sheet-spin">
        <div className="ds-sheet">
          <i />
          <i />
          <PiMark size={28} />
        </div>
        <div className="ds-sheet ds-sheet--back" />
      </div>
    </ObjectStage>
  );
}

function PanelStack() {
  return (
    <ObjectStage label="stack">
      <div className="ds-stack-spin">
        <div className="ds-panel3" />
        <div className="ds-panel3" />
        <div className="ds-panel3" />
      </div>
    </ObjectStage>
  );
}

function TokenSpin() {
  return (
    <ObjectStage label="token">
      <div className="ds-token-spin">
        <div className="ds-token">
          <PiMark size={40} />
        </div>
        <div className="ds-token ds-token--back">
          <PiMark size={40} />
        </div>
      </div>
    </ObjectStage>
  );
}

export { PanelStack, SheetTurn, TokenSpin };
