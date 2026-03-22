import { useEffect, useMemo, useState } from 'react';
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
  const [gratEditorLoading, setGratEditorLoading] = useState(false);
  const [gratEditorErr, setGratEditorErr] = useState<string | null>(null);

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

  async function readErrorMessage(res: Response) {
    const contentType = res.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const j = await res.json();
        return j?.message || j?.error || `HTTP ${res.status}`;
      }

      const text = await res.text();
      if (text) return text.slice(0, 200);
      return `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
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

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        throw new Error(msg || '감사일기를 불러오지 못했습니다.');
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('감사일기 응답 형식이 올바르지 않습니다.');
      }

      const rows = await res.json();
      setGratItems(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setGratErr(e?.message ?? '감사일기를 불러오지 못했습니다.');
      setGratItems([]);
    }
  }

  async function openGratitudeEditor(date: string) {
    setGratEditorDate(date);
    setGratEditorErr(null);
    setGratEditorOpen(true);
    setGratEditorLoading(true);
    setGratContent('');

    try {
      const res = await apiFetch(`/api/gratitude/${date}`);

      if (res.status === 401) {
        setGratEditorOpen(false);
        goLogin('/me?section=gratitude');
        return;
      }

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        throw new Error(msg || '감사일기를 불러오지 못했습니다.');
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('감사일기 상세 응답 형식이 올바르지 않습니다.');
      }

      const j = await res.json();
      setGratContent(j?.content ?? '');
    } catch (e: any) {
      setGratEditorErr(e?.message ?? '감사일기를 불러오지 못했습니다.');
      setGratContent(gratMap.get(date)?.content ?? '');
    } finally {
      setGratEditorLoading(false);
    }
  }

  async function saveGratitude() {
    if (!gratEditorDate) return false;

    const content = gratContent.trim();
    setGratEditorErr(null);

    if (!content) {
      setGratEditorErr('내용을 입력하세요.');
      return false;
    }

    setGratSaving(true);

    try {
      const res = await apiFetch(`/api/gratitude/${gratEditorDate}`, {
        method: 'PUT',
        body: JSON.stringify({ content })
      });

      if (res.status === 401) {
        goLogin('/me?section=gratitude');
        return false;
      }

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setGratEditorErr(msg || '저장에 실패했습니다.');
        return false;
      }

      await loadGratitude();
      setGratEditorOpen(false);
      setGratContent('');
      setGratEditorDate('');
      return true;
    } catch (e: any) {
      setGratEditorErr(e?.message ?? '저장에 실패했습니다.');
      return false;
    } finally {
      setGratSaving(false);
    }
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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="내정보" backTo="/" />

        <Card className="glassHeroCard">
          <div className="profileHero">
            <div>
              <CardTitle>{me.name}</CardTitle>
              <CardDesc>@{me.username}</CardDesc>
            </div>

            <div className="profileRoleChip">{me.isAdmin ? 'ADMIN' : '일반 사용자'}</div>
          </div>

          <div className="profileMetaGrid">
            <MetaBox label="휴대폰" value={me.phone ?? '-'} />
            <MetaBox label="출석교회" value={me.homeChurch ?? '-'} />
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>신앙 생활 요약</CardTitle>
          <CardDesc>DLP 제출 기준 누적 출석과 이번 주 현황입니다.</CardDesc>

          <div className="stack12" />

          <div className="glassStatGrid">
            <StatCard label="누적 출석일" value={String(stats?.attendanceDays ?? '-')} />
            <StatCard label="이번 주 제출" value={stats ? `${stats.week.submittedCount}/7` : '-'} />
          </div>

          <div className="stack12" />

          <div className="sectionMiniTitle">
            이번 주 제출 현황 ({stats?.week.start ?? '—'} ~ {stats?.week.end ?? '—'})
          </div>

          <div className="stack8" />

          <div className="weekDots">
            {(stats?.week.days ?? Array.from({ length: 7 }).map((_, i) => ({ date: String(i), hasDlp: false }))).map((d, idx) => (
              <div
                key={idx}
                title={String(d.date)}
                className={['weekDot', d.hasDlp ? 'weekDotOn' : ''].filter(Boolean).join(' ')}
              />
            ))}
          </div>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>UI 설정</CardTitle>
          <CardDesc>테마와 글자 크기를 내 사용 습관에 맞게 조정하세요.</CardDesc>

          <div className="stack12" />

          <Field label="테마">
            <select
              value={ui.theme}
              onChange={(e) => ui.setTheme(e.target.value as any)}
              className="glassInput"
            >
              <option value="system">시스템</option>
              <option value="light">라이트</option>
              <option value="dark">다크</option>
            </select>
          </Field>

          <div className="stack12" />

          <Field label="폰트 크기">
            <div className="fontScaleRow">
              <input
                type="range"
                min={0.9}
                max={1.25}
                step={0.05}
                value={ui.scale}
                onChange={(e) => ui.setScale(Number(e.target.value))}
                className="glassRange"
              />
              <div className="fontScaleValue">{Math.round(ui.scale * 100)}%</div>
            </div>
          </Field>
        </Card>

        <div className="stack12" />

        <Card id="gratitude">
          <div className="sectionHeadRow">
            <div>
              <CardTitle>감사일기</CardTitle>
              <CardDesc>달력에서 날짜를 탭하면 작성 또는 수정할 수 있어요.</CardDesc>
            </div>

            <Button
              variant="secondary"
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
            </Button>
          </div>

          {gratExpanded ? (
            <>
              <div className="stack12" />

              <div className="toolbarRow">
                <input
                  type="month"
                  value={gratMonth}
                  onChange={(e) => setGratMonth(e.target.value)}
                  className="glassInput glassInputMonth"
                />
                <Button variant="ghost" onClick={() => setGratMonth(ym(kstNow()))}>
                  이번달
                </Button>
              </div>

              <div className="stack10" />
              {gratErr ? <div className="uiErrorBox">{gratErr}</div> : null}

              <div className="sectionMiniTitle">달력</div>
              <div className="stack8" />

              <div className="miniWeekHeader">
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="gratitudeCalendarGrid">
                {Array.from({ length: gratFirstDow }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}

                {Array.from({ length: gratDaysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = ymdFromParts(gratYear, gratMon, day);
                  const has = gratMap.has(date);

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => void openGratitudeEditor(date)}
                      className={['gratitudeDayCell', has ? 'gratitudeDayCellOn' : ''].join(' ')}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="stack12" />

              <div className="sectionHeadRow">
                <div className="sectionMiniTitle">이번 달 기록</div>
                <div className="sectionMiniMeta">{gratItems.length}개</div>
              </div>

              <div className="stack10" />

              {gratItems.length === 0 ? (
                <div className="glassEmpty">이번 달 기록이 없습니다.</div>
              ) : (
                <div className="glassList">
                  {gratItems.slice(0, 12).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className="glassListItem"
                      onClick={() => void openGratitudeEditor(it.date)}
                    >
                      <div className="glassListDate">{it.date}</div>
                      <div className="glassListContent">{it.content}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </Card>

        <BottomSheet open={gratEditorOpen} onClose={() => setGratEditorOpen(false)}>
          <div className="sheetTitle">감사일기 · {gratEditorDate}</div>
          <div className="stack10" />

          {gratEditorErr ? <div className="uiErrorBox">{gratEditorErr}</div> : null}
          {gratEditorLoading ? <div className="sectionMiniMeta">불러오는 중…</div> : null}

          <textarea
            value={gratContent}
            onChange={(e) => setGratContent(e.target.value)}
            placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
            className="glassTextarea"
            disabled={gratEditorLoading || gratSaving}
          />

          <div className="stack10" />

          <Button
            variant="primary"
            wide
            size="lg"
            disabled={gratEditorLoading || gratSaving}
            onClick={saveGratitude}
          >
            {gratSaving ? '저장 중…' : '저장'}
          </Button>
        </BottomSheet>

        <div className="stack12" />

        <Card>
          <CardTitle>내정보 수정</CardTitle>
          <CardDesc>연락처와 출석교회를 최신 상태로 유지해 주세요.</CardDesc>

          <div className="stack12" />

          <Field label="이름(실명)">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="휴대폰">
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="glassInput"
              inputMode="tel"
            />
          </Field>

          <div className="stack10" />

          <Field label="출석교회">
            <input value={editChurch} onChange={(e) => setEditChurch(e.target.value)} className="glassInput" />
          </Field>

          <div className="stack12" />

          <Button
            variant="primary"
            wide
            size="lg"
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
          </Button>
        </Card>

        <div className="stack12" />

        <Card>
          <CardTitle>비밀번호 변경</CardTitle>
          <CardDesc>변경 후 기존 로그인 세션은 모두 만료됩니다.</CardDesc>

          <div className="stack12" />

          <Field label="현재 비밀번호">
            <input value={curPw} onChange={(e) => setCurPw(e.target.value)} type="password" className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="새 비밀번호(8자 이상)">
            <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="새 비밀번호 확인">
            <input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} type="password" className="glassInput" />
          </Field>

          <div className="stack12" />

          <Button
            variant="primary"
            wide
            size="lg"
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

                if (!res.ok) throw new Error('PW_CHANGE_FAILED');

                alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
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
          </Button>
        </Card>

        <div className="stack12" />

        <Button
          variant="ghost"
          wide
          size="lg"
          onClick={() => {
            logout();
            nav('/');
          }}
        >
          로그아웃
        </Button>
      </div>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="uiSheetBackdrop" onClick={onClose}>
      <div className="uiSheet" onClick={(e) => e.stopPropagation()}>
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>
        {children}
        <div className="stack10" />
        <Button variant="secondary" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="glassField">
      <div className="glassFieldLabel">{label}</div>
      {children}
    </label>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="glassMetaBox">
      <div className="glassMetaLabel">{label}</div>
      <div className="glassMetaValue">{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glassStatCard">
      <div className="glassStatLabel">{label}</div>
      <div className="glassStatValue">{value}</div>
    </div>
  );
}
