import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

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

      if (!res.ok) throw new Error('LOAD_FAILED');
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
        body: JSON.stringify({ content })
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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="감사일기" backTo="/" hideAuthActions />

        <Card className="glassHeroCard">
          <div style={heroHeadStyle}>
            <div>
              <div style={eyebrowStyle}>GRATITUDE JOURNAL</div>
              <CardTitle>이번 달 감사 기록</CardTitle>
              <CardDesc>날짜를 눌러 한 줄 감사일기를 바로 작성하거나 수정해 보세요.</CardDesc>
            </div>

            <div style={heroCountBadgeStyle}>{loading ? '…' : `${items.length}개 기록`}</div>
          </div>

          <div className="stack12" />

          <div style={heroPillRowStyle}>
            <span style={heroMintPillStyle}>{loading ? '기록 불러오는 중…' : `이번 달 ${items.length}개 기록`}</span>
            <span style={heroPeachPillStyle}>오늘 날짜 {todayDate}</span>
          </div>

          <div className="stack12" />

          <div style={heroToolbarStyle}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="glassInput glassInputMonth"
            />

            <div style={heroActionGridStyle}>
              <Button variant="ghost" onClick={() => setMonth(ym(kstNow()))}>
                이번달
              </Button>
              <Button variant="secondary" onClick={() => openEditor(todayDate)}>
                오늘 기록하기
              </Button>
            </div>
          </div>
        </Card>

        <div className="stack12" />

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <Card>
          <div style={cardHeadStyle}>
            <div>
              <CardTitle>달력</CardTitle>
              <CardDesc>색이 있는 날짜는 기록이 저장된 날입니다.</CardDesc>
            </div>
            <div style={miniPillStyle}>{month}</div>
          </div>

          <div className="stack12" />

          <div className="miniWeekHeader">
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

        <div className="stack12" />

        <Card>
          <div style={cardHeadStyle}>
            <div>
              <CardTitle>이번 달 기록</CardTitle>
              <CardDesc>{loading ? '불러오는 중…' : `${items.length}개의 감사가 저장되어 있어요.`}</CardDesc>
            </div>
          </div>

          <div className="stack12" />

          {loading ? (
            <div className="glassEmpty">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="glassEmpty">이번 달 기록이 없습니다. 오늘의 감사를 남겨보세요.</div>
          ) : (
            <div className="glassList">
              {items.slice(0, 31).map((item) => (
                <button key={item.id} type="button" className="glassListItem" onClick={() => openEditor(item.date)}>
                  <div style={listTopStyle}>
                    <div className="glassListDate">{item.date}</div>
                    <div style={listChipStyle}>{item.date === todayDate ? '오늘' : '기록'}</div>
                  </div>
                  <div className="glassListContent">{item.content}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)}>
          <div style={sheetEyebrowStyle}>WRITE GRATITUDE</div>
          <div className="sheetTitle">감사일기 · {editorDate}</div>
          <div style={sheetDescStyle}>짧게 적어도 괜찮아요. 오늘 감사한 일을 자연스럽게 남겨보세요.</div>
          <div className="stack10" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예) 오늘도 건강을 지켜주셔서 감사합니다"
            className="glassTextarea"
          />
          <div style={sheetFooterStyle}>
            <div style={countStyle}>{content.length}자</div>
            <Button variant="primary" size="lg" disabled={saving} onClick={saveEntry}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </BottomSheet>
      </div>
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

const eyebrowStyle: CSSProperties = {
  marginBottom: 8,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const heroHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const heroCountBadgeStyle: CSSProperties = {
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

const heroToolbarStyle: CSSProperties = {
  display: 'grid',
  gap: 10
};

const heroPillRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const heroMintPillStyle: CSSProperties = {
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

const heroPeachPillStyle: CSSProperties = {
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

const heroActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const cardHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const miniPillStyle: CSSProperties = {
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

const listTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const listChipStyle: CSSProperties = {
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

const sheetEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const sheetDescStyle: CSSProperties = {
  marginTop: 8,
  color: '#6e7b84',
  fontSize: 13,
  lineHeight: 1.55
};

const sheetFooterStyle: CSSProperties = {
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
