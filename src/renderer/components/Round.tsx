import { PiMark } from './PiMark';

function Orb() {
  return (
    <div className="ds-object" role="img" aria-label="Turning orb">
      <div className="ds-object-scene">
        <div className="ds-orb-spin">
          <div className="ds-orb">
            <PiMark size={36} />
          </div>
        </div>
      </div>
      <span className="ds-loader">
        <span>orb</span>
      </span>
    </div>
  );
}

function Hoop() {
  return (
    <div className="ds-object" role="img" aria-label="Turning hoop">
      <div className="ds-object-scene">
        <div className="ds-hoop-spin">
          <div className="ds-hoop" />
        </div>
      </div>
      <span className="ds-loader">
        <span>hoop</span>
      </span>
    </div>
  );
}

function Ring() {
  return (
    <span className="ds-loader" role="status">
      <svg className="ds-ring" viewBox="0 0 32 32" aria-hidden="true">
        <circle className="ds-ring-track" cx="16" cy="16" r="11" />
        <circle className="ds-ring-head" cx="16" cy="16" r="11" />
      </svg>
      <span>loading</span>
    </span>
  );
}

export { Hoop, Orb, Ring };
