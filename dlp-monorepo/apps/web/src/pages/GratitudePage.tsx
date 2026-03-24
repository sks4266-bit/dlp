import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ym(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ymdFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type Entry = {
  id: string;
  date: string;
  content: string;
  createdAt: number;
};

const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

export default function GratitudePage() {
  const nav = useNavigate();
  const loc = useLocation();

  const [month, setMonth] = useState(ym(kstNow()));
  const [items, setItems] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const itemMap = useMemo(() => {
    const nextMap = new Map<string, Entry>();
    items.forEach((item) => nextMap.set(item.date, item));
    return nextMap;
  }, [items]);

  const { year, mon } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, mon: m };
  }, [month]);

  const today = useMemo(() => kstNow(), []);
  const todayDate = ymdFromParts(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());

  const firstDow = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    return firstDay.getUTCDay();
  }, [year, mon]);

  const daysInMonth = useMemo(() => new Date(Date.UTC(year, mon, 0)).getUTCDate(), [year, mon]);

  function goLogin(next = `${loc.pathname}${loc.search}`) {
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/gratitude?month=${encodeURIComponent(month)}`);

      if (res.status === 401) {
        goLogin('/gratitude');
        return;
      }

      if (!res.ok) throw new Error('불러오기에 실패했습니다.');
      setItems(await res.json());
    } catch (error: any) {
      setErr(error?.message ?? '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openEditor(date: string) {
    setEditorDate(date);
    setContent(itemMap.get(date)?.content ?? '');
    setEditorOpen(true);
  }

  async function saveEntry() {
    if (!editorDate) return;
    if (!content.trim()) {
      window.alert('내용을 입력하세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/gratitude/${editorDate}`, {
        method: 'PUT',
        body: JSON.stringify({ content: content.trim() })
      });

      if (res.status === 401) {
        goLogin('/gratitude');
        return;
      }

      if (!res.ok) throw new Error('SAVE_FAILED');

      await load();
      setEditorOpen(false);
    } catch {
      window.alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="감사일기" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>GRATITUDE JOURNAL</div>
              <div style={heroTitle}>한 줄 감사 기록</div>
              <div style={heroDesc}>업로드한 홈 기준 폭·여백·카드 밀도로 다시 맞추고, 달력과 목록도 작고 안정적으로 정리했습니다.</div>
            </div>
            <div style={countBadge}>{loading ? '…' : `${items.length}개`}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}>{loading ? '불러오는 중…' : `${month} · ${items.length}개 기록`}</span>
            <span style={heroPeachPill}>오늘 {todayDate}</span>
          </div>

          <div style={heroToolbar}>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="glassInput glassInputMonth" />
            <div style={heroActions}>
              <Button variant="ghost" size="md" onClick={() => setMonth(ym(kstNow()))}>
                이번달
              </Button>
              <Button variant="secondary" size="md" onClick={() => openEditor(todayDate)}>
                오늘 기록
              </Button>
            </div>
          </div>
        </Card>

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="CALENDAR" title="감사 달력" desc="색이 있는 날짜는 기록이 저장된 날입니다." />

          <div style={miniPill}>{month}</div>

          <div className="miniWeekHeader" style={{ marginTop: 12 }}>
            {weekLabels.map((dayLabel) => (
              <div key={dayLabel}>{dayLabel}</div>
            ))}
          </div>

          <div className="gratitudeCalendarGrid">
            {Array.from({ length: firstDow }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const date = ymdFromParts(year, mon, day);
              const hasEntry = itemMap.has(date);
              const isToday = date === todayDate;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => openEditor(date)}
                  className={['gratitudeDayCell', hasEntry ? 'gratitudeDayCellOn' : ''].join(' ')}
                  style={isToday ? todayCellStyle : undefined}
                  aria-label={`${date} 감사일기 ${hasEntry ? '작성됨' : '미작성'}`}
                >
                  <span>{day}</span>
                  {hasEntry ? <span style={entryDotStyle} /> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="ENTRIES" title="이번 달 기록" desc={loading ? '불러오는 중…' : `${items.length}개의 기록이 저장되어 있어요.`} />

          {loading ? (
            <div className="glassSkeletonStack">
              <div className="glassSkeletonBlock" style={{ height: 98, borderRadius: 18 }} />
              <div className="glassSkeletonBlock" style={{ height: 98, borderRadius: 18 }} />
            </div>
          ) : items.length === 0 ? (
            <div className="glassEmpty">이번 달 기록이 없습니다. 오늘의 감사를 남겨보세요.</div>
          ) : (
            <div className="glassList">
              {items.slice(0, 31).map((item) => (
                <button key={item.id} type="button" className="glassListItem" style={entryListItem} onClick={() => openEditor(item.date)}>
                  <div style={entryTop}>
                    <div className="glassListDate">{item.date}</div>
                    <div style={item.date === todayDate ? entryChipToday : entryChip}>{item.date === todayDate ? '오늘' : '기록'}</div>
                  </div>
                  <div className="glassListContent">{item.content}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)}>
          <div style={sheetEyebrow}>WRITE GRATITUDE</div>
          <div className="sheetTitle">감사일기 · {editorDate}</div>
          <div style={sheetDesc}>홈 시트 톤에 맞춰 작고 차분하게 작성할 수 있도록 정리했습니다.</div>
          <div className="stack10" />
          <div style={editorCard}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="예) 오늘도 지켜주셔서 감사합니다"
              className="glassTextarea"
              style={{ minHeight: 96 }}
            />
          </div>
          <div style={sheetFooter}>
            <div style={countStyle}>{content.length}자</div>
            <Button variant="primary" size="lg" onClick={saveEntry} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div style={sectionHeader}>
      <div style={sectionEyebrow}>{eyebrow}</div>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{desc}</div>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
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

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  marginBottom: 12
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const heroCopy: CSSProperties = {
  minWidth: 0,
  flex: 1
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

const heroTitle: CSSProperties = {
  fontSize: 27,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em',
  lineHeight: 1.18
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const countBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const heroPillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 14
};

const heroMintPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const heroPeachPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const heroToolbar: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const heroActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const sectionCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHeader: CSSProperties = {
  padding: '2px 2px 12px'
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sectionTitle: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const miniPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const todayCellStyle: CSSProperties = {
  boxShadow: '0 0 0 2px rgba(114,215,199,0.22) inset'
};

const entryDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: 'currentColor',
  opacity: 0.72,
  marginTop: 4
};

const entryListItem: CSSProperties = {
  borderRadius: 18,
  background: 'rgba(255,255,255,0.50)',
  border: '1px solid rgba(255,255,255,0.56)'
};

const entryTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const entryChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  color: '#2f7f73',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const entryChipToday: CSSProperties = {
  ...entryChip,
  background: 'rgba(243,180,156,0.16)',
  color: '#9d6550'
};

const sheetEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const sheetDesc: CSSProperties = {
  marginTop: 8,
  color: '#6e7b84',
  fontSize: 13,
  lineHeight: 1.55
};

const editorCard: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.56)'
};

const sheetFooter: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 12
};

const countStyle: CSSProperties = {
  color: '#87939b',
  fontSize: 12,
  fontWeight: 700
};
