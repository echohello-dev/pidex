type BadgeTone = 'active' | 'stale' | 'blocked' | 'done';

type BadgeProps = {
  tone: BadgeTone;
  label: string;
  pulse?: boolean;
};

function Badge({ tone, label, pulse = false }: BadgeProps) {
  const classes = ['ds-badge', `ds-badge--${tone}`, pulse ? 'ds-badge--pulse' : '']
    .filter(Boolean)
    .join(' ');
  return <span className={classes}>{label}</span>;
}

export { Badge };
export type { BadgeTone };
