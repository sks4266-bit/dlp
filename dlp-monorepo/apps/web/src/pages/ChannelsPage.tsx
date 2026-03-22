import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardTitle, CardDesc } from '../ui/Card';

type Channel = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdAt: number;
  score?: number;
};

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

      if (!r1.ok || !r2.ok) throw new Error('불러오기에 실패했습니다.');

      setReco(await r1.json());
      setAll(await r2.json());
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
        alert('생성 실패');
        return;
      }

      const data = await res.json();
      setCreateOpen(false);
      setName('');
      setDesc('');
      await load();
      nav(`/channels/${data.id}`);
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div style={page}>
      <TopBar
        title="교회 채널"
        backTo="/"
        right={
          <Button type="button" variant="secondary" size="md" onClick={() => setCreateOpen(true)}>
            + 채널 생성
          </Button>
        }
      />

      <main style={wrap}>
        <section style={hero}>
          <div style={heroBadge}>FELLOWSHIP</div>
          <h1 style={heroTitle}>공지와 기도제목을 한 톤으로 모아보세요</h1>
          <p style={heroDesc}>
            추천 채널부터 전체 채널까지 차분한 카드 레이아웃으로 정리하고,
            필요한 경우 즉시 채널을 만들 수 있게 구성했습니다.
          </p>
        </section>

        {err ? <div style={errorBox}>{err}</div> : null}

        <Card pad style={heroCard}>
          <div style={heroRow}>
            <div>
              <CardTitle style={bigCardTitle}>채널 허브</CardTitle>
              <CardDesc style={bigCardDesc}>
                교회 공지, 기도 나눔, 공동체 소식을 한곳에서 이어 보세요.
              </CardDesc>
            </div>

            <div style={statGroup}>
              <StatChip label="추천" value={String(reco.length)} tint="mint" />
              <StatChip label="전체" value={String(all.length)} tint="peach" />
            </div>
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
              새 채널 만들기
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={load}>
              새로고침
            </Button>
          </div>
        </Card>

        <div style={{ height: 14 }} />

        <SectionHeader
          eyebrow="추천"
          title="추천 채널"
          desc="가장 먼저 살펴보면 좋은 공동체 채널입니다."
        />
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

        <div style={{ height: 18 }} />

        <SectionHeader
          eyebrow="전체"
          title="전체 채널"
          desc="모든 채널을 스크롤 없이도 부드럽게 탐색할 수 있도록 정리했습니다."
        />
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
      </main>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={sheetHeader}>
          <div>
            <div style={sheetEyebrow}>CREATE CHANNEL</div>
            <div style={sheetTitle}>새 채널 만들기</div>
          </div>
        </div>

        <div style={sheetBody}>
          <Field label="채널 이름">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder="예) 00교회 청년부"
            />
          </Field>

          <Field label="설명(선택)">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={input}
              placeholder="예) 주보 · 공지 · 기도제목 공유"
            />
          </Field>

          <div style={actionGrid}>
            <Button type="button" variant="primary" size="lg" wide onClick={onCreate} disabled={createSaving}>
              {createSaving ? '생성 중…' : '생성'}
            </Button>
            <Button type="button" variant="secondary" size="md" wide onClick={() => setCreateOpen(false)}>
              닫기
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  desc
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div style={sectionHeader}>
      <div style={sectionEyebrow}>{eyebrow}</div>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{desc}</div>
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
          tint === 'mint' ? 'rgba(114,215,199,0.16)' : 'rgba(243,180,156,0.16)',
        borderColor:
          tint === 'mint' ? 'rgba(114,215,199,0.24)' : 'rgba(243,180,156,0.24)'
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
        <div style={rowTitle}>{channel.name}</div>
        <div style={rowArrow}>›</div>
      </div>
      <div style={rowDesc}>{channel.description ?? '설명 없음'}</div>
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
    <Card pad style={emptyCard}>
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

const page: CSSProperties = {
  minHeight: '100dvh',
  background:
    'radial-gradient(circle at top left, rgba(217,242,231,0.72), transparent 28%), radial-gradient(circle at top right, rgba(247,229,216,0.72), transparent 24%), linear-gradient(180deg, #f8f3ea 0%, #f7f4ef 40%, #f4f7f8 100%)'
};

const wrap: CSSProperties = {
  width: '100%',
  maxWidth: 760,
  margin: '0 auto',
  padding: '10px 16px 48px'
};

const hero: CSSProperties = {
  padding: '18px 4px 16px'
};

const heroBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.7)',
  color: '#5a6a67',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  margin: '14px 0 8px',
  fontSize: 29,
  lineHeight: 1.16,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  margin: 0,
  color: '#60707a',
  fontSize: 14,
  lineHeight: 1.7
};

const heroCard: CSSProperties = {
  borderRadius: 28,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 20px 42px rgba(77,90,110,0.10)',
  backdropFilter: 'blur(16px)'
};

const heroRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};

const bigCardTitle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: '#24313a'
};

const bigCardDesc: CSSProperties = {
  marginTop: 6,
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 420
};

const statGroup: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap'
};

const statChip: CSSProperties = {
  minWidth: 92,
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
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 800,
  color: '#24313a'
};

const heroActions: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 18
};

const sectionHeader: CSSProperties = {
  padding: '2px 2px 10px'
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
  marginTop: 5,
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.6
};

const list: CSSProperties = {
  display: 'grid',
  gap: 12
};

const rowBtn: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'rgba(255,255,255,0.70)',
  boxShadow: '0 14px 32px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(14px)'
};

const rowTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12
};

const rowTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a'
};

const rowArrow: CSSProperties = {
  fontSize: 22,
  color: '#89a6a0',
  fontWeight: 700
};

const rowDesc: CSSProperties = {
  marginTop: 8,
  color: '#5f6b73',
  fontSize: 14,
  lineHeight: 1.6
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
  height: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  border: '1px solid rgba(114,215,199,0.2)',
  color: '#55746d',
  fontSize: 12,
  fontWeight: 800
};

const emptyCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.62)',
  border: '1px dashed rgba(180,191,198,0.8)'
};

const emptyText: CSSProperties = {
  color: '#78848c',
  fontSize: 14,
  lineHeight: 1.6
};

const skeletonCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
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

const errorBox: CSSProperties = {
  marginBottom: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,112,112,0.10)',
  border: '1px solid rgba(255,112,112,0.22)',
  color: '#9a4a4a',
  fontSize: 14,
  fontWeight: 700
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
  maxWidth: 620,
  borderRadius: '28px 28px 0 0',
  background: 'rgba(255,255,255,0.88)',
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
  fontSize: 22,
  fontWeight: 800,
  color: '#24313a'
};

const sheetBody: CSSProperties = {
  display: 'grid',
  gap: 14
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
