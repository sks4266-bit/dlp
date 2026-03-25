import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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

function normalizeText(value: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/교회/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
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

  const [searchText, setSearchText] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joiningByCode, setJoiningByCode] = useState(false);

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

      if (!r1.ok || !r2.ok) throw new Error('교회 채널을 불러오지 못했습니다.');

      setReco(await r1.json());
      setAll(await r2.json());
    } catch (e: any) {
      setErr(e?.message ?? '교회 채널을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchedChannels = useMemo(() => {
    const q = normalizeText(searchText);
    if (!q) return all.slice(0, 8);
    return all
      .filter((channel) => {
        const nameKey = normalizeText(channel.name);
        const descKey = normalizeText(channel.description ?? '');
        return nameKey.includes(q) || descKey.includes(q);
      })
      .slice(0, 12);
  }, [all, searchText]);

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
        window.alert('채널 생성에 실패했습니다.');
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

  async function joinChannel(channel: Channel) {
    setJoiningId(channel.id);
    try {
      const res = await apiFetch(`/api/channels/${channel.id}/join`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        window.alert('채널 입장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      nav(`/channels/${channel.id}`);
    } finally {
      setJoiningId(null);
    }
  }

  async function joinWithInviteCode() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      window.alert('초대코드를 입력하세요.');
      return;
    }

    setJoiningByCode(true);
    try {
      const res = await apiFetch('/api/channels/join-by-code', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        window.alert('초대코드를 확인해주세요.');
        return;
      }

      const data = await res.json();
      setInviteCode('');
      nav(`/channels/${data.channelId}`);
    } finally {
      setJoiningByCode(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="교회 채널" backTo="/" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={badgePeach}>CHURCH CHANNEL</div>
          <div style={heroTitle}>교회 채널 입장 방식을 두 가지로 정리했어요</div>
          <div style={heroDesc}>이제 채널명을 검색해서 바로 입장할 수도 있고, 초대코드를 입력해서 빠르게 입장할 수도 있습니다. 가입 승인 절차 없이 누구나 바로 입장할 수 있게 열어두었습니다.</div>

          <div style={statRow}>
            <StatChip label="추천 채널" value={`${reco.length}`} tone="mint" />
            <StatChip label="전체 채널" value={`${all.length}`} tone="peach" />
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

        <div style={entryGrid}>
          <Card pad style={entryCard}>
            <div style={entryEyebrow}>SEARCH ENTRY</div>
            <div style={entryTitle}>채널명으로 찾아서 바로 입장</div>
            <div style={entryDesc}>교회명, 부서명, 소그룹명으로 검색하면 바로 입장 버튼이 보입니다.</div>
            <div className="stack10" />

            <label className="glassField">
              <div className="glassFieldLabel">채널명 검색</div>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="glassInput"
                placeholder="예) 청년부, 중보기도팀, 00교회"
              />
            </label>

            <div className="stack10" />

            <div style={searchResultList}>
              {loading ? (
                <div className="glassSkeletonStack">
                  <div className="glassSkeletonBlock" style={{ height: 96, borderRadius: 20 }} />
                  <div className="glassSkeletonBlock" style={{ height: 96, borderRadius: 20 }} />
                </div>
              ) : searchedChannels.length === 0 ? (
                <div className="glassEmpty">검색된 채널이 없습니다.</div>
              ) : (
                searchedChannels.map((channel) => (
                  <SearchJoinRow
                    key={channel.id}
                    channel={channel}
                    joining={joiningId === channel.id}
                    onOpen={() => nav(`/channels/${channel.id}`)}
                    onJoin={() => joinChannel(channel)}
                  />
                ))
              )}
            </div>
          </Card>

          <Card pad style={entryCard}>
            <div style={entryEyebrow}>INVITE CODE</div>
            <div style={entryTitle}>초대코드로 빠르게 입장</div>
            <div style={entryDesc}>공유받은 초대코드만 입력하면 채널 상세로 즉시 이동합니다.</div>
            <div className="stack10" />

            <label className="glassField">
              <div className="glassFieldLabel">초대코드</div>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="glassInput"
                placeholder="예) ABC123"
                maxLength={12}
              />
            </label>

            <div className="stack10" />

            <Button type="button" variant="primary" size="lg" wide onClick={joinWithInviteCode} disabled={joiningByCode}>
              {joiningByCode ? '입장 중…' : '초대코드로 입장'}
            </Button>

            <div className="stack12" />

            <div style={guideBox}>
              <div style={guideTitle}>입장 정책</div>
              <div style={guideText}>모든 로그인 사용자는 채널을 찾거나 초대코드를 입력해 바로 입장할 수 있습니다. 세부 관리 권한은 채널 관리자에게 남겨두었습니다.</div>
            </div>
          </Card>
        </div>

        <SectionBlock
          eyebrow="RECOMMENDED"
          title="추천 채널"
          desc="홈 교회명과 가까운 채널을 먼저 살펴볼 수 있어요."
          loading={loading}
          emptyText="추천할 채널이 없습니다."
          channels={reco.slice(0, 10)}
          joiningId={joiningId}
          onOpen={(channelId) => nav(`/channels/${channelId}`)}
          onJoin={(channel) => joinChannel(channel)}
        />

        <SectionBlock
          eyebrow="ALL CHANNELS"
          title="전체 채널"
          desc="검색과 별개로 전체 목록도 카드형으로 바로 둘러볼 수 있어요."
          loading={loading}
          emptyText="등록된 채널이 없습니다."
          channels={all.slice(0, 20)}
          joiningId={joiningId}
          onOpen={(channelId) => nav(`/channels/${channelId}`)}
          onJoin={(channel) => joinChannel(channel)}
        />
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={sheetEyebrow}>CREATE CHANNEL</div>
        <div className="sheetTitle">새 채널 만들기</div>
        <div style={sheetDesc}>교회, 부서, 소그룹 단위로 채널을 개설하고 구성원이 바로 입장할 수 있게 할 수 있습니다.</div>

        <div className="stack10" />

        <Field label="채널 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} className="glassInput" placeholder="예) 00교회 청년부" />
        </Field>

        <div className="stack10" />

        <Field label="설명(선택)">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="glassInput" placeholder="예) 공지 · 기도제목 · 모임안내" />
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
  joiningId,
  onOpen,
  onJoin
}: {
  eyebrow: string;
  title: string;
  desc: string;
  loading: boolean;
  emptyText: string;
  channels: Channel[];
  joiningId: string | null;
  onOpen: (channelId: string) => void;
  onJoin: (channel: Channel) => void;
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
          channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              joining={joiningId === channel.id}
              onOpen={() => onOpen(channel.id)}
              onJoin={() => onJoin(channel)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function SearchJoinRow({
  channel,
  joining,
  onOpen,
  onJoin
}: {
  channel: Channel;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <div style={searchResultCard}>
      <div style={searchResultTop}>
        <div>
          <div style={rowBadge}>검색 결과</div>
          <div style={searchResultTitle}>{channel.name}</div>
        </div>
        <span style={metaPillMint}>즉시 입장</span>
      </div>
      <div style={searchResultDesc}>{channel.description ?? '설명 없음'}</div>
      <div style={rowActionGrid}>
        <Button type="button" variant="secondary" size="md" onClick={onOpen}>
          상세 보기
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onJoin} disabled={joining}>
          {joining ? '입장 중…' : '바로 입장'}
        </Button>
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  joining,
  onOpen,
  onJoin
}: {
  channel: Channel;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <div style={listCard}>
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
      <div style={rowActionGrid}>
        <Button type="button" variant="secondary" size="md" onClick={onOpen}>
          상세 보기
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onJoin} disabled={joining}>
          {joining ? '입장 중…' : '입장'}
        </Button>
      </div>
    </div>
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
  border: '1px solid transparent',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const statLabel: CSSProperties = {
  color: '#6b7880',
  fontSize: 12,
  fontWeight: 800
};

const statValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.05
};

const heroActions: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const entryGrid: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginBottom: 12
};

const entryCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const entryEyebrow: CSSProperties = {
  color: '#83a39a',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const entryTitle: CSSProperties = {
  marginTop: 6,
  color: '#24313a',
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.2
};

const entryDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.55
};

const guideBox: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(243,180,156,0.1)',
  border: '1px solid rgba(243,180,156,0.18)'
};

const guideTitle: CSSProperties = {
  color: '#9d6550',
  fontSize: 13,
  fontWeight: 800
};

const guideText: CSSProperties = {
  marginTop: 6,
  color: '#6c7780',
  fontSize: 13,
  lineHeight: 1.55
};

const searchResultList: CSSProperties = {
  display: 'grid',
  gap: 10
};

const searchResultCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const searchResultTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const searchResultTitle: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.2
};

const searchResultDesc: CSSProperties = {
  marginTop: 8,
  color: '#67747d',
  fontSize: 13,
  lineHeight: 1.55
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
  gap: 10
};

const listCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 20,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)',
  textAlign: 'left'
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
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73',
  fontSize: 11,
  fontWeight: 800
};

const listCardTitle: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 19,
  fontWeight: 800,
  lineHeight: 1.2
};

const rowArrow: CSSProperties = {
  color: '#8aa09a',
  fontSize: 24,
  lineHeight: 1
};

const listCardDesc: CSSProperties = {
  marginTop: 8,
  color: '#67747d',
  fontSize: 14,
  lineHeight: 1.6
};

const listCardMeta: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10
};

const rowActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 12
};

const metaPillMint: CSSProperties = {
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

const metaPillNeutral: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.72)',
  color: '#6e7b84',
  fontSize: 12,
  fontWeight: 800
};

const sheetEyebrow: CSSProperties = {
  color: '#83a39a',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const sheetDesc: CSSProperties = {
  marginTop: 6,
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.55
};
