import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

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

export default function ChannelsPage() {
  const nav = useNavigate();

  const [reco, setReco] = useState<Channel[]>([]);
  const [all, setAll] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  function goLogin() {
    nav(`/login?${new URLSearchParams({ next: '/channels' }).toString()}`);
  }

  async function load() {
    setLoading(true);
    setErr(null);

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

      const recoData = (await r1.json()) as Channel[];
      const allData = (await r2.json()) as Channel[];

      setReco(Array.isArray(recoData) ? recoData : []);
      setAll(Array.isArray(allData) ? allData : []);
    } catch (e: any) {
      setErr(String(e?.message ?? '채널 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    const nextName = name.trim();
    const nextDesc = desc.trim();

    if (nextName.length < 2) {
      alert('채널 이름을 2자 이상 입력해 주세요.');
      return;
    }

    setCreateSaving(true);
    try {
      const res = await apiFetch('/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: nextName,
          description: nextDesc || null
        })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        const msg = await readErrorMessage(res, '채널 생성에 실패했습니다.');
        alert(msg);
        return;
      }

      const created = await res.json();
      setCreateOpen(false);
      setName('');
      setDesc('');
      await load();

      if (created?.id) {
        nav(`/channels/${created.id}`);
      }
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar
          title="교회 채널"
          backTo="/"
          right={
            <Button type="button" variant="secondary" size="md" onClick={() => setCreateOpen(true)}>
              + 생성
            </Button>
          }
        />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={badgePeach}>FELLOWSHIP</div>
              <CardTitle style={heroTitle}>공지와 기도제목을 한곳에</CardTitle>
              <CardDesc style={heroDesc}>
                홈 화면 톤 그대로, 모바일 한 열 구조로 채널 목록과 생성 흐름을 정리했습니다.
              </CardDesc>
            </div>
          </div>

          <div style={statGrid}>
            <StatChip label="추천" value={String(reco.length)} tint="mint" />
            <StatChip label="전체" value={String(all.length)} tint="peach" />
          </div>

          <div style={heroActions}>
            <Button type="button" variant="primary" size="lg" wide onClick={() => setCreateOpen(true)}>
              새 채널 만들기
            </Button>
            <Button type="button" variant="secondary" size="lg" wide onClick={load} disabled={loading}>
              {loading ? '불러오는 중…' : '새로고침'}
            </Button>
          </div>
        </Card>

        {err ? <ErrorBox text={err} onRetry={load} /> : null}

        <section style={sectionWrap}>
          <SectionHeader
            eyebrow="RECOMMENDED"
            title="추천 채널"
            desc="먼저 확인하면 좋은 채널들을 홈 화면 규격 카드로 정리했습니다."
          />

          <div style={list}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : reco.length === 0 ? (
              <EmptyState text="추천 채널이 없습니다." />
            ) : (
              reco.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  onClick={() => nav(`/channels/${channel.id}`)}
                />
              ))
            )}
          </div>
        </section>

        <section style={sectionWrap}>
          <SectionHeader
            eyebrow="ALL CHANNELS"
            title="전체 채널"
            desc="데스크톱형 넓은 레이아웃이 아니라 모바일 단일 열 기준으로 맞췄습니다."
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
              all.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  onClick={() => nav(`/channels/${channel.id}`)}
                />
              ))
            )}
          </div>
        </section>

        <Sheet open={createOpen} onClose={() => setCreateOpen(false)}>
          <div style={sheetHeader}>
            <div style={sheetEyebrow}>CREATE CHANNEL</div>
            <div style={sheetTitle}>새 채널 만들기</div>
          </div>

          <div style={sheetBody}>
            <Field label="채널 이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={input}
                placeholder="예) 청년부 기도방"
              />
            </Field>

            <Field label="설명 (선택)">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                style={textarea}
                placeholder="예) 공지 · 기도제목 · 나눔"
              />
            </Field>

            <div style={actionGrid}>
              <Button type="button" variant="primary" size="lg" wide onClick={onCreate} disabled={createSaving}>
                {createSaving ? '생성 중…' : '채널 생성'}
              </Button>
              <Button type="button" variant="secondary" size="lg" wide onClick={() => setCreateOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </Sheet>
      </div>
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
        background: tint === 'mint' ? 'rgba(114,215,199,0.14)' : 'rgba(243,180,156,0.16)',
        borderColor: tint === 'mint' ? 'rgba(114,215,199,0.22)' : 'rgba(243,180,156,0.24)'
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

      <div style={rowDesc}>{channel.description?.trim() || '설명이 아직 없습니다.'}</div>

      <div style={rowMeta}>
        <span style={metaPill}>초대코드 {channel.inviteCode}</span>
        {typeof channel.score === 'number' ? <span style={metaPill}>추천 {channel.score}</span> : null}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
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
    <div role="dialog" aria-modal="true" style={sheetBackdrop} onClick={onClose}>
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
  padding: '12px 14px 30px',
  background: 'transparent'
};

const pageInner: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  margin: '0 auto'
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

const heroCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(16px)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14
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

const statGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const statChip: CSSProperties = {
  minWidth: 0,
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
  color: '#24313a',
  fontWeight: 800
};

const heroActions: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 16
};

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionHeader: CSSProperties = {
  marginBottom: 10,
  padding: '2px 2px 0'
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
  marginTop: 4,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const list: CSSProperties = {
  display: 'grid',
  gap: 12
};

const rowBtn: CSSProperties = {
  width: '100%',
  padding: 0,
  border: 0,
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer'
};

const rowTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const rowTitle: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 800,
  color: '#24313a'
};

const rowArrow: CSSProperties = {
  color: '#96a1a8',
  fontSize: 20,
  fontWeight: 700,
  flex: '0 0 auto'
};

const rowDesc: CSSProperties = {
  marginTop: 6,
  color: '#67737b',
  fontSize: 14,
  lineHeight: 1.55
};

const rowMeta: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10
};

const metaPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(247,250,251,0.9)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#62717a',
  fontSize: 12,
  fontWeight: 700
};

const emptyCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const emptyText: CSSProperties = {
  color: '#6f7b83',
  fontSize: 14,
  lineHeight: 1.55,
  textAlign: 'center'
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

const errorBox: CSSProperties = {
  marginTop: 12,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,243,240,0.96)',
  border: '1px solid rgba(234,178,161,0.44)',
  color: '#8b4f44'
};

const sheetBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,24,29,0.34)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 50,
  padding: '0 12px 12px'
};

const sheet: CSSProperties = {
  width: '100%',
  maxWidth: 430,
  borderRadius: '24px 24px 0 0',
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 -8px 30px rgba(31,41,55,0.18)',
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
  background: 'rgba(184,195,202,0.9)'
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
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em'
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
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '0 16px',
  fontSize: 15,
  color: '#24313a',
  outline: 'none',
  boxSizing: 'border-box'
};

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 112,
  borderRadius: 18,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(255,255,255,0.92)',
  padding: '14px 16px',
  fontSize: 15,
  lineHeight: 1.55,
  color: '#24313a',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box'
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
};
