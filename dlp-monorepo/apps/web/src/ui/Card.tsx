import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode
} from 'react';

function cx(...xs: Array<string | undefined | false | null>) {
  return xs.filter(Boolean).join(' ');
}

type CardTone = 'default' | 'mint' | 'peach' | 'plain';
type CardShadow = 'default' | 'soft' | 'none';

type CardProps = {
  children?: ReactNode;
  className?: string;
  pad?: boolean;
  tight?: boolean;
  tone?: CardTone;
  shadow?: CardShadow;
} & HTMLAttributes<HTMLElement>;

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    children,
    className,
    pad = true,
    tight = false,
    tone = 'default',
    shadow = 'default',
    style,
    ...rest
  },
  ref
) {
  const mergedStyle: CSSProperties = {
    ...getToneStyle(tone),
    ...getShadowStyle(shadow),
    ...(tight ? tightPadStyle : null),
    ...style
  };

  return (
    <section
      {...rest}
      ref={ref}
      className={cx('uiCard', pad ? 'uiCardPad' : '', className)}
      style={mergedStyle}
    >
      {children}
    </section>
  );
});

type TextBlockProps = {
  children?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export const CardTitle = forwardRef<HTMLDivElement, TextBlockProps>(function CardTitle(
  { children, className, style, ...rest },
  ref
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx('uiCardTitle', className)}
      style={style}
    >
      {children}
    </div>
  );
});

export const CardDesc = forwardRef<HTMLDivElement, TextBlockProps>(function CardDesc(
  { children, className, style, ...rest },
  ref
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx('uiCardDesc', className)}
      style={style}
    >
      {children}
    </div>
  );
});

export const CardEyebrow = forwardRef<HTMLDivElement, TextBlockProps>(function CardEyebrow(
  { children, className, style, ...rest },
  ref
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={className}
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: '0.08em',
        color: '#83a39a',
        lineHeight: 1.2,
        ...style
      }}
    >
      {children}
    </div>
  );
});

function getToneStyle(tone: CardTone): CSSProperties {
  if (tone === 'mint') {
    return {
      background: 'linear-gradient(180deg, rgba(244,255,252,0.86), rgba(238,250,247,0.72))',
      border: '1px solid rgba(114,215,199,0.24)'
    };
  }

  if (tone === 'peach') {
    return {
      background: 'linear-gradient(180deg, rgba(255,248,244,0.9), rgba(255,242,236,0.76))',
      border: '1px solid rgba(243,180,156,0.26)'
    };
  }

  if (tone === 'plain') {
    return {
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(255,255,255,0.56)'
    };
  }

  return {};
}

function getShadowStyle(shadow: CardShadow): CSSProperties {
  if (shadow === 'soft') {
    return {
      boxShadow: '0 10px 24px rgba(93,108,122,0.08)'
    };
  }

  if (shadow === 'none') {
    return {
      boxShadow: 'none'
    };
  }

  return {};
}

const tightPadStyle: CSSProperties = {
  padding: 16
};
