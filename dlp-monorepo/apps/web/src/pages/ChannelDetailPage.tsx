import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

type Channel = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  myRole: string | null;
  memberCount?: number;
};

type Member = {
  userId: string;
  name: string;
  role: string;
  joinedAt: number;
  isMe: boolean;
};

type Post = {
  id: string;
  boardType: string;
  title: string | null;
  content: string;
  authorName: string;
  createdAt: number;
};

type Comment = {
  id: string;
  content: string;
  authorName: string;
  createdAt: number;
};

type Tone = 'mint' | 'peach' | 'sky' | 'neutral';

export default function ChannelDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [tab, setTab] = useState<'notice' | 'prayer'>('notice');
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joinSaving, setJoinSaving] = useState(false);
  const isMember = !!channel?.myRole;
  const isManager = channel?.myRole === 'OWNER' || channel?.myRole === 'ADMIN';

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const boardLabel = tab === 'notice' ? '' : '';
  const boardDesc = tab === 'notice' ? '' : '';

  const summaryItems = useMemo(
    () => [
      {
        label: '',
        value: isMember ? '' : '',
        subValue: isMember ? channel?.myRole ?? '' : '',
        tone: 'mint' as Tone
      },
      {
        label: '',
        value: loading ? '' : `${channel?.memberCount ?? members.length}`,
        subValue: isManager ? '' : '',
        tone: 'sky' as Tone
      },
      {
        label: '',
        value: boardLabel,
        subValue: tab === 'notice' ? '' : '',
        tone: tab === 'notice' ? ('peach' as Tone) : ('mint' as Tone)
      },
      {
        label: '',
        value: loading ? '' : `${posts.length}`,
        subValue: `${boardLabel}`,
        tone: 'neutral' as Tone
      }
    ],
    [boardLabel, channel?.memberCount, channel?.myRole, isManager, isMember, loading, members.length, posts.length, tab]
  );

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadChannel() {
    if (!id) return null;

    const res = await apiFetch(`/api/channels/${id}`);
    if (res.status === 401) {
      goLogin();
      return null;
    }
    if (!res.ok) throw new Error('');
    const data = (await res.json()) as Channel;
    setChannel(data);
    return data;
  }

  async function loadPosts() {
    if (!id) return;

    const res = await apiFetch(`/api/channels/${id}/posts?board=${tab}`);
    if (res.status === 401) {
      goLogin();
      return;
    }
    if (!res.ok) throw new Error('');
    setPosts(await res.json());
  }

  async function loadMembers() {
    if (!id) return;

    setMembersLoading(true);
    try {
      const res = await apiFetch(`/api/channels/${id}/members`);
      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.status === 403) {
        setMembers([]);
        return;
      }
      if (!res.ok) throw new Error('');
      setMembers(await res.json());
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadAll() {
    setErr(null);
    setLoading(true);
    try {
      const nextChannel = await loadChannel();
      await loadPosts();
      if (nextChannel?.myRole) {
        await loadMembers();
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      setErr(e?.message ?? '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab]);

  async function openComments(post: Post) {
    setActivePost(post);
    setComments([]);
    setCommentsOpen(true);
    setCommentsLoading(true);

    try {
      const res = await apiFetch(`/api/channels/posts/${post.id}/comments`);
      if (res.status === 401) {
        goLogin();
        return;
      }
      if (res.ok) {
        setComments(await res.json());
      } else {
        setComments([]);
      }
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitJoin(mode: 'open' | 'code') {
    if (!channel) return;
    if (mode === 'code' && joinCode.trim().length < 4) {
      window.alert('');
      return;
    }

    setJoinSaving(true);
    try {
      const res = await apiFetch(`/api/channels/${channel.id}/join`, {
        method: 'POST',
        body: JSON.stringify(mode === 'code' ? { inviteCode: joinCode.trim().toUpperCase() } : {})
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        window.alert(mode === 'code' ? '' : '');
        return;
      }

      setJoinCode('');
      await loadAll();
      window.alert('');
    } finally {
      setJoinSaving(false);
    }
  }

  async function submitPost() {
    if (!id) return;
    if (!content.trim()) {
      window.alert('');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/channels/${id}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          boardType: tab,
          title: title.trim() || null,
          content: content.trim()
        })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) throw new Error('POST_FAILED');

      setTitle('');
      setContent('');
      setComposerOpen(false);
      await loadPosts();
    } catch {
      window.alert('');
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!activePost) return;
    if (!commentText.trim()) {
      window.alert('');
      return;
    }

    setCommentSaving(true);
    try {
      const res = await apiFetch(`/api/channels/posts/${activePost.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() })
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) throw new Error('COMMENT_FAILED');

      setCommentText('');
      await openComments(activePost);
    } catch {
      window.alert('');
    } finally {
      setCommentSaving(false);
    }
  }

  async function kickMember(member: Member) {
    if (!id) return;
    if (!window.confirm(`${member.name}`)) return;

    setKickingUserId(member.userId);
    try {
      const res = await apiFetch(`/api/channels/${id}/members/${member.userId}/kick`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (res.status === 401) {
        goLogin();
        return;
      }

      if (!res.ok) {
        window.alert('');
        return;
      }

      await loadAll();
    } finally {
      setKickingUserId(null);
    }
  }

  function openComposerForCurrentTab() {
    if (!isMember) {
      window.alert('');
      return;
    }
    setComposerOpen(true);
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="" backTo="/channels" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>CHANNEL DETAIL</div>
              <div style={heroTitle}>{channel?.name ?? ''}</div>
              <div style={heroDesc}>{channel?.description ?? ''}</div>
            </div>
            <div style={roleChip}>{channel?.myRole ?? ''}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}></span>
            <span style={heroPeachPill}></span>
            <span style={heroSkyPill}>{isManager ? '' : ''}</span>
          </div>

          <div style={summaryGrid}>
            {summaryItems.map((item) => (
              <SummaryTile key={item.label} label={item.label} value={item.value} subValue={item.subValue} tone={item.tone} />
            ))}
          </div>

          <div style={actionGrid}>
            <Button variant="primary" size="md" onClick={openComposerForCurrentTab}>{''}</Button>
            <Button variant="secondary" size="md" onClick={loadAll}>{''}</Button>
          </div>

          {!isMember && channel ? (
            <div style={joinCard}>
              <div style={joinTitle}></div>
              <div style={joinDesc}></div>
              <div className="stack10" />
              <Button variant="primary" size="lg" wide onClick={() => submitJoin('open')} disabled={joinSaving}>
                {joinSaving ? '' : ''}
              </Button>
              <div className="stack10" />
              <Field label="">
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder=") ABC123" className="glassInput" />
              </Field>
              <div className="stack10" />
              <Button variant="secondary" size="lg" wide onClick={() => submitJoin('code')} disabled={joinSaving}>{''}</Button>
            </div>
          ) : null}
        </Card>

        {err ? <div className="uiErrorBox">{err}</div> : null}

        {isMember ? (
          <Card pad style={sectionCard}>
            <SectionHeader
              eyebrow="MEMBERS"
              title=""
              desc={isManager ? '' : ''}
            />

            <div style={cardList}>
              {membersLoading ? (
                <div className="glassSkeletonStack">
                  <div className="glassSkeletonBlock" style={{ height: 88, borderRadius: 18 }} />
                  <div className="glassSkeletonBlock" style={{ height: 88, borderRadius: 18 }} />
                </div>
              ) : members.length === 0 ? (
                <div className="glassEmpty"></div>
              ) : (
                members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    canKick={!!isManager && !member.isMe && member.role !== 'OWNER'}
                    kicking={kickingUserId === member.userId}
                    onKick={() => kickMember(member)}
                  />
                ))
              )}
            </div>
          </Card>
        ) : null}

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="BOARD" title={`${boardLabel}`} desc={boardDesc} />

          <div style={tabGaugeGrid}>
            <GaugeTabButton label="" title="" hint="" tone="peach" active={tab === 'notice'} onClick={() => setTab('notice')} />
            <GaugeTabButton label="" title="" hint="" tone="mint" active={tab === 'prayer'} onClick={() => setTab('prayer')} />
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="POSTS" title="" desc={loading ? '' : `${posts.length}${boardLabel}`} />

          <div style={cardList}>
            {loading ? (
              <div className="glassSkeletonStack">
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="glassEmpty"></div>
            ) : (
              posts.map((post) => (
                <button key={post.id} type="button" style={listCardButton} onClick={() => openComments(post)}>
                  <div style={listCardTop}>
                    <div style={listCardTitleWrap}>
                      <div style={post.boardType === 'notice' ? rowBadgePeach : rowBadgeMint}>{post.boardType === 'notice' ? '' : ''}</div>
                      <div style={listCardTitle}>{post.title || (post.boardType === 'notice' ? '' : '')}</div>
                    </div>
                    <div style={postTime}>{formatTime(post.createdAt)}</div>
                  </div>

                  <div style={listCardDesc}>{post.content}</div>

                  <div style={listCardMeta}>
                    <span style={authorPill}>{post.authorName}</span>
                    <span style={metaPillNeutral}></span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)}>
          <div style={sheetEyebrow}>{tab === 'notice' ? 'NOTICE POST' : 'PRAYER POST'}</div>
          <div className="sheetTitle"></div>
          <div style={sheetDesc}></div>
          <div className="stack10" />

          <Field label="">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="" className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="" className="glassTextarea" style={{ minHeight: 100 }} />
          </Field>

          <div className="stack12" />

          <Button variant="primary" size="lg" wide onClick={submitPost} disabled={saving}>
            {saving ? '' : ''}
          </Button>
        </BottomSheet>

        <BottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)}>
          <div style={sheetEyebrow}>COMMENTS</div>
          <div className="sheetTitle"></div>
          {activePost ? (
            <div style={commentHeroCard}>
              <div style={commentHeroTop}>
                <span style={activePost.boardType === 'notice' ? heroPeachPill : heroMintPill}>{activePost.boardType === 'notice' ? '' : ''}</span>
                <span style={heroNeutralPill}>{commentsLoading ? '' : `${comments.length}`}</span>
              </div>
              <div style={commentHeroTitle}>{activePost.title ?? ''}</div>
              <div style={commentHeroDesc}>{activePost.content}</div>
            </div>
          ) : null}

          <div className="stack10" />

          <div style={cardList}>
            {commentsLoading ? (
              <div className="glassSkeletonStack">
                <div className="glassSkeletonBlock" style={{ height: 88, borderRadius: 18 }} />
                <div className="glassSkeletonBlock" style={{ height: 88, borderRadius: 18 }} />
              </div>
            ) : comments.length === 0 ? (
              <div className="glassEmpty"></div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} style={commentCard}>
                  <div style={commentTop}>
                    <div style={commentAuthor}>{comment.authorName}</div>
                    <div style={commentTime}>{formatTime(comment.createdAt)}</div>
                  </div>
                  <div style={commentTextStyle}>{comment.content}</div>
                </div>
              ))
            )}
          </div>

          <div className="stack12" />

          <div style={commentEditorCard}>
            <div style={commentEditorTitle}></div>
            <div style={commentEditorDesc}></div>
            <div className="stack10" />
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="" className="glassTextarea" style={{ minHeight: 88 }} />
          </div>

          <div className="stack10" />

          <Button variant="primary" size="lg" wide onClick={submitComment} disabled={commentSaving}>
            {commentSaving ? '' : ''}
          </Button>
        </BottomSheet>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div style={sectionHeader}>
      <div style={sectionEyebrow}>{eyebrow}</div>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{desc}</div>
    </div>
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
    <div style={{ ...summaryTile, ...getToneCardStyle(tone) }}>
      <div style={summaryLabel}>{label}</div>
      <div style={summaryValue}>{value}</div>
      <div style={summarySub}>{subValue}</div>
    </div>
  );
}

function GaugeTabButton({
  label,
  title,
  hint,
  tone,
  active,
  onClick
}: {
  label: string;
  title: string;
  hint: string;
  tone: 'mint' | 'peach';
  active: boolean;
  onClick: () => void;
}) {
  const fill = tone === 'mint' ? 'linear-gradient(90deg, rgba(114,215,199,0.28), rgba(114,215,199,0.14))' : 'linear-gradient(90deg, rgba(243,180,156,0.28), rgba(243,180,156,0.14))';
  const border = tone === 'mint' ? 'rgba(114,215,199,0.26)' : 'rgba(243,180,156,0.26)';
  const badgeBg = tone === 'mint' ? 'rgba(114,215,199,0.18)' : 'rgba(243,180,156,0.18)';
  const badgeColor = tone === 'mint' ? '#2f7f73' : '#9d6550';
  const valueColor = tone === 'mint' ? '#245f56' : '#8d5a47';
  const percent = active ? 100 : 22;

  return (
    <button type="button" onClick={onClick} style={{ ...gaugeTabButton, border: `1px solid ${border}` }}>
      <div style={gaugeTrack}>
        <div style={{ ...gaugeFill, width: `${percent}`, background: fill }} />
      </div>
      <div style={gaugeContent}>
        <div style={gaugeTopRow}>
          <div style={gaugeLabel}>{label}</div>
          <div style={{ ...gaugeBadge, background: badgeBg, color: badgeColor }}>{active ? 'ON' : 'OFF'}</div>
        </div>
        <div style={{ ...gaugeValue, color: valueColor }}>{title}</div>
        <div style={gaugeHint}>{hint}</div>
      </div>
    </button>
  );
}

function MemberRow({
  member,
  canKick,
  kicking,
  onKick
}: {
  member: Member;
  canKick: boolean;
  kicking: boolean;
  onKick: () => void;
}) {
  return (
    <div style={memberCard}>
      <div style={memberTop}>
        <div>
          <div style={memberName}>{member.name}</div>
          <div style={memberMeta}>{formatTime(member.joinedAt)}</div>
        </div>
        <div style={memberPillRow}>
          <span style={member.role === 'OWNER' ? heroPeachPill : heroMintPill}>{member.role}</span>
          {member.isMe ? <span style={heroNeutralPill}></span> : null}
        </div>
      </div>

      {canKick ? (
        <div style={memberActionWrap}>
          <Button variant="danger" size="md" onClick={onKick} disabled={kicking}>
            {kicking ? '' : ''}
          </Button>
        </div>
      ) : null}
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

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="uiSheetBackdrop" onClick={onClose}>
      <div className="uiSheet" onClick={(e) => e.stopPropagation()}>
        <div className="uiSheetHandleWrap">
          <div className="uiSheetHandle" />
        </div>
        {children}
        <div className="stack10" />
        <Button variant="secondary" size="lg" wide onClick={onClose}>{''}</Button>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
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

const heroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
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
  fontSize: 27,
  fontWeight: 800,
  color: '#24313a',
  letterSpacing: '-0.02em',
  lineHeight: 1.18
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const roleChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.58)',
  border: '1px solid rgba(255,255,255,0.6)',
  color: '#5d6b73',
  fontSize: 12,
  fontWeight: 800
};

const heroPillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 14
};

const heroMintPill: CSSProperties = {
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

const heroPeachPill: CSSProperties = {
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

const heroSkyPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(223,243,250,0.9)',
  border: '1px solid rgba(191,229,243,0.8)',
  color: '#51727f',
  fontSize: 12,
  fontWeight: 800
};

const heroNeutralPill: CSSProperties = {
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

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const summaryTile: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)'
};

const summaryLabel: CSSProperties = {
  color: '#6c7881',
  fontSize: 12,
  fontWeight: 700
};

const summaryValue: CSSProperties = {
  marginTop: 8,
  color: '#24313a',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: '-0.03em'
};

const summarySub: CSSProperties = {
  marginTop: 8,
  color: '#6a7780',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 14
};

const joinCard: CSSProperties = {
  marginTop: 14,
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.72)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const joinTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const joinDesc: CSSProperties = {
  marginTop: 6,
  color: '#6d7881',
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

const tabGaugeGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const gaugeTabButton: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  minHeight: 112,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.62)',
  textAlign: 'left',
  cursor: 'pointer',
  padding: 0
};

const gaugeTrack: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden'
};

const gaugeFill: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '0%'
};

const gaugeContent: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '14px 14px 12px'
};

const gaugeTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const gaugeLabel: CSSProperties = {
  color: '#68757e',
  fontSize: 12,
  fontWeight: 800
};

const gaugeBadge: CSSProperties = {
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const gaugeValue: CSSProperties = {
  marginTop: 10,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: '-0.02em'
};

const gaugeHint: CSSProperties = {
  marginTop: 8,
  color: '#6b7780',
  fontSize: 12,
  lineHeight: 1.45
};

const cardList: CSSProperties = {
  display: 'grid',
  gap: 10
};

const memberCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const memberTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const memberName: CSSProperties = {
  color: '#24313a',
  fontSize: 17,
  fontWeight: 800
};

const memberMeta: CSSProperties = {
  marginTop: 6,
  color: '#6c7881',
  fontSize: 12,
  lineHeight: 1.45
};

const memberPillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap'
};

const memberActionWrap: CSSProperties = {
  marginTop: 12,
  display: 'flex',
  justifyContent: 'flex-end'
};

const listCardButton: CSSProperties = {
  width: '100%',
  padding: '14px 14px 12px',
  borderRadius: 20,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)',
  textAlign: 'left',
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

const rowBadgeMint: CSSProperties = {
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

const rowBadgePeach: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.24)',
  color: '#9d6550',
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

const postTime: CSSProperties = {
  color: '#7d8991',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
};

const listCardDesc: CSSProperties = {
  marginTop: 8,
  color: '#67747d',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const listCardMeta: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 10
};

const authorPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.72)',
  color: '#5d6b73',
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

const commentHeroCard: CSSProperties = {
  marginTop: 8,
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const commentHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const commentHeroTitle: CSSProperties = {
  marginTop: 10,
  color: '#24313a',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.25
};

const commentHeroDesc: CSSProperties = {
  marginTop: 8,
  color: '#67747d',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const commentCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const commentTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10
};

const commentAuthor: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800
};

const commentTime: CSSProperties = {
  color: '#7d8991',
  fontSize: 12,
  fontWeight: 700
};

const commentTextStyle: CSSProperties = {
  marginTop: 8,
  color: '#66737c',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const commentEditorCard: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.78)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const commentEditorTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const commentEditorDesc: CSSProperties = {
  marginTop: 6,
  color: '#6b7780',
  fontSize: 13,
  lineHeight: 1.5
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
