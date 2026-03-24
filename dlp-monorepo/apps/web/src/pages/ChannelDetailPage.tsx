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
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [joinCode, setJoinCode] = useState('');
  const isMember = !!channel?.myRole;

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

  const boardLabel = tab === 'notice' ? '공지' : '기도';
  const boardDesc = tab === 'notice' ? '예배와 모임, 전달사항을 확인하는 보드입니다.' : '기도제목과 응답을 나누는 보드입니다.';

  const summaryItems = useMemo(
    () => [
      {
        label: '참여 상태',
        value: isMember ? '참여 중' : '미가입',
        subValue: isMember ? channel?.myRole ?? '멤버' : '가입 후 작성 가능',
        tone: 'mint' as Tone
      },
      {
        label: '초대 코드',
        value: channel?.inviteCode ?? '-',
        subValue: '공유용 코드',
        tone: 'sky' as Tone
      },
      {
        label: '현재 보드',
        value: boardLabel,
        subValue: tab === 'notice' ? '전달 중심' : '나눔 중심',
        tone: tab === 'notice' ? ('peach' as Tone) : ('mint' as Tone)
      },
      {
        label: '게시글 수',
        value: loading ? '…' : `${posts.length}개`,
        subValue: `${boardLabel} 기준`,
        tone: 'neutral' as Tone
      }
    ],
    [boardLabel, channel?.inviteCode, channel?.myRole, isMember, loading, posts.length, tab]
  );

  function goLogin() {
    const next = `${loc.pathname}${loc.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  async function loadChannel() {
    if (!id) return;

    const res = await apiFetch(`/api/channels/${id}`);
    if (res.status === 401) {
      goLogin();
      return;
    }
    if (!res.ok) throw new Error('채널 정보를 불러오지 못했습니다.');
    setChannel(await res.json());
  }

  async function loadPosts() {
    if (!id) return;

    const res = await apiFetch(`/api/channels/${id}/posts?board=${tab}`);
    if (res.status === 401) {
      goLogin();
      return;
    }
    if (!res.ok) throw new Error('게시글을 불러오지 못했습니다.');
    setPosts(await res.json());
  }

  async function loadAll() {
    setErr(null);
    setLoading(true);
    try {
      await Promise.all([loadChannel(), loadPosts()]);
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
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

  async function submitJoin() {
    if (!channel) return;

    const res = await apiFetch(`/api/channels/${channel.id}/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteCode: joinCode.trim() })
    });

    if (res.status === 401) {
      goLogin();
      return;
    }

    if (!res.ok) {
      window.alert('가입 실패: 초대코드를 확인하세요.');
      return;
    }

    setJoinCode('');
    await loadAll();
    window.alert('채널에 가입되었습니다.');
  }

  async function submitPost() {
    if (!id) return;
    if (!content.trim()) {
      window.alert('내용을 입력하세요.');
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
      window.alert('등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!activePost) return;
    if (!commentText.trim()) {
      window.alert('댓글을 입력하세요.');
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
      window.alert('댓글 등록에 실패했습니다.');
    } finally {
      setCommentSaving(false);
    }
  }

  function openComposerForCurrentTab() {
    if (!isMember) {
      window.alert('먼저 채널에 가입하세요.');
      return;
    }
    setComposerOpen(true);
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="교회 채널" backTo="/channels" hideAuthActions />

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={heroCopy}>
              <div style={badgeMint}>CHANNEL DETAIL</div>
              <div style={heroTitle}>{channel?.name ?? '교회 채널'}</div>
              <div style={heroDesc}>{channel?.description ?? '홈 기준 폭과 카드 밀도로 다시 맞추고, 채널 전용 배경 없이 공지·기도·댓글 흐름을 정리했습니다.'}</div>
            </div>
            <div style={roleChip}>{channel?.myRole ?? '미가입'}</div>
          </div>

          <div style={heroPillRow}>
            <span style={heroMintPill}>{isMember ? '채널 참여 중' : '가입 후 글쓰기 가능'}</span>
            <span style={tab === 'notice' ? heroPeachPill : heroSkyPill}>{boardLabel} 게시판</span>
          </div>

          <div style={summaryGrid}>
            {summaryItems.map((item) => (
              <SummaryTile key={item.label} label={item.label} value={item.value} subValue={item.subValue} tone={item.tone} />
            ))}
          </div>

          <div style={actionGrid}>
            <Button variant="primary" size="md" onClick={openComposerForCurrentTab}>
              {boardLabel} 글 작성
            </Button>
            <Button variant="secondary" size="md" onClick={loadAll}>
              새로고침
            </Button>
          </div>

          {!isMember && channel ? (
            <div style={joinCard}>
              <div style={joinTitle}>초대코드로 채널 가입</div>
              <div style={joinDesc}>가입 후 공지 작성, 기도제목 나눔, 댓글 참여가 가능합니다.</div>
              <div className="stack10" />
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="예) ABC123" className="glassInput" />
              <div className="stack10" />
              <Button variant="primary" size="lg" wide onClick={submitJoin}>
                가입하기
              </Button>
            </div>
          ) : null}
        </Card>

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="BOARD" title={`${boardLabel} 게시판`} desc={boardDesc} />

          <div style={tabGaugeGrid}>
            <GaugeTabButton label="공지" title="공지 보드" hint="예배 · 모임 · 전달사항" tone="peach" active={tab === 'notice'} onClick={() => setTab('notice')} />
            <GaugeTabButton label="기도" title="기도 보드" hint="기도제목 · 응답 · 댓글" tone="mint" active={tab === 'prayer'} onClick={() => setTab('prayer')} />
          </div>
        </Card>

        <Card pad style={sectionCard}>
          <SectionHeader eyebrow="POSTS" title="게시글 목록" desc={loading ? '게시글을 불러오는 중이에요.' : `${posts.length}개의 ${boardLabel} 글을 확인할 수 있어요.`} />

          <div style={cardList}>
            {loading ? (
              <div className="glassSkeletonStack">
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
                <div className="glassSkeletonBlock" style={{ height: 118, borderRadius: 22 }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="glassEmpty">아직 게시글이 없습니다. 첫 번째 {boardLabel} 글을 남겨보세요.</div>
            ) : (
              posts.map((post) => (
                <button key={post.id} type="button" style={listCardButton} onClick={() => openComments(post)}>
                  <div style={listCardTop}>
                    <div style={listCardTitleWrap}>
                      <div style={post.boardType === 'notice' ? rowBadgePeach : rowBadgeMint}>{post.boardType === 'notice' ? '공지' : '기도'}</div>
                      <div style={listCardTitle}>{post.title || (post.boardType === 'notice' ? '공지 제목' : '기도제목')}</div>
                    </div>
                    <div style={postTime}>{formatTime(post.createdAt)}</div>
                  </div>

                  <div style={listCardDesc}>{post.content}</div>

                  <div style={listCardMeta}>
                    <span style={authorPill}>{post.authorName}</span>
                    <span style={metaPillNeutral}>댓글 보기 ›</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)}>
          <div style={sheetEyebrow}>{tab === 'notice' ? 'NOTICE POST' : 'PRAYER POST'}</div>
          <div className="sheetTitle">새 글 작성</div>
          <div style={sheetDesc}>홈 시트 톤과 같은 밀도로 공지나 기도제목을 남길 수 있습니다.</div>
          <div className="stack10" />

          <Field label="제목(선택)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="내용">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요" className="glassTextarea" style={{ minHeight: 100 }} />
          </Field>

          <div className="stack12" />

          <Button variant="primary" size="lg" wide onClick={submitPost} disabled={saving}>
            {saving ? '등록 중…' : '등록'}
          </Button>
        </BottomSheet>

        <BottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)}>
          <div style={sheetEyebrow}>COMMENTS</div>
          <div className="sheetTitle">댓글 나눔</div>
          {activePost ? (
            <div style={commentHeroCard}>
              <div style={commentHeroTop}>
                <span style={activePost.boardType === 'notice' ? heroPeachPill : heroMintPill}>{activePost.boardType === 'notice' ? '공지' : '기도'}</span>
                <span style={heroNeutralPill}>{commentsLoading ? '불러오는 중' : `${comments.length}개 댓글`}</span>
              </div>
              <div style={commentHeroTitle}>{activePost.title ?? '댓글'}</div>
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
              <div className="glassEmpty">아직 댓글이 없습니다. 첫 번째 댓글로 마음을 나눠보세요.</div>
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
            <div style={commentEditorTitle}>댓글 입력</div>
            <div style={commentEditorDesc}>짧게 공감이나 기도 응답을 남겨보세요.</div>
            <div className="stack10" />
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="댓글을 입력하세요" className="glassTextarea" style={{ minHeight: 88 }} />
          </div>

          <div className="stack10" />

          <Button variant="primary" size="lg" wide onClick={submitComment} disabled={commentSaving}>
            {commentSaving ? '등록 중…' : '댓글 등록'}
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
        <div style={{ ...gaugeFill, width: `${percent}%`, background: fill }} />
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
        <Button variant="secondary" wide onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  color: '#6f7c85',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45
};

const cardList: CSSProperties = {
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

const rowBadgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.14)',
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

const postTime: CSSProperties = {
  color: '#91a0a8',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
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

const authorPill: CSSProperties = {
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

const commentHeroCard: CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.56)'
};

const commentHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap'
};

const commentHeroTitle: CSSProperties = {
  marginTop: 10,
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.35
};

const commentHeroDesc: CSSProperties = {
  marginTop: 8,
  color: '#5d6b73',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const commentCard: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.56)',
  background: 'rgba(255,255,255,0.56)'
};

const commentTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const commentAuthor: CSSProperties = {
  color: '#24313a',
  fontSize: 13,
  fontWeight: 800
};

const commentTime: CSSProperties = {
  color: '#92a0a8',
  fontSize: 12,
  fontWeight: 700
};

const commentTextStyle: CSSProperties = {
  marginTop: 8,
  color: '#55636b',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const commentEditorCard: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: 'rgba(248,250,251,0.72)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const commentEditorTitle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800
};

const commentEditorDesc: CSSProperties = {
  marginTop: 6,
  color: '#6d7881',
  fontSize: 13,
  lineHeight: 1.55
};
