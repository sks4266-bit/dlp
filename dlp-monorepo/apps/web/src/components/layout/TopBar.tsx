import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

/**
 * 모바일 상단바(최소형)
 * - 좌측: (옵션) 뒤로
 * - 가운데: 타이틀
 * - 우측: 로그인/내정보/로그아웃 (+ ADMIN)
 */
export default function TopBar({
  title,
  backTo,
  right,
  hideAuthActions
}: {
  title: string;
  backTo?: string;
  right?: any;
  /** 로그인/내정보/로그아웃 버튼 숨김 (로그인/회원가입 화면용) */
  hideAuthActions?: boolean;
}) {
  const nav = useNavigate();
  const { me, loading, logout } = useAuth();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {backTo && (
          <button type="button" onClick={() => nav(backTo)} aria-label="뒤로" style={backBtn}>
            ‹
          </button>
        )}
        <div style={{ fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {right}

        {!hideAuthActions && (
          <>
            {!me && !loading && (
              <button type="button" onClick={() => nav('/login')} style={ghostBtn}>
                로그인
              </button>
            )}

            {me && (
              <>
                {me.isAdmin && (
                  <Link to="/admin" style={ghostLink} aria-label="ADMIN 대시보드">
                    ADMIN
                  </Link>
                )}
                <Link to="/me" style={ghostLink} aria-label="내정보">
                  내정보
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    nav('/');
                  }}
                  style={ghostBtn}
                  aria-label="로그아웃"
                >
                  로그아웃
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 900
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontWeight: 900,
  fontSize: 13
};

const ghostLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 900,
  fontSize: 13,
  color: 'var(--text)',
  textDecoration: 'none'
};
