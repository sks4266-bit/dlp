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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar
          title="교회 채널"
          backTo="/"
          right={
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>
              + 채널 생성
            </Button>
          }
        />

        <Card style={heroCard}>
          <div style={badgeMint}>FELLOWSHIP</div>
          <div style={heroTitle}>공지와 기도제목을 같은 톤으로 모아보세요</div>
          <div style={heroDesc}>
            추천 채널과 전체 채널을 한 화면에서 자연스럽게 탐색하고,
            필요하면 바로 새 채널을 만들 수 있도록 정리했습니다.
          </div>

          <div style={{ height: 16 }} />

          <div style={heroSummary}>
            <StatChip label="추천" value={String(reco.length)} tint="mint" />
            <StatChip label="전체" value={String(all.length)} tint="peach" />
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

        <div style={{ height: 12 }} />

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        <Card style={sectionCard}>
          <div style={sectionHeader}>
            <div>
              <CardEyebrow>RECOMMENDED</CardEyebrow>
              <CardTitle>추천 채널</CardTitle>
              <CardDesc>가장 먼저 살펴보면 좋은 공동체 채널입니다.</CardDesc>
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
          <div style={sectionHeader}>
            <div>
              <CardEyebrow>ALL CHANNELS</CardEyebrow>
              <CardTitle>전체 채널</CardTitle>
              <CardDesc>모든 채널을 현재 디자인 톤에 맞춰 차분하게 탐색할 수 있습니다.</CardDesc>
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
          <div>
            <div style={sheetEyebrow}>CREATE CHANNEL</div>
            <div style={sheetTitle}>새 채널 만들기</div>
            <div style={sheetDesc}>교회 공지, 기도 나눔, 공동체 소식을 위한 공간을 추가합니다.</div>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <Field label="채널 이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
            placeholder="예) 00교회 청년부"
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
          <Button type="button" variant="primary" size="lg" wide onClick={onCreate} disabled={createSaving}>
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
        <div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={field}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={emptyCard}>
      <div style={emptyText}>{text}</div>
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
  borderRadius: 28,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.68))',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 20px 42px rgba(77,90,110,0.10)'
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

const heroSummary: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
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
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 800,
  color: '#24313a'
};

const heroActions: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 16
};

const sectionCard: