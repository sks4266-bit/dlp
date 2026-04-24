import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../ui/Card';

type HeaderNavVariant = 'terms' | 'privacy' | 'support' | 'admin-support';

export default function PolicySupportHeaderNav({ variant }: { variant: HeaderNavVariant }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { me } = useAuth();
  const supportEmail = 'sks4266@gmail.com';

  const items = [
    {
      key: 'terms',
      label: '이용약관',
      to: '/terms',
      show: variant !== 'terms'
    },
    {
      key: 'privacy',
      label: '개인정보 처리방침',
      to: '/privacy',
      show: variant !== 'privacy'
    },
    {
      key: 'support',
      label: '문의 / 요청 접수',
      to: '/support',
      show: variant !== 'support'
    }
  ].filter((item) => item.show);

  return (
    <Card pad style={cardStyle}>
      <div style={eyebrow}>QUICK NAVIGATION</div>
      <div style={titleStyle}>{getTitle(variant)}</div>
      <div style={descStyle}>{getDescription(variant)}</div>

      <div style={chipRow}>
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            style={{
              ...chip,
              ...(loc.pathname === item.to ? chipActive : null)
            }}
          >
            {item.label}
          </Link>
        ))}

        {variant !== 'admin-support' ? (
          <a href={`mailto:${supportEmail}`} style={chip}>
            {supportEmail}
          </a>
        ) : null}

        {variant === 'support' && me ? (
          <button type="button" style={buttonChip} onClick={() => nav('/me')}>
            내정보 / 탈퇴
          </button>
        ) : null}

        {me?.isAdmin ? (
          variant === 'admin-support' ? (
            <button type="button" style={buttonChip} onClick={() => nav('/admin')}>
              관리자 홈
            </button>
          ) : (
            <button type="button" style={buttonChip} onClick={() => nav('/admin/support')}>
              관리자 접수함
            </button>
          )
        ) : null}
      </div>
    </Card>
  );
}

function getTitle(variant: HeaderNavVariant) {
  if (variant === 'terms') return '이용약관과 관련 페이지를 바로 이동할 수 있어요';
  if (variant === 'privacy') return '개인정보 처리 기준과 요청 채널을 함께 확인할 수 있어요';
  if (variant === 'support') return '정책 확인과 접수 동선을 한 화면에서 연결했어요';
  return '운영 처리 화면과 사용자 접수 흐름을 함께 볼 수 있어요';
}

function getDescription(variant: HeaderNavVariant) {
  if (variant === 'terms') {
    return '약관을 읽다가 개인정보 처리방침이나 문의 / 요청 접수 화면으로 자연스럽게 이동할 수 있도록 구성했습니다.';
  }
  if (variant === 'privacy') {
    return '권리 행사, 탈퇴, 개인정보 삭제 요청 전 필요한 정책과 접수 화면을 빠르게 연결합니다.';
  }
  if (variant === 'support') {
    return '접수 전에 이용약관과 개인정보 처리방침을 다시 확인하고, 필요하면 이메일이나 내정보 화면으로 이어질 수 있습니다.';
  }
  return '관리자는 접수함에서 처리하고, 필요 시 사용자 관점의 정책/접수 화면으로 다시 이동해 검토할 수 있습니다.';
}

const cardStyle = {
  marginBottom: 12,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(247,251,255,0.72))'
};

const eyebrow = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#7b99bf'
};

const titleStyle = {
  marginTop: 8,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const descStyle = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#61717a'
};

const chipRow = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
  marginTop: 14
};

const chip = {
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

const chipActive = {
  border: '1px solid rgba(114,215,199,0.28)',
  background: 'linear-gradient(180deg, rgba(240,255,251,0.96), rgba(233,250,246,0.88))',
  color: '#2c7d72'
};

const buttonChip = {
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
