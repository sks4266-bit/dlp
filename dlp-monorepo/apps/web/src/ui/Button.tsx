import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = {
  variant?: Variant;
  size?: Size;
  wide?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant = 'ghost',
  size = 'md',
  wide = false,
  left,
  right,
  className,
  children,
  loading = false,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const base = 'uiBtn';

  const variantClass =
    variant === 'primary'
      ? 'uiBtnPrimary'
      : variant === 'secondary'
        ? 'uiBtnSecondary'
        : variant === 'danger'
          ? 'uiBtnDanger'
          : 'uiBtnGhost';

  const sizeClass = size === 'lg' ? 'uiBtnLg' : 'uiBtnMd';
  const widthClass = wide ? 'uiBtnWide' : '';

  const cls = [base, variantClass, sizeClass, widthClass, className]
    .filter(Boolean)
    .join(' ');

  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      {...rest}
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : 'false'}
    >
      <span style={inner}>
        {loading ? (
          <span style={iconWrap} aria-hidden="true">
            <Spinner />
          </span>
        ) : left ? (
          <span className="uiBtnIcon" style={iconWrap}>
            {left}
          </span>
        ) : null}

        <span className="uiBtnLabel" style={label}>
          {children}
        </span>

        {!loading && right ? (
          <span className="uiBtnIcon" style={iconWrap}>
            {right}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={spinner}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" opacity="0.28" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

const inner: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minWidth: 0
};

const iconWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  lineHeight: 0
};

const label: CSSProperties = {
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap'
};

const spinner: CSSProperties = {
  width: 16,
  height: 16,
  animation: 'buttonSpin 0.85s linear infinite'
};
