import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardEyebrow, CardTitle } from '../ui/Card';

type Channel = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdAt: number;
  score?: number;
};

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => null);
      return j?.message || j?.error || fallback;
    }
    const text = await res.text().catch(() => '');
    return text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export default function ChannelsPage() {
  const nav = useNavigate();

  const [reco, setReco] = useState<Channel[]>([]);
  const [all, setAll] = useState<Channel[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/channels' }).toString()}`);
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const [r1, r2] = await Promise.all([
        apiFetch('/api/channels/recommended'),
        apiFetch('/api/channels')
      ]);

      if (r1.status === 401 || r2.status === 401) {
        goLogin();
        return;
      }

      if (!r1.ok) {
        throw new Error(await readErrorMessage(r1, '추천 채널을 불러오지 못했습니다.'));
      }
      if (!r2.ok) {
        throw new Error(await readErrorMessage(r2, '채널 목록을 불러오지 못했습니다.'));
      }

      const recoData = await r1.json();
      const allData = await r2.json();

      setReco(Array.isArray(recoData) ? recoData : []);
      setAll(Array.isArray(allData) ? allData : []);
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (name.trim().length < 2) {
      alert('채널 이름을 2자 이상 입력하세요.');
      return;
    }

    setCreateSaving(true);
    try {
      const res = await apiFetch('/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || null
        })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '채널 생성에 실패했습니다.'));
      }

      const data = await res.json();
      setCreateOpen(false);
      setName('');
      setDesc('');
      await load();
      nav(`/channels/${data.id}`);
    } catch (e: any) {
      alert(e?.message ?? '채널 생성에 실패했습니다.');
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title="교회 채널"
          backTo="/"
          right={
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>
              + 생성
            </Button>
          }
        />

        <Card style={heroCard}>
          <div style={badgeMint}>CHANNEL HUB</div>
          <div style={heroTitle}>공지와 기도 나눔을 한 곳에서 이어보세요</div>
          <div style={heroDesc}>
            추천 채널부터 전체 채널까지 홈 화면 톤과 같은 폭·간격으로 정리했습니다.
          </div>

          <div style={heroStats}>
            <StatChip label="추천" value={String(reco.length)} tint="mint" />
            <StatChip label="전체" value={String(all.length)} tint="peach" />
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={() => setCreateOpen(true)}>
              새 채널 만들기
            </Button>
            <Button type="button" variant="ghost" wide onClick={load}>
              새로고침
            </Button>
          </div>
        </Card>

        <div style={{ height: 12 }} />

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        <Card style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <CardEyebrow>RECOMMENDED</CardEyebrow>
              <CardTitle>추천 채널</CardTitle>
              <CardDesc>먼저 살펴보면 좋은 공동체 채널입니다.</CardDesc>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={list}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : reco.length === 0 ? (
              <EmptyState text="추천할 채널이 없습니다." />
            ) : (
              reco.slice(0, 10).map((c) => (
                <ChannelRow key={c.id} channel={c} onClick={() => nav(`/channels/${c.id}`)} />
              ))
            )}
          </div>
        </Card>

        <div style={{ height: 12 }} />

        <Card style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <CardEyebrow>ALL CHANNELS</CardEyebrow>
              <CardTitle>전체 채널</CardTitle>
              <CardDesc>모든 채널을 모바일 한 화면 안에서 차분하게 탐색할 수 있어요.</CardDesc>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={list}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : all.length === 0 ? (
              <EmptyState text="등록된 채널이 없습니다." />
            ) : (
              all.slice(0, 20).map((c) => (
                <ChannelRow key={c.id} channel={c} onClick={() => nav(`/channels/${c.id}`)} />
              ))
            )}
          </div>
        </Card>
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={sheetHeader}>
          <div style={sheetEyebrow}>CREATE CHANNEL</div>
          <div style={sheetTitle}>새 채널 만들기</div>
          <div style={sheetDesc}>교회 공지, 기도제목, 공동체 소식을 위한 채널을 추가합니다.</div>
        </div>

        <div style={{ height: 12 }} />

        <Field label="채널 이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
            placeholder="예) 청년부 공지방"
          />
        </Field>

        <div style={{ height: 10 }} />

        <Field label="설명(선택)">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            style={input}
            placeholder="예) 주보 · 공지 · 기도제목 공유"
          />
        </Field>

        <div style={{ height: 14 }} />

        <div style={actionGrid}>
          <Button
            type="button"
            variant="primary"
            size="lg"
            wide
            onClick={onCreate}
            disabled={createSaving}
          >
            {createSaving ? '생성 중…' : '생성'}
          </Button>
          <Button type="button" variant="ghost" wide onClick={() => setCreateOpen(false)}>
            닫기
          </Button>
        </div>
      </Sheet>
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
        background:
          tint === 'mint'
            ? 'rgba(114,215,199,0.16)'
            : 'rgba(243,180,156,0.16)',
        borderColor:
          tint === 'mint'
            ? 'rgba(114,215,199,0.26)'
            : 'rgba(243,180,156,0.26)'
      }}
    >
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function ChannelRow({
  channel,
  onClick
}: {
  channel: Channel;
  onClick: () => void;
}) {
  return (
    <button type="button" style={rowBtn} onClick={onClick}>
      <div style={rowTop}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={rowTitle}>{channel.name}</div>
          <div style={rowDesc}>{channel.description ?? '설명 없음'}</div>
        </div>
        <div style={rowArrow}>›</div>
      </div>

      <div style={rowMeta}>
        <span style={metaPill}>초대코드 {channel.inviteCode}</span>
        {typeof channel.score === 'number' ? (
          <span style={metaPill}>추천점수 {channel.score}</span>
        ) : null}
      </div>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card style={emptyCard}>
      <div style={emptyText}>{text}</div>
    </Card>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={field}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </label>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <Card style={errorCard}>
      <div style={errorTitle}>불러오기에 실패했습니다</div>
      <div style={errorText}>{text}</div>
      <div style={{ height: 10 }} />
      <Button variant="secondary" onClick={onRetry}>
        다시 시도
      </Button>
    </Card>
  );
}

function Sheet({
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
    <div style={sheetBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={sheetHandleWrap}>
          <div style={sheetHandle} />
        </div>
        {children}
      </div>
    </div>
  );
}

const heroCard: CSSProperties = {
  borderRadius: 24
};

const badgeMint: CSSProperties = {
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
  fontSize: 26,
  lineHeight: 1.18,
  fontWeight: 800,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#66737b',
  fontSize: 14,
  lineHeight: 1.6
};

const heroStats: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const statChip: CSSProperties = {
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
  fontSize: 21,
  lineHeight: 1,
  fontWeight: 800,
  color: '#24313a'
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 14
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

const list: CSSProperties = {
  display: 'grid',
  gap: 10
};

const rowBtn: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.64))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const rowTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const rowTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: '#24313a',
  lineHeight: 1.25
};

const rowArrow: CSSProperties = {
  fontSize: 22,
  color: '#89a6a0',
  fontWeight: 700,
  flexShrink: 0,
  lineHeight: 1
};

const rowDesc: CSSProperties = {
  marginTop: 7,
  color: '#5f6b73',
  fontSize: 13,
  lineHeight: 1.55
};

const rowMeta: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 12
};

const metaPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.2)',
  color: '#55746d',
  fontSize: 12,
  fontWeight: 800
};

const emptyCard: CSSProperties = {
  borderRadius: 20,
  textAlign: 'center'
};

const emptyText: CSSProperties = {
  color: '#78848c',
  fontSize: 14,
  lineHeight: 1.6
};

const skeletonCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'rgba(255,255,255,0.62)'
};

const skeletonLineLg: CSSProperties = {
  width: '52%',
  height: 18,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.55)'
};

const skeletonLineMd: CSSProperties = {
  width: '74%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.42)',
  marginTop: 12
};

const skeletonLineSm: CSSProperties = {
  width: '32%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.35)',
  marginTop: 10
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

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(32,39,43,0.36)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 12,
  zIndex: 1000
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: 28,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 20px 48px rgba(31,42,51,0.18)',
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
  background: 'rgba(129,141,148,0.28)'
};

const sheetHeader: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '4px 4px 0'
};

const sheetEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const sheetTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: '#24313a'
};

const sheetDesc: CSSProperties = {
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.55
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
  border: '1px solid rgba(202,212,220,0.9)',
  background: 'rgba(255,255,255,0.82)',
  padding: '0 16px',
  fontSize: 15,
  color: '#24313a',
  outline: 'none'
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
};
