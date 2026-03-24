import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { apiFetch } from '../lib/api';
import Button from '../ui/Button';
import { Card, CardTitle, CardDesc } from '../ui/Card';

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
  const boardDesc =
    tab === 'notice'
      ? '예배와 모임, 공동체 전달사항을 차분하게 확인하는 보드입니다.'
      : '함께 기도할 제목과 응답을 이어서 나누는 보드입니다.';

  const heroDescription =
    channel?.description ?? '홈 화면과 같은 부드러운 톤으로 공지와 기도제목, 댓글 흐름을 한 화면에서 편하게 이어갈 수 있어요.';

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
        subValue: '바로 공유 가능',
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
        value: loading ? '...' : `${posts.length}개`,
        subValue: `${boardLabel} 보드 기준`,
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
      window.alert('등록 실패');
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!activePost) return;
    if (!commentText.trim()) return;

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
      window.alert('댓글 등록 실패');
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
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="교회 채널" backTo="/channels" hideAuthActions />

        <Card className="glassHeroCard">
          <div className="profileHero">
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>CHANNEL DETAIL</div>
              <CardTitle>{channel?.name ?? '교회 채널'}</CardTitle>
              <CardDesc>{heroDescription}</CardDesc>
            </div>

            <div style={rolePillStyle}>{channel?.myRole ?? '미가입'}</div>
          </div>

          <div className="stack12" />

          <div className="glassStatGrid">
            {summaryItems.map((item) => (
              <SummaryTile key={item.label} label={item.label} value={item.value} subValue={item.subValue} tone={item.tone} />
            ))}
          </div>

          <div className="stack12" />

          <div style={heroPillRowStyle}>
            <span style={heroMintPillStyle}>{isMember ? '채널 참여 중' : '가입 후 글쓰기 가능'}</span>
            <span style={tab === 'notice' ? heroPeachPillStyle : heroSkyPillStyle}>{boardLabel} 게시판</span>
            <span style={heroNeutralPillStyle}>목록 카드와 규격 통일</span>
          </div>

          <div className="stack12" />

          <div style={heroActionGridStyle}>
            <Button variant="primary" size="lg" wide onClick={openComposerForCurrentTab}>
              {boardLabel} 글 작성하기
            </Button>
            <Button variant="secondary" size="lg" wide onClick={loadAll}>
              새로고침
            </Button>
          </div>

          {!isMember && channel ? (
            <>
              <div className="stack12" />
              <div style={joinBoxStyle}>
                <div style={joinTitleStyle}>초대코드로 채널 가입</div>
                <div style={joinDescStyle}>가입 후에는 공지와 기도제목 작성, 댓글 참여까지 한 흐름으로 이어집니다.</div>
                <div className="stack10" />
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="예) ABC123"
                  className="glassInput"
                />
                <div className="stack10" />
                <Button variant="primary" size="lg" wide onClick={submitJoin}>
                  가입하기
                </Button>
              </div>
            </>
          ) : null}
        </Card>

        <div className="stack12" />

        {err ? <div className="uiErrorBox">{err}</div> : null}

        <Card className="glassHeroCard">
          <div className="sectionHeadRow">
            <div>
              <div style={sectionEyebrowStyle}>BOARD GUIDE</div>
              <CardTitle>{boardLabel} 게시판</CardTitle>
              <CardDesc>{boardDesc}</CardDesc>
            </div>
          </div>

          <div className="stack12" />

          <div style={infoGridStyle}>
            <InfoCard tone="peach" title="공지" desc="예배와 모임 일정, 전달사항을 한눈에 확인하는 공간이에요." />
            <InfoCard tone="mint" title="기도" desc="중보기도 제목과 응답을 이어서 나누며 공동체 흐름을 살려요." />
          </div>

          <div className="stack12" />

          <div style={tabGaugeGridStyle}>
            <GaugeTabButton
              label="공지"
              title="공지 보드"
              hint="예배 · 모임 · 전달사항"
              tone="peach"
              active={tab === 'notice'}
              onClick={() => setTab('notice')}
            />
            <GaugeTabButton
              label="기도"
              title="기도 보드"
              hint="기도제목 · 응답 · 댓글"
              tone="mint"
              active={tab === 'prayer'}
              onClick={() => setTab('prayer')}
            />
          </div>

          <div className="stack12" />

          <Button variant="ghost" size="md" wide onClick={openComposerForCurrentTab}>
            새 글 작성
          </Button>
        </Card>

        <div className="stack12" />

        <Card className="glassHeroCard">
          <div className="sectionHeadRow">
            <div>
              <div style={sectionEyebrowStyle}>POSTS</div>
              <CardTitle>게시글 목록</CardTitle>
              <CardDesc>{loading ? '게시글을 불러오는 중이에요.' : `${posts.length}개의 ${boardLabel} 글을 확인할 수 있어요.`}</CardDesc>
            </div>
          </div>

          <div className="stack12" />

          <div style={cardListStyle}>
            {loading ? (
              <div className="glassSkeletonStack">
                <SkeletonPost />
                <SkeletonPost />
                <SkeletonPost />
              </div>
            ) : posts.length === 0 ? (
              <div className="glassEmpty">아직 게시글이 없습니다. 첫 번째 {boardLabel} 글을 남겨보세요.</div>
            ) : (
              posts.map((post) => (
                <button key={post.id} type="button" style={listCardButtonStyle} onClick={() => openComments(post)}>
                  <div style={listCardTopStyle}>
                    <div style={listCardTitleWrapStyle}>
                      <div style={post.boardType === 'notice' ? listCardBadgePeachStyle : listCardBadgeMintStyle}>
                        {post.boardType === 'notice' ? '공지' : '기도'}
                      </div>
                      <div style={listCardTitleStyle}>{post.title || (post.boardType === 'notice' ? '공지 제목' : '기도제목')}</div>
                    </div>
                    <div style={postTimeStyle}>{formatTime(post.createdAt)}</div>
                  </div>

                  <div style={listCardDescStyle}>{post.content}</div>

                  <div style={listCardMetaStyle}>
                    <span style={authorPillStyle}>{post.authorName}</span>
                    <span style={metaPillNeutralStyle}>댓글 보기 ›</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)}>
          <div style={sheetEyebrowStyle}>{tab === 'notice' ? 'NOTICE POST' : 'PRAYER POST'}</div>
          <div className="sheetTitle">새 글 작성</div>
          <div style={sheetDescStyle}>홈과 같은 차분한 톤으로 공지나 기도제목을 남겨보세요.</div>
          <div className="stack10" />

          <Field label="제목(선택)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" className="glassInput" />
          </Field>

          <div className="stack10" />

          <Field label="내용">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용을 입력하세요" className="glassTextarea" />
          </Field>

          <div className="stack10" />

          <Button variant="primary" size="lg" wide onClick={submitPost} disabled={saving}>
            {saving ? '등록 중…' : '등록'}
          </Button>
        </BottomSheet>

        <BottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)}>
          <div style={sheetEyebrowStyle}>COMMENTS</div>
          <div className="sheetTitle">댓글 나눔</div>
          {activePost ? (
            <div style={commentHeroCardStyle}>
              <div style={commentHeroTopStyle}>
                <span style={activePost.boardType === 'notice' ? heroPeachPillStyle : heroMintPillStyle}>
                  {activePost.boardType === 'notice' ? '공지' : '기도'}
                </span>
                <span style={heroNeutralPillStyle}>{commentsLoading ? '불러오는 중' : `${comments.length}개 댓글`}</span>
              </div>
              <div style={commentHeroTitleStyle}>{activePost.title ?? '댓글'}</div>
              <div style={commentHeroDescStyle}>{activePost.content}</div>
            </div>
          ) : null}

          <div className="stack10" />

          <div style={cardListStyle}>
            {commentsLoading ? (
              <>
                <CommentSkeleton />
                <CommentSkeleton />
              </>
            ) : comments.length === 0 ? (
              <div className="glassEmpty">아직 댓글이 없습니다. 첫 번째 댓글로 마음을 나눠보세요.</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} style={commentCardStyle}>
                  <div style={commentTopStyle}>
                    <div style={commentAuthorStyle}>{comment.authorName}</div>
                    <div style={commentTimeStyle}>{formatTime(comment.createdAt)}</div>
                  </div>
                  <div style={commentTextStyle}>{comment.content}</div>
                </div>
              ))
            )}
          </div>

          <div className="stack12" />

          <div style={commentEditorCardStyle}>
            <div style={commentEditorTitleStyle}>댓글 입력</div>
            <div style={commentEditorDescStyle}>짧게 공감이나 기도 응답을 남겨보세요.</div>
            <div className="stack10" />
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요"
              className="glassTextarea"
              style={{ minHeight: 88 }}
            />
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

function InfoCard({ tone, title, desc }: { tone: Tone; title: string; desc: string }) {
  return (
    <div style={{ ...infoCardStyle, ...getToneCardStyle(tone) }}>
      <div style={infoTitleStyle}>{title}</div>
      <div style={infoDescStyle}>{desc}</div>
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
    <button type="button" onClick={onClick} style={{ ...gaugeTabButtonStyle, border: `1px solid ${border}` }}>
      <div style={gaugeTrackStyle}>
        <div style={{ ...gaugeFillStyle, width: `${percent}%`, background: fill }} />
      </div>
      <div style={gaugeContentStyle}>
        <div style={gaugeTopRowStyle}>
          <div style={gaugeLabelStyle}>{label}</div>
          <div style={{ ...gaugeBadgeStyle, background: badgeBg, color: badgeColor }}>{active ? 'ON' : 'OFF'}</div>
        </div>
        <div style={{ ...gaugeValueStyle, color: valueColor }}>{title}</div>
        <div style={gaugeHintStyle}>{hint}</div>
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

function SkeletonPost() {
  return <div className="glassSkeletonBlock" style={{ height: 138 }} />;
}

function CommentSkeleton() {
  return <div className="glassSkeletonBlock" style={{ height: 102, borderRadius: 22 }} />;
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
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

const rolePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.52)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#4dbdaa',
  fontSize: 12,
  fontWeight: 800
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

const heroSkyPillStyle: CSSProperties = {
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

const joinBoxStyle: CSSProperties = {
  padding: '14px 14px 12px',
  borderRadius: 18,
  background: 'rgba(248,250,251,0.72)',
  border: '1px solid rgba(227,233,237,0.92)'
};

const joinTitleStyle: CSSProperties = {
  color: '#24313a',
  fontSize: 16,
  fontWeight: 800
};

const joinDescStyle: CSSProperties = {
  marginTop: 6,
  color: '#6d7881',
  fontSize: 13,
  lineHeight: 1.55
};

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#83a39a'
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const infoCardStyle: CSSProperties = {
  minWidth: 0,
  padding: '14px 14px 12px',
  borderRadius: 18,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38)'
};

const infoTitleStyle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800
};

const infoDescStyle: CSSProperties = {
  marginTop: 6,
  color: '#617078',
  fontSize: 13,
  lineHeight: 1.55
};

const tabGaugeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10
};

const gaugeTabButtonStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textAlign: 'left',
  width: '100%',
  minHeight: 116,
  padding: 16,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  cursor: 'pointer'
};

const gaugeTrackStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none'
};

const gaugeFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 22,
  transition: 'width 180ms ease'
};

const gaugeContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1
};

const gaugeTopRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const gaugeLabelStyle: CSSProperties = {
  color: '#617078',
  fontSize: 12,
  fontWeight: 800
};

const gaugeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800
};

const gaugeValueStyle: CSSProperties = {
  marginTop: 12,
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.25,
  letterSpacing: '-0.02em'
};

const gaugeHintStyle: CSSProperties = {
  marginTop: 8,
  color: '#68757e',
  fontSize: 13,
  lineHeight: 1.5
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

const listCardBadgeMintStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  color: '#2f7f73',
  fontSize: 11,
  fontWeight: 800
};

const listCardBadgePeachStyle: CSSProperties = {
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

const postTimeStyle: CSSProperties = {
  color: '#8a959d',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap'
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

const commentHeroCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const commentHeroTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const commentHeroTitleStyle: CSSProperties = {
  marginTop: 12,
  color: '#24313a',
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-0.02em'
};

const commentHeroDescStyle: CSSProperties = {
  marginTop: 10,
  color: '#53626b',
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
};

const commentCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const commentTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
};

const commentAuthorStyle: CSSProperties = {
  color: '#24313a',
  fontSize: 13,
  fontWeight: 800
};

const commentTimeStyle: CSSProperties = {
  color: '#8a959d',
  fontSize: 12,
  fontWeight: 700
};

const commentTextStyle: CSSProperties = {
  marginTop: 8,
  color: '#54616a',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap'
};

const commentEditorCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.66))',
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const commentEditorTitleStyle: CSSProperties = {
  color: '#24313a',
  fontSize: 15,
  fontWeight: 800
};

const commentEditorDescStyle: CSSProperties = {
  marginTop: 6,
  color: '#6d7881',
  fontSize: 13,
  lineHeight: 1.55
};
