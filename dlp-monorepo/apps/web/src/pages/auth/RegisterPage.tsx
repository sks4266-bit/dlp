import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import TopBar from '../../components/layout/TopBar';

export default function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [homeChurch, setHomeChurch] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <TopBar title="회원가입" backTo="/login" hideAuthActions />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setOk(null);
          setLoading(true);
          try {
            await register({ name, username, password, phone: phone || undefined, homeChurch: homeChurch || undefined });
            setOk('가입이 완료되었습니다. 로그인 해주세요.');
            setTimeout(() => nav('/login'), 600);
          } catch (e: any) {
            setErr(e?.message ?? '회원가입에 실패했습니다.');
          } finally {
            setLoading(false);
          }
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <Field label="이름(실명)">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="아이디">
          <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} autoCapitalize="none" />
        </Field>
        <Field label="비밀번호(8자 이상)">
          <input value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} type="password" />
        </Field>
        <Field label="휴대폰번호(선택)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" />
        </Field>
        <Field label="출석교회(선택)">
          <input value={homeChurch} onChange={(e) => setHomeChurch(e.target.value)} style={inputStyle} />
        </Field>

        {err && <div style={errorStyle}>{err}</div>}
        {ok && <div style={okStyle}>{ok}</div>}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? '처리 중…' : '회원가입'}
        </button>

        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 15
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 900,
  fontSize: 15
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: 'rgba(255,0,0,0.06)',
  border: '1px solid rgba(255,0,0,0.18)'
};

const okStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: 'var(--soft)',
  border: '1px solid var(--border)'
};
