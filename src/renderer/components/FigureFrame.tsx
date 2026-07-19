import type { ReactNode } from 'react';

type FigureFrameProps = {
  caption?: string;
  live?: boolean;
  children: ReactNode;
  className?: string;
};

function FigureFrame({ caption, live = false, children, className }: FigureFrameProps) {
  const classes = ['ds-frame', className].filter(Boolean).join(' ');
  return (
    <figure className={classes}>
      <span className="ds-frame-corner ds-frame-corner--tl" aria-hidden="true" />
      <span className="ds-frame-corner ds-frame-corner--tr" aria-hidden="true" />
      <span className="ds-frame-corner ds-frame-corner--bl" aria-hidden="true" />
      <span className="ds-frame-corner ds-frame-corner--br" aria-hidden="true" />
      {caption ? (
        <figcaption className="ds-frame-caption">
          <span>{caption}</span>
          {live ? <span className="ds-live-dot" aria-hidden="true" /> : null}
        </figcaption>
      ) : null}
      {children}
    </figure>
  );
}

export { FigureFrame };
