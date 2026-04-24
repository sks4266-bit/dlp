import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../ui/Card';

type FooterVariant = 'public' | 'support' | 'admin-support';

export default function PolicySupportFooter({ variant = 'public' }: { variant?: FooterVariant }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { me } = useAuth();
  const supportEmail = 'sks4266@gmail.com';

  return (
    <Card pad style={footerCard}>
      <div style={brandRow}>
        <div>
          <div style={eyebrow}>CHRISTIANDLP</div>
          <div style={brandTitle}>정책 확인과 문의 / 요청 접수를 한 흐름으로 연결했습니다</div>
        </div>
        <div style={miniMeta}>문의 {supportEmail}</div>
      </div>

      <div style={footerDesc}>
        이용약관, 개인정보 처리방침, 문의 / 요청 접수 화면을 서로 자연스럽게 오갈 수 있도록 공통 푸터를 제공합니다.
        {variant === 'admin-support'
          ? ' 운영자는 접수함에서 처리한 뒤 필요하면 사용자 관점의 페이지로 바로 이동해 다시 확인할 수 있습니다.'
          : ' 사용자는 정책을 읽다가 바로 문의, 버그 리포트, 탈퇴 요청, 개인정보 삭제 요청으로 이어질 수 있습니다.'}
      </div>

      <div style={sectionTitle}>바로가기</div>
      <div style={linkGrid}>
        <FooterLink to="/terms" label="이용약관" active={loc.pathname === '/terms'} />
        <FooterLink to="/privacy" label="개인정보 처리방침" active={loc.pathname === '/privacy'} />
        <FooterLink to="/support" label="문의 / 요청 접수" active={loc.pathname === '/support'} />
        <a href={`mailto:${supportEmail}`} style={footerLink}>
          이메일 문의
        </a>
      </div>

      <div style={sectionTitle}>추가 이동</div>
      <div style={actionRow}>
        {variant !== 'admin-support' && me ? (
          <button type="button" style={actionBtn} onClick={() => nav('/me')}>
            내정보 / 탈퇴
          </button>
        ) : null}

        {me?.isAdmin ? (
          <button
            type="button"
            style={actionBtn}
            onClick={() => nav(variant === 'admin-support' ? '/admin' : '/admin/support')}
          >
            {variant === 'admin-support' ? '관리자 홈' : '관리자 접수함'}
          </button>
        ) : null}

        <button type="button" style={actionBtnSoft} onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    </Card>
  );
}

function FooterLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        ...footerLink,
        ...(active ? footerLinkActive : null)
      }}
    >
      {label}
    </Link>
  );
}

const footerCard = {
  marginTop: 16,
  marginBottom: 20,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,251,255,0.74))'
};

const brandRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap' as const,
  alignItems: 'flex-start'
};

const eyebrow = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const brandTitle = {
  marginTop: 8,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const miniMeta = {
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

const footerDesc = {
  marginTop: 10,
  fontSize: 13,
  lineHeight: 1.75,
  color: '#61717a'
};

const sectionTitle = {
  marginTop: 16,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#7f9aa2'
};

const linkGrid = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
  marginTop: 10
};

const footerLink = {
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

const footerLinkActive = {
  border: '1px solid rgba(159,195,255,0.3)',
  background: 'rgba(239,246,255,0.92)',
  color: '#4c74ab'
};

const actionRow = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
  marginTop: 10
};

const actionBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7b70',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer'
};

const actionBtnSoft = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#4d5d66',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer'
};
