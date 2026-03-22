import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getToken, setToken } from '../lib/api';

export type Me = {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  homeChurch: string | null;
  isAdmin: boolean;
};

type AuthState = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    username: string;
    password: string;
    phone?: string;
    homeChurch?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: any }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  function clearAuth() {
    setToken(null);
    setTokenState(null);
    setMe(null);
  }

  async function refreshMe() {
    const currentToken = getToken();
    if (!currentToken) {
      setMe(null);
      return;
    }

    try {
      const res = await apiFetch('/api/me');

      if (res.status === 401) {
        clearAuth();
        return;
      }

      if (!res.ok) {
        throw new Error(`ME_${res.status}`);
      }

      const data = await res.json();
      setMe(data);
    } catch (err) {
      console.error('refreshMe failed:', err);
      // 네트워크/일시 장애 시 토큰을 지우지 않음
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await refreshMe();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function login(username: string, password: string) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? 'LOGIN_FAILED');

    setToken(data.token);
    setTokenState(data.token);
    await refreshMe();
  }

  async function register(payload: {
    name: string;
    username: string;
    password: string;
    phone?: string;
    homeChurch?: string;
  }) {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? 'REGISTER_FAILED');
  }

  function logout() {
    clearAuth();
  }

  const value = useMemo<AuthState>(
    () => ({ token, me, loading, login, register, logout, refreshMe }),
    [token, me, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider is missing');
  return v;
}
