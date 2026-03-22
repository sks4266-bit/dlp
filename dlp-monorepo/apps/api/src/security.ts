// apps/api/src/security.ts

function utf8(s: string) {
  return new TextEncoder().encode(s);
}

function hexToBytes(hex: string) {
  const clean = hex.trim().toLowerCase();
  if (!clean || clean.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }

  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: ArrayLike<number>) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

// Cloudflare Workers Free 플랜 대응용:
// 너무 높은 iteration은 CPU 제한에 걸릴 수 있어서 우선 10,000으로 둡니다.
// 필요하면 20,000 정도까지 올려가며 테스트하세요.
const PBKDF2_ITERATIONS = 10_000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_BITS = 256;

export async function hashPasswordPBKDF2(password: string, saltHex: string) {
  const salt = hexToBytes(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    PBKDF2_BITS
  );

  return bytesToHex(new Uint8Array(bits));
}

// 선택사항: 로그인 비교를 더 명확히 하고 싶으면 사용
export async function verifyPasswordPBKDF2(
  password: string,
  saltHex: string,
  expectedHashHex: string
) {
  const actual = await hashPasswordPBKDF2(password, saltHex);
  return actual === expectedHashHex;
}
