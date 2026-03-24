import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

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
      const [r1, r2] = await Promise.all([apiFetch('/api/channels/recommended'), apiFetch('/api/channels')]);

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
      window.alert('채널 이름을 2자 이상 입력하세요.');
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
        window.alert('생성에 실패했습니다.');
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
      <div style={pageInner}>
        <TopBar title="교회 채널" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={badgePeach}>FELLOWSHIP</div>
          <div style={heroTitle}>공지와 기도제목을 한곳에</div>
          <div style={heroDesc}>업로드한 홈 화면 기준 폭과 카드 밀도로 다시 맞추고, 채널 전용 배경 없이 차분한 홈 톤으로 통일했습니다.</div>

          <div style={statRow}>
            <StatChip label="추천" value={`${reco.length}`} tone="mint" />
            <StatChip label="전체" value={`${all.length}`} tone="peach" />
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              새 채널 만들기
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={load}>
              새로고침
            </Button>
          </div>
        </Card>

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <SectionBlock eyebrow="RECOMMENDED" title="추천 채널" desc="먼저 살펴보면 좋은 공동체 채널입니다." loading={loading} emptyText="추천할 채널이 없습니다." channels={reco.slice(0, 10)} onClick={(channelId) => nav(`/channels/${channelId}`)} />

        <SectionBlock eyebrow="ALL CHANNELS" title="전체 채널" desc="목록 카드 높이·간격·그림자를 상세 페이지와 동일 규격으로 맞췄습니다." loading={loading} emptyText="등록된 채널이 없습니다." channels={all.slice(0, 20)} onClick={(channelId) => nav(`/channels/${channelId}`)} />
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={sheetEyebrow}>CREATE CHANNEL</div>
        <div className="sheetTitle">새 채널 만들기</div>
        <div style={sheetDesc}>홈 시트 톤과 같은 높이·간격으로 정리했습니다.</div>

        <div className="stack10" />

        <Field label="채널 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} className="glassInput" placeholder="예) 00교회 청년부" />
        </Field>

        <div className="stack10" />

        <Field label="설명(선택)">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="glassInput" placeholder="예) 주보 · 공지 · 기도제목 공유" />
        </Field>

        <div className="stack12" />

        <Button type="button" variant="primary" size="lg" wide onClick={onCreate} disabled={createSaving}>
          {createSaving ? '생성 중…' : '생성'}
        </Button>
      </Sheet>
    </div>
  );
}

function SectionBlock({
  eyebrow,
  title,
  desc,
  loading,
  emptyText,
  channels,
  onClick
}: {
  eyebrow: string;
  title: string;
  desc: string;
  loading: boolean;
  emptyText: string;
  channels: Channel[];
  onClick: (channelId: string) => void;
}) {
  return (
    <Card pad style={sectionCard}>
      <div style={sectionHeader}>
        <div style={sectionEyebrow}>{eyebrow}</div>
        <div style={sectionTitle}>{title}</div>
        <div style={sectionDesc}>{desc}</div>
      </div>

      <div style={list}>
        {loading ? (
          <div className="glassSkeletonStack">
            <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
            <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
          </div>
        ) : channels.length === 0 ? (
          <div className="glassEmpty">{emptyText}</div>
        ) : (
          channels.map((channel) => <ChannelRow key={channel.id} channel={channel} onClick={() => onClick(channel.id)} />)
        )}
      </div>
    </Card>
  );
}

function ChannelRow({ channel, onClick }: { channel: Channel; onClick: () => void }) {
  return (
    <button type="button" style={listCardButton} onClick={onClick}>
      <div style={listCardTop}>
        <div style={listCardTitleWrap}>
          <div style={rowBadge}>교회 채널</div>
          <div style={listCardTitle}>{channel.name}</div>
        </div>
        <div style={rowArrow}>›</div>
      </div>
      <div style={listCardDesc}>{channel.description ?? '설명 없음'}</div>
      <div style={listCardMeta}>
        <span style={metaPillMint}>초대코드 {channel.inviteCode}</span>
        {typeof channel.score === 'number' ? <span style={metaPillNeutral}>추천점수 {channel.score}</span> : null}
      </div>
    </button>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: 'mint' | 'peach' }) {
  return (
    <div
      style={{
        ...statChip,
        background: tone === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)',
        borderColor: tone === 'mint' ? 'rgba(114,215,199,0.24)' : 'rgba(243,180,156,0.24)'
      }}
    >
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="glassField">
      <div className="glassFieldLabel">{label}</div>
      {children}
    </label>
  );
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="uiSheetBackdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="uiSheet" onClick={(e) => e.stopPropagation()}>
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>
        {children}
        <div className="stack10" />
        <Button type="button" variant="secondary" size="lg" wide onClick={onClose}>
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

const badgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.18)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#a05f48',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 10
};

const heroTitle: CSSProperties = {
  fontSize: 27,
  fontWeight: 800,
  color: '#24313a',
  lineHeight: 1.18,
  letterSpacing: '-0.02em'
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const statRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const statChip: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  border: '1px solid transparent'
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: '#68757e',
  fontWeight: 800
};

const statValue: CSSProperties = {
  marginTop: 8,
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 800,
  color: '#24313a'
};

const heroActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
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

const list: CSSProperties = {
  display: 'grid',
  gap: 12
};

const listCardButton: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  minHeight: 118,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  cursor: 'pointer'
};

const listCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const listCardTitleWrap: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const rowBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(243,200,181,0.28)',
  color: '#9d6550',
  fontSize: 11,
  fontWeight: 800
};

const listCardTitle: CSSProperties = {
  marginTop: 8,
  fontSize: 17,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em',
  lineHeight: 1.35
};

const rowArrow: CSSProperties = {
  fontSize: 22,
  color: '#89a6a0',
  fontWeight: 700
};

const listCardDesc: CSSProperties = {
  marginTop: 10,
  color: '#53626b',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const listCardMeta: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 12
};

const metaPillMint: CSSProperties = {
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

const metaPillNeutral: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.52)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#6e7b84',
  fontSize: 12,
  fontWeight: 800
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
