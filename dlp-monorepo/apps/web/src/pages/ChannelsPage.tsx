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

type Tone = 'mint' | 'peach' | 'sky' | 'neutral';

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
        window.alert('생성 실패');
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
        <TopBar title="교회 채널" backTo="/" hideAuthActions />

        <Card className="glassHeroCard">
          <div className="profileHero">
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>FELLOWSHIP</div>
              <CardTitle>공지와 기도제목을 한 톤으로 모아보세요</CardTitle>
              <CardDesc>홈과 같은 간격과 카드 톤으로 추천 채널, 전체 채널, 생성 흐름까지 자연스럽게 이어지도록 정리했어요.</CardDesc>
            </div>
          </div>

          <div className="stack12" />

          <div className="glassStatGrid">
            <SummaryTile label="추천 채널" value={`${reco.length}개`} subValue="먼저 보면 좋은 공동체" tone="mint" />
            <SummaryTile label="전체 채널" value={`${all.length}개`} subValue="전체 탐색 가능" tone="peach" />
            <SummaryTile label="새 채널" value="즉시 생성" subValue="설명과 함께 등록" tone="sky" />
            <SummaryTile label="탐색 흐름" value="홈 톤 유지" subValue="목록과 상세 완전 통일" tone="neutral" />
          </div>

          <div className="stack12" />

          <div style={heroPillRowStyle}>
            <span style={heroMintPillStyle}>추천 · 전체 채널 한 번에 탐색</span>
            <span style={heroPeachPillStyle}>상세 페이지와 카드 규격 통일</span>
            <span style={heroNeutralPillStyle}>배경 제거 · 홈 사이즈 유지</span>
          </div>

          <div className="stack12" />

          <div style={heroActionGridStyle}>
            <Button type="button" variant="primary" size="lg" wide onClick={() => setCreateOpen(true)}>
              새 채널 만들기
            </Button>
            <Button type="button" variant="secondary" size="lg" wide onClick={load}>
              새로고침
            </Button>
          </div>
        </Card>

        <div className="stack12" />

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <SectionBlock
          eyebrow="RECOMMENDED"
          title="추천 채널"
          desc="가장 먼저 살펴보면 좋은 공동체 채널입니다."
          loading={loading}
          emptyText="추천할 채널이 없습니다."
          channels={reco.slice(0, 10)}
          onClick={(channelId) => nav(`/channels/${channelId}`)}
        />

        <div className="stack12" />

        <SectionBlock
          eyebrow="ALL CHANNELS"
          title="전체 채널"
          desc="목록과 상세 카드의 높이, 간격, 그림자를 같은 규격으로 맞췄어요."
          loading={loading}
          emptyText="등록된 채널이 없습니다."
          channels={all.slice(0, 20)}
          onClick={(channelId) => nav(`/channels/${channelId}`)}
        />
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={sheetEyebrowStyle}>CREATE CHANNEL</div>
        <div className="sheetTitle">새 채널 만들기</div>
        <div style={sheetDescStyle}>홈과 같은 부드러운 톤으로 공지 · 기도 채널을 바로 시작해보세요.</div>

        <div className="stack10" />

        <Field label="채널 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} className="glassInput" placeholder="예) 00교회 청년부" />
        </Field>

        <div className="stack10" />

        <Field label="설명(선택)">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="glassInput" placeholder="예) 주보 · 공지 · 기도제목 공유" />
        </Field>

        <div className="stack10" />

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
    <Card className="glassHeroCard">
      <div className="sectionHeadRow">
        <div>
          <div style={sectionEyebrowStyle}>{eyebrow}</div>
          <CardTitle>{title}</CardTitle>
          <CardDesc>{desc}</CardDesc>
        </div>
      </div>

      <div className="stack12" />

      <div style={cardListStyle}>
        {loading ? (
          <div className="glassSkeletonStack">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
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

function SummaryTile({
  label,
  value,
  subValue,
  tone
}: {
  label: string;
  value: string;
  subValue: string;
  tone: Tone;
}) {
  return (
    <div style={{ ...summaryTileStyle, ...getToneCardStyle(tone) }}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summarySubStyle}>{subValue}</div>
    </div>
  );
}

function ChannelRow({ channel, onClick }: { channel: Channel; onClick: () => void }) {
  return (
    <button type="button" style={listCardButtonStyle} onClick={onClick}>
      <div style={listCardTopStyle}>
        <div style={listCardTitleWrapStyle}>
          <div style={listCardBadgeStyle}>교회 채널</div>
          <div style={listCardTitleStyle}>{channel.name}</div>
        </div>
        <div style={listCardArrowStyle}>›</div>
      </div>

      <div style={listCardDescStyle}>{channel.description ?? '설명 없음'}</div>

      <div style={listCardMetaStyle}>
        <span style={authorPillStyle}>초대코드 {channel.inviteCode}</span>
        {typeof channel.score === 'number' ? <span style={metaPillNeutralStyle}>추천점수 {channel.score}</span> : null}
      </div>
    </button>
  );
}

function SkeletonCard() {
  return <div className="glassSkeletonBlock" style={{ height: 138 }} />;
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

function getToneCardStyle(tone: Tone): CSSProperties {
  switch (tone) {
    case 'mint':
      return {
        background: 'linear-gradient(180deg, rgba(114,215,199,0.18), rgba(255,255,255,0.62))',
        border: '1px solid rgba(114,215,199,0.28)'
      };
    case 'peach':
      return {
        background: 'linear-gradient(180deg, rgba(243,200,181,0.24), rgba(255,255,255,0.62))',
        border: '1px solid rgba(243,200,181,0.34)'
      };
    case 'sky':
      return {
        background: 'linear-gradient(180deg, rgba(223,243,250,0.7), rgba(255,255,255,0.64))',
        border: '1px solid rgba(191,229,243,0.68)'
      };
    default:
      return {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.74), rgba(255,255,255,0.6))',
        border: '1px solid rgba(255,255,255,0.56)'
      };
  }
}

const eyebrowStyle: CSSProperties = {
  marginBottom: 8,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#82a39a'
};

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const summaryTileStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
};

const summaryLabelStyle: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const summaryValueStyle: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: '-0.03em'
};

const summarySubStyle: CSSProperties = {
  marginTop: 8,
  color: '#6a7780',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45
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

const heroNeutralPillStyle: CSSProperties = {
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

const heroActionGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10
};

const cardListStyle: CSSProperties = {
  display: 'grid',
  gap: 12
};

const listCardButtonStyle: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  minHeight: 138,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.58)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  cursor: 'pointer'
};

const listCardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const listCardTitleWrapStyle: CSSProperties = {
  minWidth: 0,
  flex: 1
};

const listCardBadgeStyle: CSSProperties = {
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

const listCardTitleStyle: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-0.02em'
};

const listCardArrowStyle: CSSProperties = {
  fontSize: 22,
  color: '#89a6a0',
  fontWeight: 700
};

const listCardDescStyle: CSSProperties = {
  marginTop: 12,
  color: '#53626b',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
};

const listCardMetaStyle: CSSProperties = {
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const authorPillStyle: CSSProperties = {
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

const metaPillNeutralStyle: CSSProperties = {
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
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap'
};
