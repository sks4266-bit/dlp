import type { ReactNode, HTMLAttributes } from 'react';

function cx(...xs: Array<string | undefined | false | null>) {
  return xs.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  pad = true,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
  pad?: boolean;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={cx('uiCard', pad ? 'uiCardPad' : '', className)}>
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  className,
  ...rest
}: { children?: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('uiCardTitle', className)}>
      {children}
    </div>
  );
}

export function CardDesc({
  children,
  className,
  ...rest
}: { children?: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('uiCardDesc', className)}>
      {children}
    </div>
  );
}
