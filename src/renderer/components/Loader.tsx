type LoaderProps = {
  label?: string;
  variant?: 'ticks' | 'rule';
};

function Loader({ label = 'loading', variant = 'ticks' }: LoaderProps) {
  return (
    <span className="ds-loader" role="status">
      {variant === 'ticks' ? (
        <span className="ds-loader-ticks" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : (
        <span className="ds-scan" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}

export { Loader };
