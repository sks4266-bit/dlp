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

  const pageTitle = useMemo(() => channel?.name ?? '채널', [channel?.name]);

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
      await loadChannel();
      await loadPosts();
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

  async function openComments(p: Post) {
    setActivePost(p);
    setComments([]);
    setCommentsOpen(true);
    setCommentsLoading(true);

    try {
      const res = await apiFetch(`/api/channels/posts/${p.id}/comments`);
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
      alert('가입 실패: 초대코드를 확인하세요.');
      return;
    }

    setJoinCode('');
    await loadAll();
    alert('가입되었습니다.');
  }

  async function submitPost() {
    if (!id) return;
    if (!content.trim()) {
      alert('내용을 입력하세요.');
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
      alert('등록 실패');
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
      alert('댓글 등록 실패');
    } finally {
      setCommentSaving(false);
    }
  }

  return (
    <div style={page}>
      <TopBar
        title={pageTitle}
        backTo="/channels"
        right={
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => (isMember ? setComposerOpen(true) : alert('먼저 채널에 가입하세요.'))}
          >
            + 글쓰기
          </Button>
        }
      />

      <main style={wrap}>
        <section style={hero}>
          <div style={heroBadge}>CHANNEL ROOM</div>
          <h1 style={heroTitle}>{channel?.name ?? '채널 공간'}</h1>
          <p style={heroDesc}>
            공지와 기도 나눔을 또렷하게 읽을 수 있도록
            <br />
            큰 카드, 부드러운 탭, 반투명 시트 구조로 정리했습니다.
          </p>
        </section>

        {err ? <div style={errorBox}>{err}</div> : null}

        <Card pad style={heroCard}>
          <div style={heroTop}>
            <div style={{ minWidth: 0 }}>
              <CardTitle style={cardTitle}>{channel?.name ?? '채널'}</CardTitle>
              <CardDesc style={cardDesc}>
                {channel?.description ?? '설명이 아직 등록되지 않았습니다.'}
              </CardDesc>
            </div>

            <div style={chipWrap}>
              <MetaChip label="초대코드" value={channel?.inviteCode ?? '-'} tint="mint" />
              <MetaChip label="내 역할" value={channel?.myRole ?? '미가입'} tint="peach" />
            </div>
          </div>

          {!isMember && channel ? (
            <div style={joinBox}>
              <div style={joinTitle}>초대코드로 가입</div>
              <div style={joinDesc}>
                가입 후에 공지와 기도 게시글을 작성하고 댓글도 남길 수 있습니다.
              </div>

              <div style={joinRow}>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="예) ABC123"
                  style={input}
                />
                <div style={joinBtnWrap}>
                  <Button type="button" variant="primary" size="lg" wide onClick={submitJoin}>
                    가입
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <div style={{ height: 16 }} />

        <div style={tabRow}>
          <div style={tabWrap}>
            <button
              type="button"
              style={tab === 'notice' ? activeTabBtn : tabBtn}
              onClick={() => setTab('notice')}
            >
              공지
            </button>
            <button
              type="button"
              style={tab === 'prayer' ? activeTabBtn : tabBtn}
              onClick={() => setTab('prayer')}
            >
              기도
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => (isMember ? setComposerOpen(true) : alert('먼저 채널에 가입하세요.'))}
          >
            새 글 작성
          </Button>
        </div>

        <div style={{ height: 12 }} />

        <div style={postList}>
          {loading ? (
            <>
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </>
          ) : posts.length === 0 ? (
            <Card pad style={emptyCard}>
              <div style={emptyTitle}>아직 게시글이 없어요</div>
              <div style={emptyText}>
                첫 번째 공지나 기도제목을 등록해서 채널 흐름을 시작해 보세요.
              </div>
            </Card>
          ) : (
            posts.map((p) => (
              <button key={p.id} type="button" style={postCard} onClick={() => openComments(p)}>
                <div style={postTop}>
                  <div style={postTitle}>
                    {p.title || (tab === 'notice' ? '공지' : '기도제목')}
                  </div>
                  <div style={postTime}>{formatTime(p.createdAt)}</div>
                </div>

                <div style={postContent}>{p.content}</div>

                <div style={postBottom}>
                  <span style={authorPill}>{p.authorName}</span>
                  <span style={readMore}>댓글 보기 ›</span>
                </div>
              </button>
            ))
          )}
        </div>
      </main>

      <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)}>
        <div style={sheetHeader}>
          <div style={sheetEyebrow}>{tab === 'notice' ? 'NOTICE POST' : 'PRAYER POST'}</div>
          <div style={sheetTitle}>새 글 작성</div>
          <div style={sheetDesc}>차분한 카드 레이아웃에 맞춰 공지나 기도제목을 남겨보세요.</div>
        </div>

        <div style={sheetBody}>
          <Field label="제목(선택)">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              style={input}
            />
          </Field>

          <Field label="내용">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              style={textarea}
            />
          </Field>

          <div style={actionGrid}>
            <Button type="button" variant="primary" size="lg" wide onClick={submitPost} disabled={saving}>
              {saving ? '등록 중…' : '등록'}
            </Button>
            <Button type="button" variant="secondary" size="md" wide onClick={() => setComposerOpen(false)}>
              닫기
            </Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)}>
        <div style={sheetHeader}>
          <div style={sheetEyebrow}>COMMENTS</div>
          <div style={sheetTitle}>{activePost?.title ?? '댓글'}</div>
          {activePost ? <div style={sheetDesc}>{activePost.content}</div> : null}
        </div>

        <div style={commentList}>
          {commentsLoading ? (
            <>
              <CommentSkeleton />
              <CommentSkeleton />
            </>
          ) : comments.length === 0 ? (
            <div style={emptyInline}>댓글이 없습니다.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={commentCard}>
                <div style={commentTop}>
                  <div style={commentAuthor}>{c.authorName}</div>
                  <div style={commentTime}>{formatTime(c.createdAt)}</div>
                </div>
                <div style={commentTextStyle}>{c.content}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 12 }} />

        <Field label="댓글 입력">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력하세요"
            style={{ ...textarea, minHeight: 88 }}
          />
        </Field>

        <div style={actionGrid}>
          <Button
            type="button"
            variant="primary"
            size="lg"
            wide
            onClick={submitComment}
            disabled={commentSaving}
          >
            {commentSaving ? '등록 중…' : '댓글 등록'}
          </Button>
          <Button type="button" variant="secondary" size="md" wide onClick={() => setCommentsOpen(false)}>
            닫기
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function MetaChip({
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
        ...metaCard,
        background:
          tint === 'mint' ? 'rgba(114,215,199,0.16)' : 'rgba(243,180,156,0.16)',
        borderColor:
          tint === 'mint' ? 'rgba(114,215,199,0.24)' : 'rgba(243,180,156,0.24)'
      }}
    >
      <div style={metaLabel}>{label}</div>
      <div style={metaValue}>{value}</div>
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

function SkeletonPost() {
  return (
    <div style={skeletonCard}>
      <div style={skeletonLineLg} />
      <div style={skeletonLineMd} />
      <div style={skeletonLineMd2} />
      <div style={skeletonLineSm} />
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div style={commentSkeleton}>
      <div style={commentSkeletonLg} />
      <div style={commentSkeletonMd} />
    </div>
  );
}

function BottomSheet({
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

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(
    2,
    '0'
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  fontSize: 30,
  lineHeight: 1.14,
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

const heroCard: CSSProperties = {
  borderRadius: 28,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 20px 42px rgba(77,90,110,0.10)',
  backdropFilter: 'blur(16px)'
};

const heroTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};

const cardTitle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: '#24313a'
};

const cardDesc: CSSProperties = {
  marginTop: 6,
  color: '#6c7780',
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 420
};

const chipWrap: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap'
};

const metaCard: CSSProperties = {
  minWidth: 112,
  padding: '12px 14px',
  borderRadius: 18,
  border: '1px solid transparent'
};

const metaLabel: CSSProperties = {
  fontSize: 11,
  color: '#68757e',
  fontWeight: 800
};

const metaValue: CSSProperties = {
  marginTop: 6,
  fontSize: 16,
  lineHeight: 1.2,
  fontWeight: 800,
  color: '#24313a'
};

const joinBox: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 22,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(222,230,235,0.95)'
};

const joinTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a'
};

const joinDesc: CSSProperties = {
  marginTop: 6,
  color: '#64727b',
  fontSize: 14,
  lineHeight: 1.6
};

const joinRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 10,
  marginTop: 14,
  alignItems: 'center'
};

const joinBtnWrap: CSSProperties = {
  minWidth: 120
};

const tabRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const tabWrap: CSSProperties = {
  display: 'inline-flex',
  padding: 4,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.62)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 10px 24px rgba(77,90,110,0.08)'
};

const tabBtn: CSSProperties = {
  height: 42,
  padding: '0 18px',
  borderRadius: 14,
  border: 'none',
  background: 'transparent',
  color: '#617078',
  fontSize: 14,
  fontWeight: 800
};

const activeTabBtn: CSSProperties = {
  ...tabBtn,
  background: 'linear-gradient(180deg, #7bdccf 0%, #5acbb8 100%)',
  color: '#143936',
  boxShadow: '0 8px 18px rgba(90,203,184,0.22)'
};

const postList: CSSProperties = {
  display: 'grid',
  gap: 12
};

const postCard: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'rgba(255,255,255,0.70)',
  boxShadow: '0 14px 32px rgba(77,90,110,0.08)',
  backdropFilter: 'blur(14px)'
};

const postTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12
};

const postTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a'
};

const postTime: CSSProperties = {
  fontSize: 12,
  color: '#88939a',
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const postContent: CSSProperties = {
  marginTop: 10,
  color: '#4f5f68',
  fontSize: 14,
  lineHeight: 1.72,
  whiteSpace: 'pre-wrap'
};

const postBottom: CSSProperties = {
  marginTop: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap'
};

const authorPill: CSSProperties = {
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

const readMore: CSSProperties = {
  color: '#8ca29c',
  fontSize: 13,
  fontWeight: 800
};

const emptyCard: CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.62)',
  border: '1px dashed rgba(180,191,198,0.8)'
};

const emptyTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#24313a'
};

const emptyText: CSSProperties = {
  marginTop: 8,
  color: '#78848c',
  fontSize: 14,
  lineHeight: 1.6
};

const skeletonCard: CSSProperties = {
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.62)',
  background: 'rgba(255,255,255,0.62)'
};

const skeletonLineLg: CSSProperties = {
  width: '54%',
  height: 18,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.55)'
};

const skeletonLineMd: CSSProperties = {
  width: '84%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.42)',
  marginTop: 12
};

const skeletonLineMd2: CSSProperties = {
  width: '72%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.36)',
  marginTop: 10
};

const skeletonLineSm: CSSProperties = {
  width: '30%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.30)',
  marginTop: 14
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

const sheetDesc: CSSProperties = {
  marginTop: 8,
  color: '#6b7780',
  fontSize: 14,
  lineHeight: 1.62,
  whiteSpace: 'pre-wrap'
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

const textarea: CSSProperties = {
  width: '100%',
  minHeight: 132,
  resize: 'vertical',
  borderRadius: 18,
  border: '1px solid rgba(202,212,220,0.9)',
  background: 'rgba(255,255,255,0.82)',
  padding: 14,
  fontSize: 14,
  lineHeight: 1.65,
  color: '#24313a',
  outline: 'none'
};

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 4
};

const commentList: CSSProperties = {
  display: 'grid',
  gap: 10,
  maxHeight: 260,
  overflow: 'auto',
  paddingRight: 2
};

const commentCard: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(226,233,237,0.95)',
  background: 'rgba(247,250,251,0.82)'
};

const commentTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap'
};

const commentAuthor: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#24313a'
};

const commentTime: CSSProperties = {
  fontSize: 12,
  color: '#8a959d',
  fontWeight: 700
};

const commentTextStyle: CSSProperties = {
  marginTop: 8,
  color: '#526069',
  fontSize: 14,
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap'
};

const emptyInline: CSSProperties = {
  padding: '14px 2px',
  color: '#78848c',
  fontSize: 14,
  lineHeight: 1.6
};

const commentSkeleton: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(226,233,237,0.95)',
  background: 'rgba(247,250,251,0.82)'
};

const commentSkeletonLg: CSSProperties = {
  width: '36%',
  height: 14,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.45)'
};

const commentSkeletonMd: CSSProperties = {
  width: '72%',
  height: 12,
  borderRadius: 999,
  background: 'rgba(200,210,216,0.34)',
  marginTop: 10
};
