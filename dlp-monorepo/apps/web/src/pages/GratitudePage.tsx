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
  const monthLabel = `${year}년 ${mon}월`;

  const firstDow = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    return firstDay.getUTCDay();
  }, [year, mon]);

  const daysInMonth = useMemo(() => new Date(Date.UTC(year, mon, 0)).getUTCDate(), [year, mon]);
  const monthRate = daysInMonth > 0 ? Math.round((items.length / daysInMonth) * 100) : 0;
  const todaySaved = itemMap.has(todayDate);
  const sortedItems = useMemo(() => [...items].sort((a, b) => b.date.localeCompare(a.date)), [items]);

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

  function handleEditorDateChange(nextDate: string) {
    setEditorDate(nextDate);
    setContent(itemMap.get(nextDate)?.content ?? '');
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
              <div style={heroDesc}>텍스트 입력칸, 날짜 선택칸, 감사 달력까지 홈 화면과 같은 유리 질감과 촘촘한 리듬으로 다시 정리했습니다.</div>
            </div>
            <div style={countBadge}>{loading ? '…' : `${items.length}개`}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}>{month} · 기록률 {loading ? '…' : `${monthRate}%`}</span>
            <span style={todaySaved ? heroPeachPill : heroNeutralPill}>{todaySaved ? '오늘 기록 완료' : '오늘 기록 대기'}</span>
          </div>

          <div style={selectorCard}>
            <div style={selectorLabelRow}>
              <div>
                <div style={selectorEyebrow}>WRITE FLOW</div>
                <div style={selectorTitle}>월 선택과 오늘 기록을 한 카드에 정리</div>
              </div>
              <div style={selectorHint}>{todayDate}</div>
            </div>

            <div style={selectorGrid}>
              <label className="glassField" style={selectorFieldWrap}>
                <div className="glassFieldLabel">기록 월</div>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="glassInput glassInputMonth" />
              </label>

              <div style={heroActions}>
                <Button variant="ghost" size="md" onClick={() => setMonth(ym(kstNow()))}>
                  이번달
                </Button>
                <Button variant="secondary" size="md" onClick={() => openEditor(todayDate)}>
                  오늘 기록
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="CALENDAR" title="감사 달력" desc="날짜칸도 홈 카드처럼 둥글고 부드럽게 다듬고, 기록 여부를 한눈에 구분되도록 정리했습니다." />

          <div style={calendarTopRow}>
            <div style={calendarMonthChip}>{monthLabel}</div>
            <div style={calendarLegend}>민트 칸은 기록 완료 · 링 강조는 오늘</div>
          </div>

          <div style={calendarSummaryGrid}>
            <div style={calendarSummaryCard}>
              <div style={calendarSummaryLabel}>이번 달 기록</div>
              <div style={calendarSummaryValue}>{loading ? '…' : `${items.length}일`}</div>
              <div style={calendarSummaryHint}>총 {daysInMonth}일 중</div>
            </div>
            <div style={calendarSummaryCard}>
              <div style={calendarSummaryLabel}>오늘 상태</div>
              <div style={calendarSummaryValue}>{todaySaved ? '완료' : '대기'}</div>
              <div style={calendarSummaryHint}>{todayDate}</div>
            </div>
          </div>

          <div style={calendarShell}>
            <div style={weekHeader}>
              {weekLabels.map((dayLabel) => (
                <div key={dayLabel} style={weekHeaderCell}>
                  {dayLabel}
                </div>
              ))}
            </div>

            <div style={calendarGrid}>
              {Array.from({ length: firstDow }).map((_, index) => (
                <div key={`empty-${index}`} style={calendarBlankCell} aria-hidden="true" />
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
                    style={{
                      ...calendarDayCell,
                      ...(hasEntry ? calendarDayCellOn : null),
                      ...(isToday ? calendarDayCellToday : null)
                    }}
                    aria-label={`${date} 감사일기 ${hasEntry ? '작성됨' : '미작성'}`}
                  >
                    <span style={{ ...calendarDayNumber, ...(hasEntry ? calendarDayNumberOn : null) }}>{day}</span>
                    <span style={calendarDayFoot}>
                      {isToday ? <span style={todayChip}>오늘</span> : <span style={calendarDotGhost} />}
                      {hasEntry ? <span style={entryDotStyle} /> : <span style={calendarDayGhost} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="ENTRIES" title="이번 달 기록" desc={loading ? '불러오는 중…' : `${items.length}개의 기록이 저장되어 있어요.`} />

          {loading ? (
            <div style={skeletonStack}>
              <div style={skeletonBlock} />
              <div style={skeletonBlock} />
            </div>
          ) : sortedItems.length === 0 ? (
            <div style={emptyBox}>이번 달 기록이 없습니다. 오늘의 감사를 남겨보세요.</div>
          ) : (
            <div style={entryList}>
              {sortedItems.slice(0, 31).map((item) => {
                const isToday = item.date === todayDate;
                return (
                  <button key={item.id} type="button" style={entryCard} onClick={() => openEditor(item.date)}>
                    <div style={entryTop}>
                      <div style={entryDate}>{item.date}</div>
                      <div style={isToday ? entryChipToday : entryChip}>{isToday ? '오늘' : '기록'}</div>
                    </div>
                    <div style={entryContent}>{item.content}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)}>
          <div style={sheetEyebrow}>WRITE GRATITUDE</div>
          <div style={sheetTitle}>감사일기 작성</div>
          <div style={sheetDesc}>입력칸과 날짜선택칸도 홈 시트 톤과 같은 질감으로 통일했습니다.</div>

          <div style={editorGrid}>
            <label className="glassField" style={editorFieldCard}>
              <div className="glassFieldLabel">기록 날짜</div>
              <input type="date" value={editorDate} onChange={(e) => handleEditorDateChange(e.target.value)} className="glassInput glassInputDate" />
            </label>

            <label className="glassField" style={editorFieldCard}>
              <div className="glassFieldLabel">감사 내용</div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="예) 오늘도 지켜주셔서 감사합니다"
                className="glassTextarea"
                style={{ minHeight: 132 }}
              />
            </label>
          </div>

          <div style={sheetFooter}>
            <div style={countStyle}>{content.length}자</div>
            <Button variant="primary" size="lg" onClick={saveEntry} disabled={saving || !editorDate}>
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
        <div style={{ marginTop: 14 }}>
          <Button variant="secondary" wide onClick={onClose}>
            닫기
          </Button>
        </div>
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
  fontWeight: 800
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
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2f7f73',
  fontSize: 12,
  fontWeight: 800
};

const heroPeachPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const heroNeutralPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.64)',
  border: '1px solid rgba(221,230,235,0.9)',
  color: '#6d7b84',
  fontSize: 12,
  fontWeight: 800
};

const selectorCard: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(250,252,253,0.76))',
  border: '1px solid rgba(255,255,255,0.62)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)'
};

const selectorLabelRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const selectorEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const selectorTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const selectorHint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.14)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const selectorGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 12
};

const selectorFieldWrap: CSSProperties = {
  margin: 0
};

const heroActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
  color: '#24313a'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.6
};

const calendarTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 12
};

const calendarMonthChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9d6550',
  fontSize: 12,
  fontWeight: 800
};

const calendarLegend: CSSProperties = {
  color: '#6b7780',
  fontSize: 12,
  lineHeight: 1.5
};

const calendarSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginBottom: 12
};

const calendarSummaryCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.48)'
};

const calendarSummaryLabel: CSSProperties = {
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 800
};

const calendarSummaryValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 800
};

const calendarSummaryHint: CSSProperties = {
  marginTop: 8,
  color: '#7a8790',
  fontSize: 12,
  lineHeight: 1.45
};

const calendarShell: CSSProperties = {
  padding: 12,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(247,250,251,0.8))',
  border: '1px solid rgba(255,255,255,0.62)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)'
};

const weekHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 8
};

const weekHeaderCell: CSSProperties = {
  color: '#7b8a92',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center'
};

const calendarGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8
};

const calendarBlankCell: CSSProperties = {
  minHeight: 62,
  borderRadius: 18,
  background: 'rgba(247,250,251,0.42)'
};

const calendarDayCell: CSSProperties = {
  minHeight: 62,
  padding: '8px 6px',
  borderRadius: 18,
  border: '1px solid rgba(225,232,236,0.96)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,250,251,0.76))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(77,90,110,0.05), inset 0 1px 0 rgba(255,255,255,0.58)',
  transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease'
};

const calendarDayCellOn: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(128,221,206,0.96), rgba(96,205,188,0.98))',
  border: '1px solid rgba(105,208,191,0.92)',
  boxShadow: '0 10px 22px rgba(77,90,110,0.08), 0 8px 20px rgba(109,215,196,0.22)'
};

const calendarDayCellToday: CSSProperties = {
  boxShadow: '0 0 0 2px rgba(114,215,199,0.2) inset, 0 10px 22px rgba(77,90,110,0.08)'
};

const calendarDayNumber: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1
};

const calendarDayNumberOn: CSSProperties = {
  color: '#ffffff'
};

const calendarDayFoot: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 18,
  gap: 6
};

const todayChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 18,
  padding: '0 6px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.22)',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '-0.01em'
};

const calendarDotGhost: CSSProperties = {
  width: 10,
  height: 10
};

const entryDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: '#ffffff',
  boxShadow: '0 0 0 3px rgba(255,255,255,0.22)'
};

const calendarDayGhost: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: 'rgba(123,138,146,0.22)'
};

const entryList: CSSProperties = {
  display: 'grid',
  gap: 12
};

const entryCard: CSSProperties = {
  width: '100%',
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,251,252,0.74))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  cursor: 'pointer',
  textAlign: 'left'
};

const entryTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const entryDate: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#24313a'
};

const entryChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  color: '#2f7f73',
  fontSize: 11,
  fontWeight: 800
};

const entryChipToday: CSSProperties = {
  ...entryChip,
  background: 'rgba(243,180,156,0.16)',
  color: '#9d6550'
};

const entryContent: CSSProperties = {
  marginTop: 10,
  color: '#53626b',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
};

const emptyBox: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.55
};

const skeletonStack: CSSProperties = {
  display: 'grid',
  gap: 12
};

const skeletonBlock: CSSProperties = {
  height: 108,
  borderRadius: 22,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.62) 0%, rgba(243,247,249,0.96) 50%, rgba(255,255,255,0.62) 100%)',
  backgroundSize: '200% 100%',
  animation: 'gratitudeSkeleton 1.2s ease-in-out infinite'
};

const sheetEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const sheetTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sheetDesc: CSSProperties = {
  marginTop: 8,
  color: '#6e7b84',
  fontSize: 13,
  lineHeight: 1.55
};

const editorGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14
};

const editorFieldCard: CSSProperties = {
  margin: 0,
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.44)'
};

const sheetFooter: CSSProperties = {
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12
};

const countStyle: CSSProperties = {
  color: '#87939b',
  fontSize: 12,
  fontWeight: 700
};
