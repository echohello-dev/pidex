const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

function Plane({ back = false }: { back?: boolean }) {
  const plane = ['ds-frame-loader-plane', back ? 'ds-frame-loader-plane--back' : 'ds-frame-loader-plane--front']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={plane}>
      {CORNERS.map(corner => (
        <span key={corner} className={`ds-frame-loader-corner ds-frame-loader-corner--${corner}`} />
      ))}
    </div>
  );
}

function FrameLoader({ label = 'loading' }: { label?: string }) {
  return (
    <div className="ds-frame-loader" role="status" aria-label={label}>
      <div className="ds-frame-loader-scene">
        <div className="ds-frame-loader-spin">
          <Plane />
          <Plane back />
        </div>
      </div>
      <span className="ds-loader">
        <span>{label}</span>
      </span>
    </div>
  );
}

export { FrameLoader };
