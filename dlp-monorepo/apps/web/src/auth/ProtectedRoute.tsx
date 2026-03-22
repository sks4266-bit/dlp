import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            fontWeight: 800
          }}
        >
          로그인 상태 확인 중…
        </div>
      </div>
    );
  }

  if (!me) {
    const next = `${loc.pathname}${loc.search}`;
    return <Navigate to={`/login?${new URLSearchParams({ next }).toString()}`} replace />;
  }

  return <>{children}</>;
}
