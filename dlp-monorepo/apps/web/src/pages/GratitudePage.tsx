import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';
import { apiFetch } from '../lib/api';

type Entry = {
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

export default function GratitudePage() {
  const nav = useNavigate();
  const loc = useLocation();

  const queryMonth = useMemo(() => new URLSearchParams(loc.search).get('month') || '', [loc.search]);

  const [month, setMonth] = useState(queryMonth || ym(kstNow()));
  const [items, setItems] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const map = useMemo(() => {
    const m = new Map<string, Entry>();
    items.forEach((it) => m.set(it.date, it));
    return m;
  }, [items]);

  const { year, mon } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, mon: m };
  }, [month]);

  const firstDow = useMemo(() => {
    const d = new Date(Date.UTC(year, mon - 1, 1));
    return d.getUTCDay();
  }, [year, mon]);

  const daysInMonth = useMemo(() => {
    return new Date(Date.UTC(year, mon, 0)).getUTCDate();
  }, [year, mon]);

  function goLogin(next = `${loc.pathname}${loc.search}`) {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/gratitude?month=${encodeURIComponent(month)}`);

      if (res.status === 401) {
        goLogin(`/gratitude?month=${encodeURIComponent(month)}`);
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '감사일기를 불러오지 못했습니다.'));
      }

      setItems((await res.json()) as Entry[]);
    } catch (e: any) {
      setErr(String(e?.message ?? '감사일기를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    if (!queryMonth) return;
    setMonth(queryMonth);
  }, [queryMonth]);

  function openEditor(date: string) {
    setEditorDate(date);
    setContent(map.get(date)?.content ?? '');
    setEditorOpen(true);
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="감사일기" backTo="/me" />

        <Card pad style={heroCard}>
          <div style={badgePeach}>GRATITUDE</div>
          <CardTitle style={heroTitle}>한 달의 감사를 차분히 기록해 보세요</CardTitle>
          <CardDesc style={heroDesc}>
            홈 화면 기준의 모바일 단일 열 레이아웃으로 달력과 기록 목록을 정리했습니다.
          </CardDesc>

          <div style={toolbarRow}>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={input} />
            <Button type="button" variant="secondary" size="md" onClick={() => setMonth(ym(kstNow()))}>
              이번달
            </Button>
          </div>
        </Card>

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <div style={sectionHeadRow}>
              <div>
                <div style={miniEyebrow}>CALENDAR</div>
                <CardTitle style={sectionCardTitle}>월간 달력</CardTitle>
                <CardDesc style={sectionCardDesc}>
                  날짜를 눌러 감사일기를 작성하거나 수정하세요.
                </CardDesc>
              </div>
            </div>

            <div style={weekHeader}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                <div key={d} style={weekHeaderCell}>
                  {d}
                </div>
              ))}
            </div>

            <div style={calendarGrid}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = ymdFromParts(year, mon, day);
                const has = map.has(date);

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openEditor(date)}
                    style={has ? dayCellOn : dayCell}
                    aria-label={`${date} 감사일기 ${has ? '작성됨' : '미작성'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div style={helperText}>작성된 날짜는 민트 톤으로 표시됩니다.</div>
          </Card>
        </section>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <div style={sectionHeadRow}>
              <div>
                <div style={miniEyebrow}>LIST</div>
                <CardTitle style={sectionCardTitle}>이번 달 기록</CardTitle>
                <CardDesc style={sectionCardDesc}>{items.length}개의 기록이 있습니다.</CardDesc>
              </div>
            </div>

            {loading ? (
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                <SkeletonBlock />
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            ) : items.length === 0 ? (
              <div style={emptyNote}>이번 달 기록이 없습니다.</div>
            ) : (
              <div style={list}>
                {items.slice(0, 31).map((it) => (
                  <button key={it.id} type="button" style={listItem} onClick={() => openEditor(it.date)}>
                    <div style={listDate}>{it.date}</div>
                    <div style={listContent}>{it.content}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </section>

        <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)}>
          <div style={sheetHeader}>
            <div style={sheetEyebrow}>EDIT ENTRY</div>
            <div style={sheetTitle}>감사일기 · {editorDate}</div>
          </div>

          <div style={sheetBody}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
              style={textarea}
            />

            <Button
              type="button"
              variant="primary"
              size="lg"
              wide
              disabled={saving}
              onClick={async () => {
                if (!editorDate) return;
                if (!content.trim()) {
                  alert('내용을 입력하세요.');
                  return;
                }

                setSaving(true);
                try {
                  const res = await apiFetch(`/api/gratitude/${editorDate}`, {
                    method: 'PUT',
                    body: JSON.stringify({ content })
                  });

                  if (res.status === 401) {
                    goLogin(`/gratitude?month=${encodeURIComponent(month)}`);
                    return;
                  }

                  if (!res.ok) {
                    throw new Error(await readErrorMessage(res, '감사일기 저장에 실패했습니다.'));
                  }

                  await load();
                  setEditorOpen(false);
                } catch (e: any) {
                  alert(String(e?.message ?? '감사일기 저장에 실패했습니다.'));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </BottomSheet>
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

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.18)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#a05f48',
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

const toolbarRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  marginTop: 16
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

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHeadRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const miniEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
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

const weekHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  marginTop: 14
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

const helperText: CSSProperties = {
  marginTop: 10,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const list: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
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

const emptyNote: CSSProperties = {
  marginTop: 14,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.55
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
