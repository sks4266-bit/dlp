import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export default function SimplePageHeader({
  title,
  backTo = '/',
  backLabel = '홈으로'
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div style={wrap}>
      <Link to={backTo} style={backLink}>
        ← {backLabel}
      </Link>
      <div style={titleStyle}>{title}</div>
    </div>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 12,
  padding: '4px 2px 2px'
};

const backLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#4b5b64',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};

const titleStyle: CSSProperties = {
  fontSize: 24,
  lineHeight: 1.2,
  fontWeight: 900,
  color: '#24313a',
  letterSpacing: '-0.02em'
};
