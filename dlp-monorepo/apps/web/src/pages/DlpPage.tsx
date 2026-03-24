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

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => null);
      const msg =
        j?.message ||
        j?.error ||
        (typeof j === 'string' ? j : '');
      return msg || fallback;
    }

    const text = await res.text().catch(() => '');
    return text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export default function DlpPage() {
  const nav = useNavigate();
  const { refreshMe, logout } = useAuth();

  const [date, setDate] = useState(kstToday());
  const [data, setData] = useState<DlpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => 'DLP 체크리스트', []);

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/dlp' }).toString()}`);
  }

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await apiFetch(`/api/dlp/${date}`);

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '불러오기에 실패했습니다.'));
      }

      const payload = (await res.json()) as DlpPayload;

      setData({
        date: payload?.date ?? date,
        bibleChapters: Number(payload?.bibleChapters ?? 0),
        prayerMinutes: Number(payload?.prayerMinutes ?? 0),
        evangelismCount: Number(payload?.evangelismCount ?? 0),
        qtApply: String(payload?.qtApply ?? '')
      });
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function onSave() {
    if (!data) return;

    setSaving(true);
    setErr(null);

    try {
      const res = await apiFetch(`/api/dlp/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          bibleChapters: Number(data.bibleChapters || 0),
          prayerMinutes: Number(data.prayerMinutes || 0),
          evangelismCount: Number(data.evangelismCount || 0),
          qtApply: String(data.qtApply || '')
        })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '저장에 실패했습니다.'));
      }

      await refreshMe();
      alert('저장되었습니다.');
      nav('/me');
    } catch (e: any) {
      setErr(e?.message ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const summary = data
    ? [
        { label: '성경', value: `${data.bibleChapters}장`, tone: 'mint' as const },
        { label: '기도', value: `${data.prayerMinutes}분`, tone: 'sky' as const },
        { label: '전도', value: `${data.evangelismCount}명`, tone: 'peach' as const }
      ]
    : [];

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title={title}
          backTo="/"
          right={
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                nav('/');
              }}
            >
              로그아웃
            </Button>
          }
        />

        <Card style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={heroBadge}>DISCIPLE LIFE</div>
              <div style={heroTitle}>오늘의 영적 루틴을 차분하게 기록해보세요</div>
              <div style={heroDesc}>
                성경 읽기, 기도 시간, 전도, QT 적용을 한 화면에서 정리하는 DLP 체크리스트입니다.
              </div>
            </div>

            <div style={heroDateBox}>
              <div style={miniLabel}>기록 날짜</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={dateInput}
                disabled={loading || saving}
              />
              <Button
                variant="secondary"
                onClick={() => setDate(kstToday())}
                disabled={loading || saving}
              >
                오늘
              </Button>
            </div>
          </div>

          {data ? (
            <div style={summaryGrid}>
              {summary.map((item) => (
                <SummaryChip
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                />
              ))}
            </div>
          ) : null}
        </Card>

        <div style={{ height: 12 }} />

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        {loading ? (
          <SkeletonStack />
        ) : !data ? (
          <Card style={emptyCard}>
            <div style={emptyTitle}>데이터가 없습니다</div>
            <div style={emptyDesc}>선택한 날짜의 DLP 기록을 불러오지 못했습니다.</div>
          </Card>
        ) : (
          <>
            <Card style={sectionCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>READING</div>
                  <CardTitle>성경 읽기</CardTitle>
                  <CardDesc>오늘 읽은 장 수를 기록해 주세요.</CardDesc>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <NumberRow
                value={data.bibleChapters}
                onChange={(v) => setData({ ...data, bibleChapters: v })}
                min={0}
                max={50}
                step={1}
                disabled={saving}
              />
            </Card>

            <div style={{ height: 12 }} />

            <Card style={sectionCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>PRAYER</div>
                  <CardTitle>기도 시간</CardTitle>
                  <CardDesc>오늘 기도한 시간을 분 단위로 기록합니다.</CardDesc>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <NumberRow
                value={data.prayerMinutes}
                onChange={(v) => setData({ ...data, prayerMinutes: v })}
                min={0}
                max={600}
                step={5}
                suffix="분"
                disabled={saving}
              />
            </Card>

            <div style={{ height: 12 }} />

            <Card style={sectionCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>OUTREACH</div>
                  <CardTitle>전도 / 권유</CardTitle>
                  <CardDesc>오늘 복음을 전했거나 교회로 초대한 인원 수입니다.</CardDesc>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <NumberRow
                value={data.evangelismCount}
                onChange={(v) => setData({ ...data, evangelismCount: v })}
                min={0}
                max={50}
                step={1}
                suffix="명"
                disabled={saving}
              />
            </Card>

            <div style={{ height: 12 }} />

            <Card style={sectionCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>APPLICATION</div>
                  <CardTitle>QT 적용</CardTitle>
                  <CardDesc>오늘 말씀을 삶에 어떻게 적용할지 한 줄로 적어보세요.</CardDesc>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <textarea
                value={data.qtApply}
                onChange={(e) => setData({ ...data, qtApply: e.target.value })}
                placeholder="예) 오늘은 안식의 의미를 기억하며 예배 시간을 먼저 지키겠다"
                style={textarea}
                disabled={saving}
              />
            </Card>

            <div style={{ height: 14 }} />

            <div style={actionStack}>
              <Button
                variant="primary"
                wide
                size="lg"
                disabled={saving}
                onClick={onSave}
              >
                {saving ? '저장 중…' : '저장'}
              </Button>

              <Button
                variant="ghost"
                wide
                disabled={saving}
                onClick={() => nav('/me')}
              >
                내 정보로 돌아가기
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: 'mint' | 'sky' | 'peach';
}) {
  const bg =
    tone === 'mint'
      ? 'rgba(114,215,199,0.16)'
      : tone === 'sky'
        ? 'rgba(178,224,245,0.18)'
        : 'rgba(243,180,156,0.16)';

  const border =
    tone === 'mint'
      ? 'rgba(114,215,199,0.28)'
      : tone === 'sky'
        ? 'rgba(178,224,245,0.28)'
        : 'rgba(243,180,156,0.28)';

  return (
    <div
      style={{
        ...summaryChip,
        background: bg,
        borderColor: border
      }}
    >
      <div style={summaryLabel}>{label}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

function NumberRow({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  disabled
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div style={numberRow}>
      <Button
        variant="ghost"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={disabled}
      >
        −
      </Button>

      <div style={numberDisplay}>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value || 0);
            onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
          }}
          style={numberInput}
          disabled={disabled}
        />
        {suffix ? <span style={numberSuffix}>{suffix}</span> : null}
      </div>

      <Button
        variant="ghost"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={disabled}
      >
        +
      </Button>
    </div>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <Card style={errorCard}>
      <div style={errorTitle}>문제가 발생했습니다</div>
      <div style={errorText}>{text}</div>
      <div style={{ height: 10 }} />
      <Button variant="secondary" onClick={onRetry}>
        다시 시도
      </Button>
    </Card>
  );
}

function SkeletonStack() {
  return (
    <div style={skeletonStack}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={skeletonBlock} />
      ))}
    </div>
  );
}

const heroCard: CSSProperties = {
  borderRadius: 28,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.68))',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 20px 42px rgba(77,90,110,0.10)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'stretch',
  justifyContent: 'space-between',
  flexWrap: 'wrap'
};

const heroCopy: CSSProperties = {
  flex: '1 1 220px',
  minWidth: 0
};

const heroBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2b7f72',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  marginTop: 12,
  color: '#24313a',
  fontSize: 28,
  lineHeight: 1.18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 10,
  color: '#66737b',
  fontSize: 14,
  lineHeight: 1.65
};

const heroDateBox: CSSProperties = {
  minWidth: 150,
  display: 'grid',
  gap: 8,
  alignSelf: 'flex-start'
};

const miniLabel: CSSProperties = {
  color: '#7a8790',
  fontSize: 12,
  fontWeight: 800
};

const dateInput: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'rgba(255,255,255,0.68)',
  color: '#33424b',
  outline: 'none'
};

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  marginTop: 16
};

const summaryChip: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 18,
  border: '1px solid transparent'
};

const summaryLabel: CSSProperties = {
  color: '#6d7982',
  fontSize: 11,
  fontWeight: 800
};

const summaryValue: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 800
};

const sectionCard: CSSProperties = {
  borderRadius: 24
};

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start'
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a',
  marginBottom: 6
};

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 132,
  resize: 'vertical',
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.56)',
  background: 'rgba(255,255,255,0.58)',
  color: '#33424b',
  lineHeight: 1.65,
  outline: 'none'
};

const actionStack: CSSProperties = {
  display: 'grid',
  gap: 10
};

const numberRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '68px minmax(0, 1fr) 68px',
  gap: 10,
  alignItems: 'center'
};

const numberDisplay: CSSProperties = {
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'rgba(255,255,255,0.60)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6
};

const numberInput: CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  color: '#24313a',
  fontSize: 26,
  lineHeight: 1,
  fontWeight: 800,
  textAlign: 'center',
  outline: 'none'
};

const numberSuffix: CSSProperties = {
  color: '#718089',
  fontSize: 14,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const skeletonStack: CSSProperties = {
  display: 'grid',
  gap: 12
};

const skeletonBlock: CSSProperties = {
  height: 132,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.56)',
  background:
    'linear-gradient(90deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.82) 50%, rgba(255,255,255,0.48) 100%)',
  backgroundSize: '200% 100%',
  animation: 'glassShimmer 1.5s linear infinite'
};

const errorCard: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(232,162,150,0.38)',
  background: 'rgba(255,244,241,0.82)',
  marginBottom: 12
};

const errorTitle: CSSProperties = {
  color: '#8e4f4f',
  fontSize: 16,
  fontWeight: 800
};

const errorText: CSSProperties = {
  marginTop: 8,
  color: '#7c6666',
  fontSize: 14,
  lineHeight: 1.55
};

const emptyCard: CSSProperties = {
  borderRadius: 24,
  textAlign: 'center'
};

const emptyTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const emptyDesc: CSSProperties = {
  marginTop: 8,
  color: '#69767e',
  fontSize: 14,
  lineHeight: 1.55
};
