import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card';

type HeaderNavVariant = 'terms' | 'privacy' | 'support' | 'admin-support';

const SUPPORT_EMAIL = 'sks4266@gmail.com';

export default function PolicySupportHeaderNav({ variant }: { variant: HeaderNavVariant }) {
  return (
    <Card pad style={cardStyle}>
      <div style={eyebrow}>POLICY & SUPPORT</div>
      <div style={title}>{getTitle(variant)}</div>
      <div style={desc}>{getDesc(variant)}</div>

      <div style={chipRow}>
        <NavChip to="/terms" label="이용약관" active={variant === 'terms'} />
        <NavChip to="/privacy" label="개인정보 처리방침" active={variant === 'privacy'} />
        <NavChip to="/support" label="문의 / 요청 접수" active={variant === 'support'} />
        <a href={`mailto:${SUPPORT_EMAIL}`} style={chipLink}>
          {SUPPORT_EMAIL}
        </a>
        {variant === 'admin-support' ? <span style={chipActive}>관리자 접수함</span> : null}
      </div>
    </Card>
  );
}

function NavChip({ to, label, active }: { to: string; label: string; active?: boolean }) {
  if (active) {
    return <span style={chipActive}>{label}</span>;
  }

  return (
    <Link to={to} style={chipLink}>
      {label}
    </Link>
  );
}

function getTitle(variant: HeaderNavVariant) {
  if (variant === 'terms') return '이용약관과 관련 페이지를 한 흐름으로 확인할 수 있어요';
  if (variant === 'privacy') return '개인정보 처리 기준과 권리 행사 채널을 함께 확인할 수 있어요';
  if (variant === 'support') return '문의, 버그 리포트, 탈퇴/삭제 요청을 한 곳에서 접수할 수 있어요';
  return '관리자는 접수함에서 처리하고, 정책 화면으로 다시 이동해 검토할 수 있어요';
}

function getDesc(variant: HeaderNavVariant) {
  if (variant === 'terms') {
    return '약관을 읽다가 개인정보 처리방침 또는 문의/요청 접수 화면으로 자연스럽게 이동할 수 있도록 연결했습니다.';
  }
  if (variant === 'privacy') {
    return '개인정보 수집·이용 기준, 보관 기간, 삭제 요청 절차를 확인한 뒤 바로 문의 화면으로 이동할 수 있습니다.';
  }
  if (variant === 'support') {
    return '접수 전에 약관과 개인정보 처리방침을 다시 확인하고, 필요 시 이메일로도 운영자에게 연락할 수 있습니다.';
  }
  return '운영자는 관리자 접수함에서 상태를 변경하고, 공개 정책 페이지와 사용자 접수 화면을 빠르게 오가며 확인할 수 있습니다.';
}

const cardStyle: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,251,255,0.76))'
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#7b99bf'
};

const title: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const desc: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#61717a'
};

const chipRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 14
};

const chipLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#43545d',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};

const chipActive: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'linear-gradient(180deg, rgba(240,255,251,0.96), rgba(233,250,246,0.88))',
  border: '1px solid rgba(114,215,199,0.28)',
  color: '#2c7d72',
  fontSize: 12,
  fontWeight: 800
};
