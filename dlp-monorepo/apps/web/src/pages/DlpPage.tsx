import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type DlpPayload = {
  date: string;
  bibleChapters: number;
  prayerMinutes: number;
  evangelismCount: number;
  qtApply: string;
};

function kstToday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createEmptyDlp(date: string): DlpPayload {
  return {
    date,
    bibleChapters: 0,
    prayerMinutes: 0,
    evangelismCount: 0,
    qtApply: ''
  };
}

function normalizeNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeDlp(value: unknown, date: string): DlpPayload {
  if (!value || typeof value !== 'object') return createEmptyDlp(date);

  const src = value as Partial<DlpPayload>;

  return {
    date: typeof src.date === 'string' && src.date ? src.date : date,
    bibleChapters: Math.max(0, normalizeNumber(src.bibleChapters, 0)),
    prayerMinutes: Math.max(0, normalizeNumber(src.prayerMinutes, 0)),
    evangelismCount: Math.max(0, normalizeNumber(src.evangelismCount, 0)),
    qtApply: normalizeText(src.qtApply)
  };
}

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const json = await safeReadJson(res);
  if (json && typeof json === 'object') {
    const message =
      typeof (json as { message?: unknown }).message === 'string'
        ? (json as { message: string }).message
        : typeof (json as { error?: unknown }).error === 'string'
          ? (json as { error: string }).error
          : null;

    if (message) return message;
  }

  return fallback;
}

export default function DlpPage() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();

  const [date, setDate] = useState(kstToday());
  const [data, setData] = useState<DlpPayload>(createEmptyDlp(kstToday()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const title = useMemo(() => 'DLP 체크리스트', []);
  const totalScore = data.bibleChapters + data.prayerMinutes + data.evangelismCount;
  const hasQtApply = data.qtApply.trim().length > 0;

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/dlp' }).toString()}`);
  }

  async function load(targetDate = date) {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/dlp/${targetDate}`);

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'DLP를 불러오지 못했습니다.'));
      }

      const json = await safeReadJson(res);
      setData(normalizeDlp(json, targetDate));
    } catch (e) {
      setData(createEmptyDlp(targetDate));
      setErr(e instanceof Error ? e.message : 'DLP를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const payload = {
        bibleChapters: Math.max(0, data.bibleChapters),
        prayerMinutes: Math.max(0, data.prayerMinutes),
        evangelismCount: Math.max(0, data.evangelismCount),
        qtApply: data.qtApply.trim()
      };

      const res = await apiFetch(`/api/dlp/${date}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '저장에 실패했습니다.'));
      }

      await refreshMe();
      setNotice('오늘 DLP가 저장되었습니다.');
      nav('/me');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title={title} backTo="/" />

        <Card className="glassHeroCard">
          <div style={heroHead}>
            <div style={{ minWidth: 0 }}>
              <div style={badgePeach}>
                <CheckCircleIcon />
                오늘의 루틴 기록
              </div>

              <CardTitle>{date.slice(5)} DLP 체크</CardTitle>
              <CardDesc>
                성경 읽기, 기도, 전도, QT 적용을 한 화면에서 차분하게 기록해 보세요.
              </CardDesc>
            </div>

            <div style={heroActions}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="glassInput glassInputDate"
                aria-label="날짜 선택"
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => setDate(kstToday())}
              >
                오늘
              </Button>
            </div>
          </div>

          <div className="stack12" />

          <div style={metaRow}>
            <MetaChip
              icon={<BookIcon />}
              label={`성경 ${data.bibleChapters}장`}
              tone="mint"
            />
            <MetaChip
              icon={<PrayerIcon />}
              label={`기도 ${data.prayerMinutes}분`}
              tone="sky"
            />
            <MetaChip
              icon={<PeopleIcon />}
              label={`전도 ${data.evangelismCount}명`}
              tone="peach"
            />
            <MetaChip
              icon={<SparkleIcon />}
              label={hasQtApply ? 'QT 적용 작성됨' : 'QT 적용 미작성'}
              tone={hasQtApply ? 'mint' : 'neutral'}
            />
          </div>
        </Card>

        <div className="stack12" />

        {err ? <NoticeBox tone="error" text={err} /> : null}
        {notice ? <NoticeBox tone="success" text={notice} /> : null}

        {loading ? (
          <div style={skeletonStack}>
            <SkeletonCard lines={2} />
            <div className="stack12" />
            <SkeletonCard lines={2} />
            <div className="stack12" />
            <SkeletonCard lines={2} />
            <div className="stack12" />
            <SkeletonCard lines={4} tall />
          </div>
        ) : (
          <>
            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>성경 읽기</CardTitle>
                  <CardDesc>오늘 읽은 장 수를 기록해 주세요.</CardDesc>
                </div>
                <div style={sectionBadgeMint}>Bible</div>
              </div>

              <div className="stack12" />

              <NumberRow
                value={data.bibleChapters}
                onChange={(v) => setData((prev) => ({ ...prev, bibleChapters: v }))}
                min={0}
                max={50}
                step={1}
                suffix="장"
              />
            </Card>

            <div className="stack12" />

            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>기도 시간</CardTitle>
                  <CardDesc>오늘 하나님 앞에 머문 시간을 분 단위로 기록합니다.</CardDesc>
                </div>
                <div style={sectionBadgeSky}>Prayer</div>
              </div>

              <div className="stack12" />

              <NumberRow
                value={data.prayerMinutes}
                onChange={(v) => setData((prev) => ({ ...prev, prayerMinutes: v }))}
                min={0}
                max={600}
                step={5}
                suffix="분"
              />
            </Card>

            <div className="stack12" />

            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>전도 / 권유</CardTitle>
                  <CardDesc>오늘 복음을 전했거나 교회로 초대한 인원 수입니다.</CardDesc>
                </div>
                <div style={sectionBadgePeach}>Outreach</div>
              </div>

              <div className="stack12" />

              <NumberRow
                value={data.evangelismCount}
                onChange={(v) =>
                  setData((prev) => ({ ...prev, evangelismCount: v }))
                }
                min={0}
                max={50}
                step={1}
                suffix="명"
              />
            </Card>

            <div className="stack12" />

            <Card>
              <div style={sectionTop}>
                <div>
                  <CardTitle>QT 적용</CardTitle>
                  <CardDesc>
                    오늘 말씀을 삶에 어떻게 적용할지 한 줄 이상 적어보세요.
                  </CardDesc>
                </div>
                <div style={sectionBadgeNeutral}>Apply</div>
              </div>

              <div className="stack12" />

              <div style={actionRow}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => nav('/qt')}
                  left={<BookIcon />}
                >
                  QT 페이지 열기
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setData((prev) => ({ ...prev, qtApply: '' }))}
                >
                  비우기
                </Button>
              </div>

              <div className="stack10" />

              <textarea
                value={data.qtApply}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, qtApply: e.target.value }))
                }
                placeholder="예) 오늘은 먼저 말씀을 붙들고, 서두르기보다 차분히 반응하겠다"
                className="glassTextarea"
                style={textarea}
              />

              <div className="stack10" />

              <div style={helperPanel}>
                <div style={helperTitle}>작성 팁</div>
                <div style={helperDesc}>
                  말씀 요약보다 <strong>오늘 실제로 행동할 한 가지</strong>를 적으면
                  저장 후에도 다시 보기 좋습니다.
                </div>
              </div>
            </Card>

            <div className="stack12" />

            <Card>
              <div style={summaryRow}>
                <div>
                  <CardTitle>오늘 기록 요약</CardTitle>
                  <CardDesc>
                    총 활동 지표 {totalScore}
                    {hasQtApply ? ' · QT 적용 작성 완료' : ' · QT 적용 작성 필요'}
                  </CardDesc>
                </div>
                <div style={summaryPill}>
                  <CheckCircleIcon />
                  저장 준비
                </div>
              </div>

              <div className="stack12" />

              <Button
                type="button"
                variant="primary"
                size="lg"
                wide
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? '저장 중…' : '오늘 DLP 저장'}
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function NumberRow({
  value,
  onChange,
  min,
  max,
  step,
  suffix
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="numberRow">
      <Button
        type="button"
        variant="ghost"
        className="numberStepBtn"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="감소"
      >
        −
      </Button>

      <div className="numberDisplay">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const next = raw === '' ? min : Number(raw);
            onChange(
              Math.max(min, Math.min(max, Number.isFinite(next) ? next : min))
            );
          }}
          className="numberDisplayInput"
          aria-label={suffix ? `숫자 입력 ${suffix}` : '숫자 입력'}
        />
        {suffix ? <span className="numberSuffix">{suffix}</span> : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="numberStepBtn"
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label="증가"
      >
        +
      </Button>
    </div>
  );
}

function MetaChip({
  icon,
  label,
  tone = 'neutral'
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'mint' | 'sky' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint'
      ? metaMint
      : tone === 'sky'
        ? metaSky
        : tone === 'peach'
          ? metaPeach
          : metaNeutral;

  return (
    <div style={{ ...metaChip, ...toneStyle }}>
      <span style={metaIcon}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function NoticeBox({
  tone,
  text
}: {
  tone: 'success' | 'error';
  text: string;
}) {
  return (
    <div
      style={{
        ...noticeBox,
        ...(tone === 'success' ? noticeSuccess : noticeError)
      }}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span style={noticeIconWrap}>
        {tone === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
      </span>
      <span>{text}</span>
    </div>
  );
}

function SkeletonCard({
  lines = 3,
  tall = false
}: {
  lines?: number;
  tall?: boolean;
}) {
  return (
    <div style={{ ...skeletonCard, minHeight: tall ? 188 : 132 }}>
      <div style={skeletonTitle} />
      <div style={skeletonDesc} />
      <div className="stack12" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          style={{
            ...skeletonLine,
            width:
              idx === lines - 1
                ? '62%'
                : idx % 2 === 0
                  ? '100%'
                  : '86%'
          }}
        />
      ))}
    </div>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function PrayerIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4.5 8-12a4 4 0 0 0-7-2.65A4 4 0 0 0 4 10c0 7.5 8 12 8 12Z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3Z" />
      <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.8-5.1" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" style={icon16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

const heroHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap'
};

const heroActions: CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'minmax(0,1fr) auto'
};

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const metaChip: CSSProperties = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '-0.01em'
};

const metaIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const metaMint: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72'
};

const metaSky: CSSProperties = {
  background: 'rgba(144,193,255,0.14)',
  border: '1px solid rgba(144,193,255,0.22)',
  color: '#5276a7'
};

const metaPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const metaNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const noticeBox: CSSProperties = {
  marginBottom: 12,
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 10px 24px rgba(93,108,122,0.08)'
};

const noticeSuccess: CSSProperties = {
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const noticeError: CSSProperties = {
  background: 'rgba(235,125,125,0.10)',
  border: '1px solid rgba(235,125,125,0.22)',
  color: '#a14d4d'
};

const noticeIconWrap: CSSProperties = {
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  marginTop: 1
};

const skeletonStack: CSSProperties = {
  display: 'block'
};

const skeletonCard: CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.62))',
  border: '1px solid rgba(255,255,255,0.54)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)'
};

const skeletonTitle: CSSProperties = {
  width: '36%',
  height: 18,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.78), rgba(255,255,255,0.28))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const skeletonDesc: CSSProperties = {
  width: '72%',
  height: 12,
  marginTop: 10,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.68), rgba(255,255,255,0.22))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const skeletonLine: CSSProperties = {
  height: 14,
  marginTop: 10,
  borderRadius: 999,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.72), rgba(255,255,255,0.24))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.3s ease-in-out infinite'
};

const sectionTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const sectionBadgeBase: CSSProperties = {
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  flex: '0 0 auto'
};

const sectionBadgeMint: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72'
};

const sectionBadgeSky: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(144,193,255,0.14)',
  border: '1px solid rgba(144,193,255,0.24)',
  color: '#5276a7'
};

const sectionBadgePeach: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(235,168,141,0.15)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const sectionBadgeNeutral: CSSProperties = {
  ...sectionBadgeBase,
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const actionRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const textarea: CSSProperties = {
  minHeight: 132,
  resize: 'vertical'
};

const helperPanel: CSSProperties = {
  borderRadius: 16,
  padding: '12px 13px',
  background: 'rgba(255,255,255,0.42)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const helperTitle: CSSProperties = {
  color: '#42515b',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4
};

const helperDesc: CSSProperties = {
  color: '#6f7d87',
  fontSize: 12,
  lineHeight: 1.55
};

const summaryRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const summaryPill: CSSProperties = {
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  marginBottom: 10,
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448',
  fontSize: 12,
  fontWeight: 800
};

const icon16: CSSProperties = {
  width: 16,
  height: 16,
  display: 'block'
};
