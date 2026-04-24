import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type FooterVariant = 'public' | 'support' | 'admin-support';

const SUPPORT_EMAIL = 'sks4266@gmail.com';

export default function PolicySupportFooter({ variant = 'public' }: { variant?: FooterVariant }) {
  return (
    <footer style={footerWrap}>
      <div style={topRow}>
        <div>
          <div style={brand}>CHRISTIANDLP</div>
          <div style={desc}>이용약관 · 개인정보 처리방침 · 문의 / 요청 접수</div>
        </div>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={mailLink}>
          {SUPPORT_EMAIL}
        </a>
      </div>

      <div style={linkRow}>
        <FooterLink to="/" label="홈" />
        <FooterLink to="/terms" label="이용약관" />
        <FooterLink to="/privacy" label="개인정보 처리방침" />
        <FooterLink to="/support" label="문의 / 요청 접수" />
        {variant === 'admin-support' ? <FooterLink to="/admin/support" label="관리자 접수함" /> : null}
      </div>
    </footer>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={footerLink}>
      {label}
    </Link>
  );
}

const footerWrap: CSSProperties = {
  marginTop: 18,
  marginBottom: 20,
  paddingTop: 14,
  borderTop: '1px solid rgba(190,205,220,0.45)'
};

const topRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap'
};

const brand: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#7f9aa2'
};

const desc: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.6,
  color: '#61717a'
};

const mailLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#42535c',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};

const linkRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12
};

const footerLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#4b5b64',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};
