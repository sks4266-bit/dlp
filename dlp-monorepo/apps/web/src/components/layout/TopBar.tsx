import type { CSSProperties, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../ui/Button';

export default function TopBar({
  title,
  backTo,
  right,
  hideAuthActions
}: {
  title: string;
  backTo?: string;
  right?: ReactNode;
  hideAuthActions?: boolean;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const { me, loading, logout } = useAuth();

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  function goBack() {
    if (!backTo) return;
    nav(backTo);
  }

  function handleLogout() {
    logout();
    nav('/');
  }

  return (
    <header style={wrap}>
      <div style={glass}>
        <div style={leftArea}>
          {backTo ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="topBarBackBtn"
              onClick={goBack}
              aria-label="뒤로"
              title="뒤로"
            >
              <span style={backBtnInner}>
                <BackIcon />
              </span>
            </Button>
          ) : (
            <div style={backSpacer} aria-hidden="true" />
          )}

          <div style={titleBlock}>
            <div style={titleText} title={title}>
              {title}
            </div>
            {!hideAuthActions && me ? (
              <div style={subText}>
                {me.name ? `${me.name}님` : me.username} · 오늘도 차분하게 이어가요
              </div>
            ) : null}
          </div>
        </div>

        <div style={rightArea}>
          {right ? <div style={rightSlot}>{right}</div> : null}

          {!hideAuthActions ? (
            <>
              {!me && !loading ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="topBarAuthBtn"
                  onClick={goLogin}
                >
                  로그인
                </Button>
              ) : null}

              {!me && loading ? (
                <div style={statusPill} aria-label="인증 상태 확인 중">
                  확인 중…
                </div>
              ) : null}

              {me ? (
                <>
                  {me.isAdmin ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      className="topBarMiniBtn"
                      onClick={() => nav('/admin')}
                      aria-label="ADMIN 대시보드"
                      title="ADMIN"
                    >
                      ADMIN
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="topBarMiniBtn"
                    onClick={() => nav('/me')}
                    aria-label="내정보"
                    title="내정보"
                  >
                    내정보
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="topBarMiniBtn"
                    onClick={handleLogout}
                    aria-label="로그아웃"
                    title="로그아웃"
                  >
                    로그아웃
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon18}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

const wrap: CSSProperties = {
  marginBottom: 14
};

const glass: CSSProperties = {
  minHeight: 62,
  padding: '10px 12px',
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.62))',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 10px 24px rgba(93,108,122,0.10)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)'
};

const leftArea: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

const rightArea: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  flexShrink: 0
};

const rightSlot: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const titleBlock: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: 'grid',
  gap: 3
};

const titleText: CSSProperties = {
  minWidth: 0,
  color: '#223038',
  fontSize: '1.82rem',
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const subText: CSSProperties = {
  minWidth: 0,
  color: '#7a8790',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const backSpacer: CSSProperties = {
  width: 42,
  height: 42,
  flex: '0 0 42px'
};

const backBtnInner: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  transform: 'translateX(-1px)'
};

const statusPill: CSSProperties = {
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const icon18: CSSProperties = {
  width: 18,
  height: 18
};
