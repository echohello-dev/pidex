import type { ButtonHTMLAttributes } from 'react';

type BracketButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
};

function BracketButton({
  primary = false,
  className,
  children,
  ...rest
}: BracketButtonProps) {
  const classes = ['ds-button', primary ? 'ds-button--primary' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      aria-label={typeof children === 'string' ? children : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

export { BracketButton };
