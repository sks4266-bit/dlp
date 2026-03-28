import type { ReactNode } from 'react';
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

  return (
    <header className="topBar topBarGlass">
      <div className="topBarLeft">
        {backTo ? (
          <Button
            variant="ghost"
            className="topBarBackBtn"
            onClick={() => nav(backTo)}
            aria-label=""
            title=""
          >
            ‹
          </Button>
        ) : (
          <div className="topBarBackSpacer" />
        )}

        <div className="topBarTitle" title={title}>
          {title}
        </div>
      </div>

      <div className="topBarRight">
        {right ? <div className="topBarRightSlot">{right}</div> : null}

        {!hideAuthActions ? (
          <>
            {!me && !loading ? (
              <Button variant="secondary" className="topBarAuthBtn" onClick={goLogin}>
                {' '}
              </Button>
            ) : null}

            {me ? (
              <>
                {me.isAdmin ? (
                  <Button variant="ghost" className="topBarMiniBtn" onClick={() => nav('/admin')} aria-label="ADMIN">
                    ADMIN
                  </Button>
                ) : null}

                <Button variant="ghost" className="topBarMiniBtn" onClick={() => nav('/me')} aria-label="">
                  {' '}
                </Button>

                <Button
                  variant="ghost"
                  className="topBarMiniBtn"
                  onClick={() => {
                    logout();
                    nav('/');
                  }}
                  aria-label=""
                >
                  {' '}
                </Button>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}
