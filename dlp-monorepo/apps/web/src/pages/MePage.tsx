import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useUiPrefs } from '../ui/UiPrefsContext';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type MeStats = {
  attendanceDays: number;
  week: {
    start: string;
    end: string;
    submittedCount: number;
    days: { date: string; hasDlp: boolean }[];
  };
};

type GratitudeEntry = {
  id: string;
  date: string;
  content: string;
  createdAt: number;
};

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ym(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ymdFromParts(y: number, m: number, day: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const j = await res.clone().json();
    if (typeof j?.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j?.error === 'string' && j.error.trim()) return j.error.trim();
  } catch {
    // ignore
  }

  try {
    const t = await res.text();
    if (t.trim()) return t.trim();
  } catch {
    // ignore
  }

  return fallback;
}

export default function MePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me, logout, refreshMe } = useAuth();
  const ui = useUiPrefs();

  const [stats, setStats] = useState<MeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsErr, setStatsErr] = useState<string | null>(null);

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
  const [gratLoading, setGratLoading] = useState(false);

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
    setStatsLoading(true);
    setStatsErr(null);

    try {
      const res = await apiFetch('/api/me/stats');

      if (res.status === 401) {
        goLogin('/me');
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '내 통계를 불러오지 못했습니다.'));
      }

      setStats((await res.json()) as MeStats);
    } catch (e: any) {
      setStatsErr(String(e?.message ?? '내 통계를 불러오지 못했습니다.'));
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadGratitude() {
    setGratLoading(true);
    setGratErr(null);

    try {
      const res = await apiFetch(`/api/gratitude?month=${encodeURIComponent(gratMonth)}`);

      if (res.status === 401) {
        goLogin('/me?section=gratitude');
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '감사일기를 불러오지 못했습니다.'));
      }

      setGratItems((await res.json()) as GratitudeEntry[]);
    } catch (e: any) {
      setGratErr(String(e?.message ?? '감사일기를 불러오지 못했습니다.'));
    } finally {
      setGratLoading(false);
    }
  }

  function openGratitudeEditor(date: string) {
    setGratEditorDate(date);
    setGratContent(gratMap.get(date)?.content ?? '');
    setGratEditorOpen(true);
  }

  function syncSectionQuery(nextOpen: boolean) {
    const qs = new URLSearchParams(loc.search);

    if (nextOpen) {
      qs.set('section', 'gratitude');
    } else if (qs.get('section') === 'gratitude') {
      qs.delete('section');
    }

    const search = qs.toString();
    nav(`/me${search ? `?${search}` : ''}`, { replace: true });
  }

  useEffect(() => {
    if (section === 'gratitude') {
      setGratExpanded(true);
    }
  }, [section]);

  useEffect(() => {
    if (!me) return;
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    setEditName(me?.name ?? '');
    setEditPhone(me?.phone ?? '');
    setEditChurch(me?.homeChurch ?? '');
  }, [me?.id, me?.name, me?.phone, me?.homeChurch]);

  useEffect(() => {
    if (!me) return;
    if (!gratExpanded && section !== 'gratitude') return;
    void loadGratitude();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, gratMonth, gratExpanded, section]);

  if (!me) return null;

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="내정보" backTo="/" />

        <Card pad style={heroCard}>
          <div style={badgeMint}>MY PAGE</div>

          <div style={heroTop}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <CardTitle style={heroTitle}>{me.name}</CardTitle>
              <CardDesc style={heroDesc}>@{me.username}</CardDesc>
            </div>

            <div style={roleChip}>{me.isAdmin ? 'ADMIN' : '일반 사용자'}</div>
          </div>

          <div style={metaGrid}>
            <MetaBox label="휴대폰" value={me.phone ?? '-'} />
            <MetaBox label="출석교회" value={me.homeChurch ?? '-'} />
          </div>
        </Card>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <CardTitle style={sectionCardTitle}>신앙 생활 요약</CardTitle>
            <CardDesc style={sectionCardDesc}>
              DLP 제출 기준 누적 출석과 이번 주 현황입니다.
            </CardDesc>

            {statsErr ? <ErrorBox text={statsErr} onRetry={loadStats} /> : null}

            {statsLoading ? (
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            ) : (
              <>
                <div style={statGrid}>
                  <StatChip label="누적 출석일" value={String(stats?.attendanceDays ?? '-')} tint="mint" />
                  <StatChip
                    label="이번 주 제출"
                    value={stats ? `${stats.week.submittedCount}/7` : '-'}
                    tint="peach"
                  />
                </div>

                <div style={miniSectionTitle}>
                  이번 주 제출 현황 ({stats?.week.start ?? '—'} ~ {stats?.week.end ?? '—'})
                </div>

                <div style={weekRow}>
                  {(stats?.week.days ??
                    Array.from({ length: 7 }).map((_, i) => ({
                      date: String(i),
                      hasDlp: false
                    }))).map((d, idx) => (
                    <div key={idx} style={weekCol}>
                      <div style={weekDateLabel}>{String(d.date).slice(5)}</div>
                      <div style={d.hasDlp ? weekDotOn : weekDotOff} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <CardTitle style={sectionCardTitle}>UI 설정</CardTitle>
            <CardDesc style={sectionCardDesc}>
              테마와 글자 크기를 내 사용 습관에 맞게 조정하세요.
            </CardDesc>

            <div style={fieldGrid}>
              <Field label="테마">
                <select
                  value={ui.theme}
                  onChange={(e) => ui.setTheme(e.target.value as 'system' | 'light' | 'dark')}
                  style={input}
                >
                  <option value="system">시스템</option>
                  <option value="light">라이트</option>
                  <option value="dark">다크</option>
                </select>
              </Field>

              <Field label="폰트 크기">
                <div style={rangeWrap}>
                  <input
                    type="range"
                    min={0.9}
                    max={1.25}
                    step={0.05}
                    value={ui.scale}
                    onChange={(e) => ui.setScale(Number(e.target.value))}
                    style={rangeInput}
                  />
                  <div style={scaleChip}>{Math.round(ui.scale * 100)}%</div>
                </div>
              </Field>
            </div>
          </Card>
        </section>

        <section style={sectionWrap}>
          <Card pad style={sectionCard} id="gratitude">
            <div style={sectionHeadRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <CardTitle style={sectionCardTitle}>감사일기</CardTitle>
                <CardDesc style={sectionCardDesc}>
                  달력에서 날짜를 눌러 바로 작성하거나 수정할 수 있어요.
                </CardDesc>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  const next = !gratExpanded;
                  setGratExpanded(next);
                  syncSectionQuery(next);
                }}
              >
                {gratExpanded ? '접기' : '열기'}
              </Button>
            </div>

            {gratExpanded ? (
              <>
                <div style={toolbarRow}>
                  <input
                    type="month"
                    value={gratMonth}
                    onChange={(e) => setGratMonth(e.target.value)}
                    style={input}
                  />
                  <Button type="button" variant="ghost" size="md" onClick={() => setGratMonth(ym(kstNow()))}>
                    이번달
                  </Button>
                </div>

                {gratErr ? <ErrorBox text={gratErr} onRetry={loadGratitude} /> : null}

                <div style={miniSectionTitle}>달력</div>

                <div style={weekHeader}>
                  {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                    <div key={d} style={weekHeaderCell}>
                      {d}
                    </div>
                  ))}
                </div>

                <div style={calendarGrid}>
                  {Array.from({ length: gratFirstDow }).map((_, i) => (
                    <div key={`blank-${i}`} />
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
                        style={has ? dayCellOn : dayCell}
                        aria-label={`${date} 감사일기 ${has ? '작성됨' : '미작성'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div style={sectionHeadRow}>
                  <div style={miniSectionTitle}>이번 달 기록</div>
                  <div style={sectionMeta}>{gratItems.length}개</div>
                </div>

                {gratLoading ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <SkeletonBlock />
                    <SkeletonBlock />
                  </div>
                ) : gratItems.length === 0 ? (
                  <div style={emptyNote}>이번 달 기록이 없습니다.</div>
                ) : (
                  <div style={list}>
                    {gratItems.slice(0, 12).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        style={listItem}
                        onClick={() => openGratitudeEditor(it.date)}
                      >
                        <div style={listDate}>{it.date}</div>
                        <div style={listContent}>{it.content}</div>
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    wide
                    onClick={() => nav(`/gratitude?month=${encodeURIComponent(gratMonth)}`)}
                  >
                    감사일기 전체 페이지 열기
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </section>

        <BottomSheet open={gratEditorOpen} onClose={() => setGratEditorOpen(false)}>
          <div style={sheetHeader}>
            <div style={sheetEyebrow}>GRATITUDE</div>
            <div style={sheetTitle}>감사일기 · {gratEditorDate}</div>
          </div>

          <div style={sheetBody}>
            <textarea
              value={gratContent}
              onChange={(e) => setGratContent(e.target.value)}
              placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
              style={textarea}
            />

            <Button
              type="button"
              variant="primary"
              size="lg"
              wide
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

                  if (!res.ok) {
                    throw new Error(await readErrorMessage(res, '감사일기 저장에 실패했습니다.'));
                  }

                  await loadGratitude();
                  setGratEditorOpen(false);
                } catch (e: any) {
                  alert(String(e?.message ?? '감사일기 저장에 실패했습니다.'));
                } finally {
                  setGratSaving(false);
                }
              }}
            >
              {gratSaving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </BottomSheet>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <CardTitle style={sectionCardTitle}>내정보 수정</CardTitle>
            <CardDesc style={sectionCardDesc}>
              연락처와 출석교회를 최신 상태로 유지해 주세요.
            </CardDesc>

            <div style={fieldGrid}>
              <Field label="이름(실명)">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
              </Field>

              <Field label="휴대폰">
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={input}
                  inputMode="tel"
                />
              </Field>

              <Field label="출석교회">
                <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} style={input} />
              </Field>
            </div>

            <div style={actionGrid}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                wide
                disabled={savingProfile}
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

                    if (!res.ok) {
                      throw new Error(await readErrorMessage(res, '내정보 저장에 실패했습니다.'));
                    }

                    await refreshMe();
                    alert('내정보가 저장되었습니다.');
                  } catch (e: any) {
                    alert(String(e?.message ?? '내정보 저장에 실패했습니다.'));
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                {savingProfile ? '저장 중…' : '내정보 저장'}
              </Button>
            </div>
          </Card>
        </section>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <CardTitle style={sectionCardTitle}>비밀번호 변경</CardTitle>
            <CardDesc style={sectionCardDesc}>
              변경 후 기존 로그인 세션은 모두 만료됩니다.
            </CardDesc>

            <div style={fieldGrid}>
              <Field label="현재 비밀번호">
                <input value={curPw} onChange={(e) => setCurPw(e.target.value)} type="password" style={input} />
              </Field>

              <Field label="새 비밀번호(8자 이상)">
                <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" style={input} />
              </Field>

              <Field label="새 비밀번호 확인">
                <input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} type="password" style={input} />
              </Field>
            </div>

            <div style={actionGrid}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                wide
                disabled={savingPw}
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

                    if (!res.ok) {
                      throw new Error(await readErrorMessage(res, '비밀번호 변경에 실패했습니다.'));
                    }

                    alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
                    logout();
                    goLogin('/me');
                  } catch (e: any) {
                    alert(String(e?.message ?? '비밀번호 변경에 실패했습니다.'));
                  } finally {
                    setSavingPw(false);
                    setCurPw('');
                    setNewPw('');
                    setNewPw2('');
                  }
                }}
              >
                {savingPw ? '변경 중…' : '비밀번호 변경'}
              </Button>
            </div>
          </Card>
        </section>

        <div style={actionGrid}>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            wide
            onClick={() => {
              logout();
              nav('/');
            }}
          >
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
}

function BottomSheet({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" style={sheetBackdrop} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={sheetHandleWrap}>
          <div style={sheetHandle} />
        </div>
        {children}
        <div style={{ marginTop: 12 }}>
          <Button type="button" variant="secondary" size="lg" wide onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaBox}>
      <div style={metaLabel}>{label}</div>
      <div style={metaValue}>{value}</div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tint
}: {
  label: string;
  value: string;
  tint: 'mint' | 'peach';
}) {
  return (
    <div
      style={{
        ...statChip,
        background: tint === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)',
        borderColor: tint === 'mint' ? 'rgba(114,215,199,0.22)' : 'rgba(243,180,156,0.24)'
      }}
    >
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div style={errorBox}>
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{text}</div>
      <div style={{ marginTop: 10 }}>
        <Button type="button" variant="secondary" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={skeletonCard}>
      <div style={skeletonLineLg} />
      <div style={skeletonLineMd} />
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100dvh',
  padding: '12px 14px 30px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  margin: '0 auto'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const heroTitle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 6,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const roleChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9a614f',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const metaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const metaBox: CSSProperties = {
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.9)'
};

const metaLabel: CSSProperties = {
  color: '#6d7a83',
  fontSize: 11,
  fontWeight: 800
};

const metaValue: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45,
  wordBreak: 'break-word'
};

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionCardTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sectionCardDesc: CSSProperties = {
  marginTop: 4,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const statChip: CSSProperties = {
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 18,
  border: '1px solid transparent'
};

const statLabel: CSSProperties = {
  fontSize: 11,
  color: '#68757e',
  fontWeight: 800
};

const statValue: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  lineHeight: 1,
  color: '#24313a',
  fontWeight: 800
};

const miniSectionTitle: CSSProperties = {
  marginTop: 14,
  color: '#24313a',
  fontSize: 14,
  fontWeight: 800
};

const weekRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
  marginTop: 10
};

const weekCol: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 6
};

const weekDateLabel: CSSProperties = {
  fontSize: 11,
  color: '#7a8790',
  fontWeight: 700
};

const weekDotOn: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: '#58c9b8',
  boxShadow: '0 0 0 4px rgba(114,215,199,0.15)'
};

const weekDotOff: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: 'rgba(210,218,224,0.9)'
};

const fieldGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14
};

const field: CSSProperties = {
  display: 'grid',
  gap: 8
};

const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#3d4a52'
};

const input: CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '0 16px',
  fontSize: 15,
  color: '#24313a',
  outline: 'none',
  boxSizing: 'border-box'
};

const rangeWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 10
};

const rangeInput: CSSProperties = {
  width: '100%'
};

const scaleChip: CSSProperties = {
  minWidth: 58,
  height: 36,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#5f6d75',
  fontSize: 13,
  fontWeight: 800
};

const sectionHeadRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const toolbarRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  marginTop: 14
};

const weekHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  marginTop: 10
};

const weekHeaderCell: CSSProperties = {
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 800,
  color: '#7a8790'
};

const calendarGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  marginTop: 8
};

const dayCell: CSSProperties = {
  height: 42,
  borderRadius: 14,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(248,250,252,0.9)',
  color: '#43525a',
  fontWeight: 800,
  cursor: 'pointer'
};

const dayCellOn: CSSProperties = {
  height: 42,
  borderRadius: 14,
  border: '1px solid rgba(114,215,199,0.22)',
  background: 'rgba(114,215,199,0.14)',
  color: '#226f64',
  fontWeight: 900,
  cursor: 'pointer'
};

const sectionMeta: CSSProperties = {
  marginTop: 14,
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 700
};

const emptyNote: CSSProperties = {
  marginTop: 10,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.55
};

const list: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 10
};

const listItem: CSSProperties = {
  textAlign: 'left',
  padding: '14px 15px',
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)',
  cursor: 'pointer'
};

const listDate: CSSProperties = {
  color: '#2f7f73',
  fontSize: 13,
  fontWeight: 800
};

const listContent: CSSProperties = {
  marginTop: 6,
  color: '#33424b',
  fontSize: 14,
  lineHeight: 1.6
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,24,29,0.34)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 50,
  padding: '0 12px 12px'
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: '24px 24px 0 0',
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 -8px 30px rgba(31,41,55,0.18)',
  backdropFilter: 'blur(18px)',
  padding: '10px 16px 18px'
};

const sheetHandleWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '4px 0 8px'
};

const sheetHandle: CSSProperties = {
  width: 54,
  height: 6,
  borderRadius: 999,
  background: 'rgba(184,195,202,0.9)'
};

const sheetHeader: CSSProperties = {
  padding: '4px 4px 10px'
};

const sheetEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sheetTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sheetBody: CSSProperties = {
  display: 'grid',
  gap: 14
};

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 120,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '14px 16px',
  fontSize: 15,
  lineHeight: 1.6,
  color: '#24313a',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box'
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const errorBox: CSSProperties = {
  marginTop: 12,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,243,240,0.96)',
  border: '1px solid rgba(234,178,161,0.44)',
  color: '#8b4f44'
};

const skeletonCard: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.9)'
};

const skeletonLineLg: CSSProperties = {
  height: 16,
  width: '52%',
  borderRadius: 999,
  background: 'rgba(223,230,235,0.95)'
};

const skeletonLineMd: CSSProperties = {
  height: 12,
  width: '78%',
  borderRadius: 999,
  background: 'rgba(232,237,241,0.95)',
  marginTop: 10
};
