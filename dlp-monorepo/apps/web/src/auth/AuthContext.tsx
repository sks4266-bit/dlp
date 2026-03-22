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
  register: (payload: { name: string; username: string; password: string; phone?: string; homeChurch?: string }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: any }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    if (!getToken()) {
      setMe(null);
      return;
    }
    const res = await apiFetch('/api/me');
    if (!res.ok) {
      setToken(null);
      setTokenState(null);
      setMe(null);
      return;
    }
    setMe(await res.json());
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function register(payload: { name: string; username: string; password: string; phone?: string; homeChurch?: string }) {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? 'REGISTER_FAILED');
  }

  function logout() {
    setToken(null);
    setTokenState(null);
    setMe(null);
  }

  const value = useMemo<AuthState>(() => ({ token, me, loading, login, register, logout, refreshMe }), [token, me, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider is missing');
  return v;
}