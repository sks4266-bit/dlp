import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

function kstToday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DlpPayload = {
  date: string;
  bibleChapters: number;
  prayerMinutes: number;
  evangelismCount: number;
  qtApply: string;
};

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

export default function DlpPage() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();

  const [date, setDate] = useState(kstToday());
  const [data, setData] = useState<DlpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const summary = useMemo(
    () => ({
      bible: data?.bibleChapters ?? 0,
      prayer: data?.prayerMinutes ?? 0,
      evangelism: data?.evangelismCount ?? 0
    }),
    [data]
  );

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
        throw new Error(await readErrorMessage(res, 'DLP 데이터를 불러오지 못했습니다.'));
      }

      const payload = (await res.json()) as DlpPayload;
      setData(payload);
    } catch (e: any) {
      setErr(String(e?.message ?? 'DLP 데이터를 불러오지 못했습니다.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  async function onSave() {
    if (!data) return;

    setSaving(true);
    setErr(null);

    try {
      const res = await apiFetch(`/api/dlp/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          bibleChapters: data.bibleChapters,
          prayerMinutes: data.prayerMinutes,
          evangelismCount: data.evangelismCount,
          qtApply: data.qtApply
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
      setErr(String(e?.message ?? '저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="DLP 체크리스트" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={badgeMint}>TODAY CHECK</div>
          <CardTitle style={heroTitle}>오늘의 DLP 기록</CardTitle>
          <CardDesc style={heroDesc}>

          </CardDesc>

          <div style={fieldGrid}>
            <label style={field}>
              <span style={fieldLabel}>날짜</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={input}
              />
            </label>

            <Button type="button" variant="secondary" size="lg" wide onClick={() => setDate(kstToday())}>
              오늘 날짜로 이동
            </Button>
          </div>

          <div style={statGrid}>
            <StatChip label="성경" value={`${summary.bible}장`} tint="mint" />
            <StatChip label="기도" value={`${summary.prayer}분`} tint="peach" />
            <StatChip label="전도" value={`${summary.evangelism}명`} tint="peach" />
          </div>
        </Card>

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        {loading ? (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !data ? (
          <div style={{ marginTop: 14 }}>
            <ErrorBox text="표시할 DLP 데이터가 없습니다." onRetry={load} />
          </div>
        ) : (
          <>
            <section style={sectionWrap}>
              <Card pad style={sectionCard}>
                <CardTitle style={sectionCardTitle}>성경 읽기</CardTitle>
                <CardDesc style={sectionCardDesc}>오늘 읽은 장 수를 기록해 주세요.</CardDesc>
                <div style={sectionBody}>
                  <NumberRow
                    value={data.bibleChapters}
                    min={0}
                    max={50}
                    step={1}
                    onChange={(v) => setData({ ...data, bibleChapters: v })}
                  />
                </div>
              </Card>
            </section>

            <section style={sectionWrap}>
              <Card pad style={sectionCard}>
                <CardTitle style={sectionCardTitle}>기도 시간</CardTitle>
                <CardDesc style={sectionCardDesc}>분 단위로 간단히 입력하면 됩니다.</CardDesc>
                <div style={sectionBody}>
                  <NumberRow
                    value={data.prayerMinutes}
                    min={0}
                    max={600}
                    step={5}
                    suffix="분"
                    onChange={(v) => setData({ ...data, prayerMinutes: v })}
                  />
                </div>
              </Card>
            </section>

            <section style={sectionWrap}>
              <Card pad style={sectionCard}>
                <CardTitle style={sectionCardTitle}>전도 / 권유</CardTitle>
                <CardDesc style={sectionCardDesc}>오늘 복음을 전했거나 초대한 인원을 기록합니다.</CardDesc>
                <div style={sectionBody}>
                  <NumberRow
                    value={data.evangelismCount}
                    min={0}
                    max={50}
                    step={1}
                    suffix="명"
                    onChange={(v) => setData({ ...data, evangelismCount: v })}
                  />
                </div>
              </Card>
            </section>

            <section style={sectionWrap}>
              <Card pad style={sectionCard}>
                <CardTitle style={sectionCardTitle}>QT 적용</CardTitle>
                <CardDesc style={sectionCardDesc}>오늘 말씀을 어떻게 적용할지 한 줄로 남겨 보세요.</CardDesc>
                <div style={sectionBody}>
                  <textarea
                    value={data.qtApply}
                    onChange={(e) => setData({ ...data, qtApply: e.target.value })}
                    style={textarea}
                    placeholder="예) 오늘은 예배 시간을 먼저 지키고, 감사 한 줄을 꼭 남기겠다."
                  />
                </div>
              </Card>
            </section>

            <div style={actionGrid}>
              <Button type="button" variant="primary" size="lg" wide onClick={onSave} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </Button>
              <Button type="button" variant="secondary" size="lg" wide onClick={load} disabled={loading || saving}>
                다시 불러오기
              </Button>
            </div>
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
    <div style={numberRow}>
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </Button>

      <div style={numberBox}>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value || 0);
            const safe = Number.isFinite(n) ? n : min;
            onChange(Math.max(min, Math.min(max, safe)));
          }}
          style={numberInput}
        />
        {suffix ? <span style={numberSuffix}>{suffix}</span> : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </Button>
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

function SkeletonCard() {
  return (
    <div style={skeletonCard}>
      <div style={skeletonLineLg} />
      <div style={skeletonLineMd} />
      <div style={skeletonLineSm} />
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

const fieldGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 16,
  width: '100%',
  minWidth: 0
};

const field: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0
};

const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#3d4a52'
};

const input: CSSProperties = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  height: 46,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '0 14px',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
  color: '#24313a',
  outline: 'none',
  boxSizing: 'border-box',
  appearance: 'auto'
};

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  marginTop: 14
};

const statChip: CSSProperties = {
  minWidth: 0,
  padding: '12px 12px',
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
  fontSize: 20,
  lineHeight: 1,
  color: '#24313a',
  fontWeight: 800
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

const sectionBody: CSSProperties = {
  marginTop: 14
};

const numberRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 10,
  alignItems: 'center'
};

const numberBox: CSSProperties = {
  height: 52,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '0 14px'
};

const numberInput: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: 0,
  background: 'transparent',
  textAlign: 'center',
  fontSize: 20,
  fontWeight: 800,
  color: '#24313a',
  outline: 'none'
};

const numberSuffix: CSSProperties = {
  color: '#6d7a83',
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: 'nowrap'
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
  borderRadius: 22,
  padding: 16,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const skeletonLineLg: CSSProperties = {
  height: 18,
  width: '56%',
  borderRadius: 999,
  background: 'rgba(223,230,235,0.95)'
};

const skeletonLineMd: CSSProperties = {
  height: 14,
  width: '82%',
  borderRadius: 999,
  background: 'rgba(232,237,241,0.95)',
  marginTop: 12
};

const skeletonLineSm: CSSProperties = {
  height: 12,
  width: '42%',
  borderRadius: 999,
  background: 'rgba(238,242,245,0.95)',
  marginTop: 12
};
