import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
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

type NoticeState =
  | { tone: 'success' | 'error'; text: string }
  | null;

function createEmptyDlp(date: string): DlpPayload {
  return {
    date,
    bibleChapters: 0,
    prayerMinutes: 0,
    evangelismCount: 0,
    qtApply: ''
  };
}

function normalizeDlp(date: string, data: Partial<DlpPayload> | null | undefined): DlpPayload {
  return {
    date,
    bibleChapters: Number(data?.bibleChapters ?? 0),
    prayerMinutes: Number(data?.prayerMinutes ?? 0),
    evangelismCount: Number(data?.evangelismCount ?? 0),
    qtApply: typeof data?.qtApply === 'string' ? data.qtApply : ''
  };
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const text = await res.text();
    if (!text) return fallback;

    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const candidates = [
        json.message,
        json.error,
        json.msg,
        json.detail
      ];

      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }
    } catch {
      /* noop */
    }

    if (text.trim()) return text.trim();
    return fallback;
  } catch {
    return fallback;
  }
}

export default function QtPage() {
  const nav = useNavigate();

  const [date, setDate] = useState(kstToday());
  const [dlp, setDlp] = useState<DlpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/qt' }).toString()}`);
  }

  async function load() {
    setLoading(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/dlp/${date}`);

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'QT 정보를 불러오지 못했습니다.'));
      }

      const data = await readJsonSafe<Partial<DlpPayload>>(res);
      setDlp(normalizeDlp(date, data));
    } catch (e: any) {
      setDlp(createEmptyDlp(date));
      setErr(e?.message ?? '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const summaryText = useMemo(() => {
    const current = dlp ?? createEmptyDlp(date);
    return `성경 ${current.bibleChapters}장 · 기도 ${current.prayerMinutes}분 · 전도 ${current.evangelismCount}명`;
  }, [date, dlp]);

  async function handleSave() {
    if (!dlp) return;

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/dlp/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          bibleChapters: dlp.bibleChapters,
          prayerMinutes: dlp.prayerMinutes,
          evangelismCount: dlp.evangelismCount,
          qtApply: dlp.qtApply
        })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '저장에 실패했습니다.'));
      }

      setNotice({ tone: 'success', text: 'QT 적용 한 줄이 저장되었습니다.' });
    } catch (e: any) {
      const message = e?.message ?? '저장에 실패했습니다.';
      setNotice({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="매일성경 QT" backTo="/" />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>DAILY QT</div>
              <CardTitle style={heroTitle}>오늘 QT</CardTitle>
              <CardDesc style={heroDesc}>
                QT 본문을 열고, 적용 한 줄을 차분하게 남겨보세요.
                저장한 내용은 DLP의 <b>QT 적용</b>과 동일하게 반영됩니다.
              </CardDesc>
            </div>

            <div style={heroIconWrap} aria-hidden="true">
              <BookHeartIcon />
            </div>
          </div>

          <div style={toolbarWrap}>
            <div style={fieldWrap}>
              <div style={fieldLabel}>날짜 선택</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={dateInput}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setDate(kstToday())}
            >
              오늘
            </Button>
          </div>

          <div style={metaRow}>
            <MetaChip icon={<CalendarMiniIcon />} text={date} />
            <MetaChip icon={<CheckMiniIcon />} text={summaryText} />
          </div>
        </Card>

        {err ? (
          <div style={{ marginTop: 12 }}>
            <NoticeBox tone="error" text={err} />
          </div>
        ) : null}

        {notice ? (
          <div style={{ marginTop: 12 }}>
            <NoticeBox tone={notice.tone} text={notice.text} />
          </div>
        ) : null}

        {loading ? (
          <div style={stack}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={4} />
          </div>
        ) : (
          <>
            <Card pad style={actionCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>READING</div>
                  <div style={sectionTitle}>오늘 QT 읽기</div>
                  <div style={sectionDesc}>
                    매일성경 사이트로 이동해 오늘 본문을 먼저 읽고,
                    아래에 적용 한 줄을 정리해 보세요.
                  </div>
                </div>
              </div>

              <div style={actionButtons}>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  wide
                  onClick={() =>
                    window.open('https://sum.su.or.kr:8888/bible/today', '_blank', 'noopener,noreferrer')
                  }
                >
                  QT 본문 열기
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  wide
                  onClick={() => nav('/dlp')}
                >
                  DLP로 이동
                </Button>
              </div>
            </Card>

            <div style={{ height: 12 }} />

            <Card pad style={editorCard}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionEyebrow}>APPLY</div>
                  <div style={sectionTitle}>QT 적용 한 줄</div>
                  <div style={sectionDesc}>
                    부담 없이 한 줄만 적어도 충분합니다.
                    오늘 말씀을 실제 삶에 어떻게 연결할지 남겨보세요.
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <textarea
                value={dlp?.qtApply ?? ''}
                onChange={(e) =>
                  setDlp((prev) =>
                    normalizeDlp(date, {
                      ...(prev ?? createEmptyDlp(date)),
                      qtApply: e.target.value
                    })
                  )
                }
                placeholder="예) 오늘은 말씀을 미루지 않고, 먼저 기도한 뒤 하루 일정을 시작하겠다."
                style={textarea}
              />

              <div style={{ height: 12 }} />

              <div style={helperPanel}>
                <div style={helperTitle}>저장 안내</div>
                <div style={helperText}>
                  이 내용은 DLP 기록과 연결됩니다. 너무 길게 쓰기보다
                  <b> 오늘 바로 실천할 한 가지</b>를 남기면 가장 안정적으로 관리됩니다.
                </div>
              </div>

              <div style={{ height: 14 }} />

              <Button
                type="button"
                variant="primary"
                size="lg"
                wide
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? '저장 중…' : '저장'}
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function MetaChip({
  icon,
  text
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div style={metaChip}>
      <span style={metaChipIcon}>{icon}</span>
      <span style={metaChipText}>{text}</span>
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
  const success = tone === 'success';

  return (
    <div
      style={{
        ...noticeBox,
        background: success
          ? 'rgba(231, 249, 244, 0.88)'
          : 'rgba(255, 243, 240, 0.9)',
        borderColor: success
          ? 'rgba(114, 215, 199, 0.34)'
          : 'rgba(235, 138, 127, 0.28)',
        color: success ? '#2d7d6e' : '#a55a52'
      }}
    >
      {text}
    </div>
  );
}

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card pad style={skeletonCard}>
      <div style={skeletonBadge} />
      <div style={skeletonTitle} />
      <div style={{ height: 10 }} />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          style={{
            ...skeletonLine,
            width: idx === lines - 1 ? '72%' : '100%'
          }}
        />
      ))}
      <div style={{ height: 14 }} />
      <div style={skeletonButton} />
    </Card>
  );
}

function BookHeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon24}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19.5V6.2A2.2 2.2 0 0 1 7.2 4H18v15.5H7.5A2.5 2.5 0 0 0 5 22v-2.5Z" />
      <path d="M8.3 7.5h5.6" />
      <path d="M12 16.8s-3-1.7-3-3.9a1.9 1.9 0 0 1 3.5-1 1.9 1.9 0 0 1 3.5 1c0 2.2-3 3.9-3 3.9Z" />
    </svg>
  );
}

function CalendarMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M7.5 3.5v3" />
      <path d="M16.5 3.5v3" />
      <path d="M3.5 9h17" />
    </svg>
  );
}

function CheckMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={icon14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4 10-10" />
    </svg>
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

const stack: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 12
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14
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

const heroIconWrap: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  background: 'rgba(114,215,199,0.12)',
  color: '#4dbdaa',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.48)'
};

const toolbarWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 10,
  marginTop: 14,
  flexWrap: 'wrap'
};

const fieldWrap: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const fieldLabel: CSSProperties = {
  marginBottom: 6,
  color: '#60707a',
  fontSize: 12,
  fontWeight: 800
};

const dateInput: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.52)',
  background: 'rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
  color: '#33424b',
  fontSize: 14,
  fontWeight: 700,
  outline: 'none'
};

const metaRow: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 12
};

const metaChip: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 14,
  background: 'rgba(247,250,251,0.78)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#5f6c74'
};

const metaChipIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#7a8a93',
  flex: '0 0 auto'
};

const metaChipText: CSSProperties = {
  minWidth: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45
};

const actionCard: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const editorCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sectionTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const sectionDesc: CSSProperties = {
  marginTop: 6,
  color: '#69767e',
  fontSize: 14,
  lineHeight: 1.55
};

const actionButtons: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
};

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 148,
  padding: 14,
  borderRadius: 18,
  resize: 'vertical',
  border: '1px solid rgba(255,255,255,0.52)',
  background: 'rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
  color: '#33424b',
  fontSize: 14,
  lineHeight: 1.65,
  outline: 'none'
};

const helperPanel: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(247,250,251,0.76)',
  border: '1px solid rgba(224,231,236,0.84)'
};

const helperTitle: CSSProperties = {
  color: '#3d4a53',
  fontSize: 13,
  fontWeight: 800
};

const helperText: CSSProperties = {
  marginTop: 6,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.6
};

const noticeBox: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 16,
  border: '1px solid transparent',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.5,
  boxShadow: '0 8px 18px rgba(77,90,110,0.05)'
};

const skeletonCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const skeletonBadge: CSSProperties = {
  width: 74,
  height: 26,
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.025), rgba(0,0,0,0.05))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.2s linear infinite'
};

const skeletonTitle: CSSProperties = {
  width: '54%',
  height: 28,
  borderRadius: 12,
  marginTop: 12,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.025), rgba(0,0,0,0.05))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.2s linear infinite'
};

const skeletonLine: CSSProperties = {
  height: 14,
  borderRadius: 10,
  marginTop: 8,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.025), rgba(0,0,0,0.05))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.2s linear infinite'
};

const skeletonButton: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 16,
  background: 'linear-gradient(90deg, rgba(114,215,199,0.16), rgba(114,215,199,0.08), rgba(114,215,199,0.16))',
  backgroundSize: '200% 100%',
  animation: 'qtShimmer 1.2s linear infinite'
};

const icon24: CSSProperties = {
  width: 24,
  height: 24
};

const icon14: CSSProperties = {
  width: 14,
  height: 14
};
