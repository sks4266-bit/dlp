import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card';

type FooterVariant = 'public' | 'support' | 'admin-support';

const SUPPORT_EMAIL = 'sks4266@gmail.com';

export default function PolicySupportFooter({ variant = 'public' }: { variant?: FooterVariant }) {
  return (
    <Card pad style={footerCard}>
      <div style={brandRow}>
        <div>
          <div style={eyebrow}>CHRISTIANDLP</div>
          <div style={brandTitle}>정책 확인과 문의 / 요청 접수를 하나의 흐름으로 연결했습니다</div>
        </div>
        <div style={miniMeta}>문의 {SUPPORT_EMAIL}</div>
      </div>

      <div style={footerDesc}>
        이용약관, 개인정보 처리방침, 문의하기, 버그 리포트, 계정 탈퇴 요청, 개인정보 삭제 요청이 서로
        자연스럽게 이어지도록 공통 footer를 제공합니다.
        {variant === 'admin-support'
          ? ' 운영자는 관리자 접수함에서 처리한 뒤 공개 정책 화면으로 이동해 기준을 다시 확인할 수 있습니다.'
          : ' 이용자는 정책을 읽다가 바로 접수 화면으로 이동해 요청을 남길 수 있습니다.'}
      </div>

      <div style={sectionTitle}>바로가기</div>
      <div style={linkGrid}>
        <Link to="/" style={footerLink}>
          홈
        </Link>
        <Link to="/terms" style={footerLink}>
          이용약관
        </Link>
        <Link to="/privacy" style={footerLink}>
          개인정보 처리방침
        </Link>
        <Link to="/support" style={footerLink}>
          문의 / 요청 접수
        </Link>
        {variant === 'admin-support' ? (
          <Link to="/admin/support" style={footerLink}>
            관리자 접수함
          </Link>
        ) : null}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={footerLink}>
          이메일 문의
        </a>
      </div>
    </Card>
  );
}

const footerCard: CSSProperties = {
  marginTop: 16,
  marginBottom: 20,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,251,255,0.74))'
};

const brandRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const brandTitle: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const miniMeta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  color: '#42535c',
  fontSize: 12,
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.56)'
};

const footerDesc: CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  lineHeight: 1.75,
  color: '#61717a'
};

const sectionTitle: CSSProperties = {
  marginTop: 16,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#7f9aa2'
};

const linkGrid: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10
};

const footerLink: CSSProperties = {
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
