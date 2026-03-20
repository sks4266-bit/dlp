export function getToken() {
  return localStorage.getItem('dlp_token');
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem('dlp_token');
  else localStorage.setItem('dlp_token', token);
}

const API_BASE = (() => {
  try {
    // Vite env (Cloudflare Pages에서도 설정 가능)
    return String((import.meta as any)?.env?.VITE_API_BASE ?? '').trim();
  } catch {
    return '';
  }
})();

function resolveApiUrl(input: RequestInfo): RequestInfo {
  // 대부분 이 앱에서는 문자열로 '/api/...' 형태를 사용
  if (typeof input === 'string') {
    if (API_BASE && input.startsWith('/api')) {
      return `${API_BASE.replace(/\/$/, '')}${input}`;
    }
    return input;
  }

  if (input instanceof Request) {
    const url = input.url;
    try {
      const u = new URL(url);
      if (API_BASE && u.pathname.startsWith('/api')) {
        const next = `${API_BASE.replace(/\/$/, '')}${u.pathname}${u.search}`;
        return new Request(next, input);
      }
    } catch {
      // ignore
    }
  }

  return input;
}

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(resolveApiUrl(input), { ...init, headers });
}
