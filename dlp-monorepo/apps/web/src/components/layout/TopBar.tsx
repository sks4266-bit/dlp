import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

/**
 * 모바일 상단바(최소형)
 * - 좌측: (옵션) 뒤로
 * - 가운데: 타이틀
 * - 우측: 로그인 (+ ADMIN, 내정보/로그아웃은 홈/내정보에서 처리)
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
  /** 우측 인증 버튼 숨김 (로그인/회원가입 화면용) */
  hideAuthActions?: boolean;
}) {
  const nav = useNavigate();
  const { me, loading } = useAuth();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {backTo && (
          <button type="button" onClick={() => nav(backTo)} aria-label="뒤로" style={backBtn}>
            ‹
          </button>
        )}
        <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {title}
        </div>
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

            {me?.isAdmin && (
              <Link to="/admin" style={ghostLink} aria-label="ADMIN 대시보드">
                ADMIN
              </Link>
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
  border: '1px solid rgba(0,0,0,0.08)',
  background: 'white',
  fontSize: 18,
  fontWeight: 900
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.08)',
  background: 'white',
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
  border: '1px solid rgba(0,0,0,0.08)',
  background: 'white',
  fontWeight: 900,
  fontSize: 13,
  color: 'rgba(0,0,0,0.88)',
  textDecoration: 'none'
};
