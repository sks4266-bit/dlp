import type { ReactNode, HTMLAttributes } from 'react';

export function Card({
  children,
  className,
  pad = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
} & HTMLAttributes<HTMLElement>) {
  const cls = ['uiCard', pad ? 'uiCardPad' : '', className].filter(Boolean).join(' ');
  return (
    <section {...rest} className={cls}>
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="uiCardTitle">{children}</div>;
}

export function CardDesc({ children }: { children: ReactNode }) {
  return <div className="uiCardDesc">{children}</div>;
}
