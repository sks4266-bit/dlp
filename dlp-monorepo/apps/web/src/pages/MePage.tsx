import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useUiPrefs } from '../ui/UiPrefsContext';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';

type MeStats = {
  attendanceDays: number;
  week: {
    start: string;
    end: string;
    submittedCount: number;
    days: { date: string; hasDlp: boolean }[];
  };
};

type GratitudeEntry = { id: string; date: string; content: string; createdAt: number };

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ym(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ymdFromParts(y: number, m: number, day: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me, logout, refreshMe } = useAuth();
  const ui = useUiPrefs();

  const [stats, setStats] = useState<MeStats | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editChurch, setEditChurch] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const section = useMemo(() => new URLSearchParams(loc.search).get('section') || '', [loc.search]);
  const [gratExpanded, setGratExpanded] = useState(false);

  const [gratMonth, setGratMonth] = useState(() => ym(kstNow()));
  const [gratItems, setGratItems] = useState<GratitudeEntry[]>([]);
  const [gratErr, setGratErr] = useState<string | null>(null);

  const [gratEditorOpen, setGratEditorOpen] = useState(false);
  const [gratEditorDate, setGratEditorDate] = useState('');
  const [gratContent, setGratContent] = useState('');
  const [gratSaving, setGratSaving] = useState(false);

  const gratMap = useMemo(() => {
    const m = new Map<string, GratitudeEntry>();
    gratItems.forEach((it) => m.set(it.date, it));
    return m;
  }, [gratItems]);

  const { gratYear, gratMon } = useMemo(() => {
    const [y, m] = gratMonth.split('-').map(Number);
    return { gratYear: y, gratMon: m };
  }, [gratMonth]);

  const gratFirstDow = useMemo(() => {
    const d = new Date(Date.UTC(gratYear, gratMon - 1, 1));
    return d.getUTCDay();
  }, [gratYear, gratMon]);

  const gratDaysInMonth = useMemo(() => {
    return new Date(Date.UTC(gratYear, gratMon, 0)).getUTCDate();
  }, [gratYear, gratMon]);

  function goLogin(next = '/me') {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadStats() {
    if (!me) return;
    const res = await apiFetch('/api/me/stats');
    if (res.status === 401) {
      goLogin('/me');
      return;
    }
    if (!res.ok) return;
    setStats(await res.json());
  }

  async function loadGratitude() {
    setGratErr(null);
    try {
      const res = await apiFetch(`/api/gratitude?month=${encodeURIComponent(gratMonth)}`);
      if (res.status === 401) {
        goLogin('/me?section=gratitude');
        return;
      }
      if (!res.ok) throw new Error('LOAD_FAILED');
      setGratItems(await res.json());
    } catch (e: any) {
      setGratErr(e?.message ?? '감사일기를 불러오지 못했습니다.');
    }
  }

  function openGratitudeEditor(date: string) {
    setGratEditorDate(date);
    setGratContent(gratMap.get(date)?.content ?? '');
    setGratEditorOpen(true);
  }

  useEffect(() => {
    if (section === 'gratitude') setGratExpanded(true);
  }, [section]);

  useEffect(() => {
    (async () => {
      if (!me) return;
      await loadStats();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    setEditName(me?.name ?? '');
    setEditPhone(me?.phone ?? '');
    setEditChurch(me?.homeChurch ?? '');
  }, [me?.id]);

  useEffect(() => {
    if (!me) return;
    if (!gratExpanded && section !== 'gratitude') return;
    loadGratitude();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, gratMonth, gratExpanded, section]);

  if (!me) return null;

  return (
    <div>
      <TopBar title="내정보" backTo="/" />
      <div style={{ height: 12 }} />

      <div style={card}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>{me.name}</div>
        <div style={meta}>아이디: {me.username}</div>
        <div style={meta}>휴대폰: {me.phone ?? '-'}</div>
        <div style={meta}>출석교회: {me.homeChurch ?? '-'}</div>
        <div style={meta}>권한: {me.isAdmin ? 'ADMIN' : '일반'}</div>
      </div>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>간단 통계</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label="누적 출석일(DLP 제출)" value={stats?.attendanceDays ?? '-'} />
          <Stat label="이번 주 제출" value={stats ? `${stats.week.submittedCount}/7` : '-'} />
        </div>

        <div style={{ height: 12 }} />

        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>
          이번 주 제출 현황 ({stats?.week.start ?? '—'} ~ {stats?.week.end ?? '—'})
        </div>

        <div style={{ height: 8 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {(stats?.week.days ?? Array.from({ length: 7 }).map((_, i) => ({ date: String(i), hasDlp: false }))).map((d, idx) => (
            <div
              key={idx}
              title={String(d.date)}
              style={{
                height: 28,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: d.hasDlp ? 'var(--primary-bg)' : 'rgba(0,0,0,0.05)'
              }}
            />
          ))}
        </div>

        <div style={{ height: 8 }} />

        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          기준: DLP 제출(dlp_entries)이 있는 날짜를 “출석일”로 집계합니다.
        </div>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>UI 설정</div>

        <label style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>테마</div>
          <select
            value={ui.theme}
            onChange={(e) => ui.setTheme(e.target.value as any)}
            style={{ height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', padding: '0 10px', fontWeight: 900 }}
          >
            <option value="system">시스템</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </label>

        <div style={{ height: 12 }} />

        <label style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>폰트 크기</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min={0.9}
              max={1.25}
              step={0.05}
              value={ui.scale}
              onChange={(e) => ui.setScale(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <div style={{ minWidth: 56, textAlign: 'right', fontWeight: 950 }}>{Math.round(ui.scale * 100)}%</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
            앱 전체에 적용됩니다.
          </div>
        </label>
      </section>

      <div style={{ height: 12 }} />

      <section style={card} id="gratitude">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 950 }}>감사일기</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
              달력에서 날짜를 탭하면 작성/수정할 수 있어요.
            </div>
          </div>

          <button
            type="button"
            style={ghostBtn}
            onClick={() => {
              const next = !gratExpanded;
              setGratExpanded(next);
              if (next) {
                const qs = new URLSearchParams(loc.search);
                qs.set('section', 'gratitude');
                nav(`/me?${qs.toString()}`, { replace: true });
              }
            }}
          >
            {gratExpanded ? '접기' : '열기'}
          </button>
        </div>

        {gratExpanded ? (
          <>
            <div style={{ height: 12 }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <input type="month" value={gratMonth} onChange={(e) => setGratMonth(e.target.value)} style={monthInput} />
              <button type="button" style={ghostBtn} onClick={() => setGratMonth(ym(kstNow()))}>
                이번달
              </button>
            </div>

            <div style={{ height: 10 }} />
            {gratErr && <div style={errorBox}>{gratErr}</div>}

            <div style={{ fontWeight: 950, marginBottom: 10 }}>달력</div>
            <div style={gridHeader}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={grid}>
              {Array.from({ length: gratFirstDow }).map((_, i) => (
                <div key={'e' + i} />
              ))}
              {Array.from({ length: gratDaysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = ymdFromParts(gratYear, gratMon, day);
                const has = gratMap.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openGratitudeEditor(date)}
                    style={{
                      ...cell,
                      background: has ? 'var(--primary-bg)' : 'rgba(0,0,0,0.04)',
                      color: has ? 'var(--primary-text)' : 'rgba(0,0,0,0.85)'
                    }}
                    aria-label={`${date} 감사일기 ${has ? '작성됨' : '미작성'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>이번 달 기록</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>{gratItems.length}개</div>
            </div>

            <div style={{ height: 10 }} />

            {gratItems.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>이번 달 기록이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {gratItems.slice(0, 12).map((it) => (
                  <button key={it.id} type="button" style={listRow} onClick={() => openGratitudeEditor(it.date)}>
                    <div style={{ fontWeight: 950 }}>{it.date}</div>
                    <div style={{ marginTop: 6, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{it.content}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <BottomSheet open={gratEditorOpen} onClose={() => setGratEditorOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>감사일기 · {gratEditorDate}</div>
        <div style={{ height: 10 }} />
        <textarea
          value={gratContent}
          onChange={(e) => setGratContent(e.target.value)}
          placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
          style={textarea}
        />
        <div style={{ height: 10 }} />
        <button
          type="button"
          style={{ ...primaryBtn, opacity: gratSaving ? 0.7 : 1 }}
          disabled={gratSaving}
          onClick={async () => {
            if (!gratEditorDate) return;
            if (!gratContent.trim()) {
              alert('내용을 입력하세요.');
              return;
            }
            setGratSaving(true);
            try {
              const res = await apiFetch(`/api/gratitude/${gratEditorDate}`, {
                method: 'PUT',
                body: JSON.stringify({ content: gratContent })
              });
              if (res.status === 401) {
                goLogin('/me?section=gratitude');
                return;
              }
              if (!res.ok) throw new Error('SAVE_FAILED');
              await loadGratitude();
              setGratEditorOpen(false);
            } catch {
              alert('저장에 실패했습니다.');
            } finally {
              setGratSaving(false);
            }
          }}
        >
          {gratSaving ? '저장 중…' : '저장'}
        </button>
      </BottomSheet>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>내정보 수정</div>

        <Field label="이름(실명)">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="휴대폰">
          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={input} inputMode="tel" />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="출석교회">
          <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} style={input} />
        </Field>

        <div style={{ height: 12 }} />

        <button
          type="button"
          disabled={savingProfile}
          style={{ ...btn, opacity: savingProfile ? 0.7 : 1 }}
          onClick={async () => {
            setSavingProfile(true);
            try {
              const res = await apiFetch('/api/me', {
                method: 'PATCH',
                body: JSON.stringify({
                  name: editName,
                  phone: editPhone || null,
                  homeChurch: editChurch || null
                })
              });

              if (res.status === 401) {
                goLogin('/me');
                return;
              }

              if (!res.ok) throw new Error('SAVE_FAILED');
              await refreshMe();
              alert('내정보가 저장되었습니다.');
            } catch {
              alert('저장에 실패했습니다.');
            } finally {
              setSavingProfile(false);
            }
          }}
        >
          {savingProfile ? '저장 중…' : '내정보 저장'}
        </button>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>비밀번호 변경</div>

        <Field label="현재 비밀번호">
          <input value={curPw} onChange={(e) => setCurPw(e.target.value)} style={input} type="password" />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="새 비밀번호(8자 이상)">
          <input value={newPw} onChange={(e) => setNewPw(e.target.value)} style={input} type="password" />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="새 비밀번호 확인">
          <input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} style={input} type="password" />
        </Field>

        <div style={{ height: 12 }} />

        <button
          type="button"
          disabled={savingPw}
          style={{ ...btn, opacity: savingPw ? 0.7 : 1 }}
          onClick={async () => {
            if (!curPw || !newPw) {
              alert('비밀번호를 입력하세요.');
              return;
            }
            if (newPw !== newPw2) {
              alert('새 비밀번호 확인이 일치하지 않습니다.');
              return;
            }

            setSavingPw(true);
            try {
              const res = await apiFetch('/api/me/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: curPw, newPassword: newPw })
              });

              if (res.status === 401) {
                alert('현재 비밀번호가 올바르지 않습니다.');
                return;
              }

              if (!res.ok) throw new Error('PW_CHANGE_FAILED');

              alert('비밀번호가 변경되었습니다. 보안을 위해 다시 로그인합니다.');
              logout();
              goLogin('/me');
            } catch {
              alert('비밀번호 변경에 실패했습니다.');
            } finally {
              setSavingPw(false);
              setCurPw('');
              setNewPw('');
              setNewPw2('');
            }
          }}
        >
          {savingPw ? '변경 중…' : '비밀번호 변경'}
        </button>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          비밀번호 변경 시 모든 로그인 세션이 만료되어 다시 로그인해야 합니다.
        </div>
      </section>

      <div style={{ height: 12 }} />

      <button
        type="button"
        style={{ ...btn, background: 'var(--soft)', border: '1px solid var(--border)', color: 'rgba(0,0,0,0.8)' }}
        onClick={() => {
          logout();
          nav('/');
        }}
      >
        로그아웃
      </button>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 18,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtn, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 900 }}>{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ padding: 10, borderRadius: 14, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const meta: React.CSSProperties = {
  marginTop: 6,
  color: 'rgba(0,0,0,0.6)',
  fontSize: 13
};

const input: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 15
};

const btn: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 950
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 900,
  fontSize: 13
};

const monthInput: React.CSSProperties = {
  height: 40,
  padding: '0 10px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 900
};

const gridHeader: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const grid: React.CSSProperties = {
  marginTop: 8,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6
};

const cell: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 950
};

const listRow: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  resize: 'vertical',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 14,
  lineHeight: 1.45
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 950,
  fontSize: 15
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
