type SkeletonProps = {
  rows?: number;
};

function Skeleton({ rows = 4 }: SkeletonProps) {
  return (
    <div className="ds-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="ds-skeleton-row" key={row}>
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export { Skeleton };
