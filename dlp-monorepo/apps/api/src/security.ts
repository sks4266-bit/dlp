function utf8(s: string) {
  return new TextEncoder().encode(s);
}

export function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasswordPBKDF2(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
  const keyMaterial = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210_000 },
    keyMaterial,
    256
  );
  const bytes = new Uint8Array(bits);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
