const STEPS = [
  ['think', 'ds-loop-node--think'],
  ['reply', 'ds-loop-node--reply'],
  ['tool', 'ds-loop-node--tool'],
  ['result', 'ds-loop-node--result'],
] as const;

function AgentLoop() {
  return (
    <div className="ds-loop" role="img" aria-label="Agent loop: think, reply, tool, result">
      <div className="ds-loop-stage">
        <svg className="ds-loop-svg" viewBox="0 0 200 200" aria-hidden="true">
          <rect className="ds-loop-track" x="4" y="4" width="192" height="192" />
          <rect className="ds-loop-head" x="4" y="4" width="192" height="192" />
        </svg>
        {STEPS.map(([label, place]) => (
          <span key={label} className={`ds-loop-node ${place}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { AgentLoop };
