import { useLocation, useNavigate, Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';
import { Card, CardDesc, CardTitle } from '../ui/Card';

export default function UrgentPrayerNewPage() {
  const nav = useNavigate();
  const location = useLocation();

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="긴급기도 작성" backTo="/urgent-prayers" />

        <Card className="glassHeroCard">
          <div style={heroHead}>
            <div style={{ minWidth: 0 }}>
              <div style={badgePeach}>
                <SirenIcon />
                URGENT PRAYER
              </div>

              <CardTitle>지금 필요한 한 가지 기도제목</CardTitle>
              <CardDesc>
                
              </CardDesc>
            </div>

            <div style={heroSide}>
              <div style={heroSideMain}>24h</div>
              <div style={heroSideLabel}>노출 시간</div>
            </div>
          </div>

          <div className="stack12" />

          <div style={metaRow}>
            <MetaChip icon={<ClockIcon />} label="등록 후 24시간 노출" tone="peach" />
            <MetaChip icon={<PeopleIcon />} label="교회 공용 게시판" tone="mint" />
            <MetaChip icon={<NameIcon />} label="작성자 실명 표시" tone="neutral" />
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <div style={sectionTop}>
            <div>
              <CardTitle>작성 폼</CardTitle>
              <CardDesc>
                
              </CardDesc>
            </div>
            <div style={sectionBadgePeach}>Compose</div>
          </div>

          <div className="stack12" />

          <UrgentPrayerComposer
            onUnauthorized={goLogin}
            onDone={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
          />
        </Card>

        <div className="stack12" />

        <Card>
          <div style={sectionTop}>
            <div>
              <CardTitle>작성 가이드</CardTitle>
              <CardDesc>
                
              </CardDesc>
            </div>
            <div style={sectionBadgeMint}>Guide</div>
          </div>

          <div className="stack10" />

          <div style={helperPanel}>
            <div style={helperTitle}>좋은 예시</div>
            <div style={helperDesc}>
              
            </div>
          </div>

          <div className="stack10" />

          <div style={helperPanel}>
            <div style={helperTitle}>작성 팁</div>
            <div style={helperDesc}>
              
            </div>
          </div>

          <div className="stack10" />

          <div style={helperPanel}>
            <div style={helperTitle}>목록으로 돌아가기</div>
            <div style={helperDesc}>
              이미 등록된 긴급기도를 다시 확인하려면{' '}
              <Link to="/urgent-prayers" style={linkText}>
                긴급기도 목록
              </Link>
              으로 돌아가세요.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetaChip({
  icon,
  label,
  tone = 'neutral'
}: {
  icon: ReactNode;
  label: string;
  tone?: 'mint' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint' ? metaMint : tone === 'peach' ? metaPeach : metaNeutral;

  return (
    <div style={{ ...metaChip, ...toneStyle }}>
      <span style={metaIcon}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function SirenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0v5h12V8Z" />
      <path d="M5 13h14" />
      <path d="M10 18h4" />
      <path d="M12 2v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m19.1 4.9-1.4 1.4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function NameIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

const heroHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap'
};

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  marginBottom: 10,
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448',
  fontSize: 12,
  fontWeight: 800
};

const heroSide: CSSProperties = {
  width: 92,
  minWidth: 92,
  height: 92,
  borderRadius: 999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.56)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.44)'
};

const heroSideMain: CSSProperties = {
  color: '#223038',
  fontSize: 26,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const heroSideLabel: CSSProperties = {
  marginTop: 6,
  color: '#8f7e75',
  fontSize: 11,
  fontWeight: 800
};

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const metaChip: CSSProperties = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '-0.01em'
};

const metaIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const metaMint: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72'
};

const metaPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const metaNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const sectionTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const sectionBadgeBase: CSSProperties = {
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  flex: '0 0 auto'
};

const sectionBadgePeach: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(235,168,141,0.15)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const sectionBadgeMint: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const helperPanel: CSSProperties = {
  borderRadius: 16,
  padding: '12px 13px',
  background: 'rgba(255,255,255,0.42)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const helperTitle: CSSProperties = {
  color: '#42515b',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4
};

const helperDesc: CSSProperties = {
  color: '#6f7d87',
  fontSize: 12,
  lineHeight: 1.55
};

const linkText: CSSProperties = {
  color: '#2b7f72',
  fontWeight: 800,
  textDecoration: 'none'
};

const icon16: CSSProperties = {
  width: 16,
  height: 16,
  display: 'block'
};
