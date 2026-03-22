import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export default function Button({
  variant = 'ghost',
  size = 'md',
  wide,
  left,
  right,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  wide?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'uiBtn';

  const v =
    variant === 'primary'
      ? 'uiBtnPrimary'
      : variant === 'secondary'
        ? 'uiBtnSecondary'
        : variant === 'danger'
          ? 'uiBtnDanger'
          : 'uiBtnGhost';

  const s = size === 'lg' ? 'uiBtnLg' : 'uiBtnMd';
  const w = wide ? 'uiBtnWide' : '';

  const cls = [base, v, s, w, className].filter(Boolean).join(' ');

  return (
    <button {...rest} className={cls}>
      <span className="uiBtnInner">
        {left ? <span className="uiBtnIcon">{left}</span> : null}
        <span className="uiBtnLabel">{children}</span>
        {right ? <span className="uiBtnIcon">{right}</span> : null}
      </span>
    </button>
  );
}
