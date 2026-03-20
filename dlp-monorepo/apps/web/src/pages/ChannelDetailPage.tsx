import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

type Channel = { id: string; name: string; description: string | null; inviteCode: string; myRole: string | null };

type Post = { id: string; boardType: string; title: string | null; content: string; authorName: string; createdAt: number };

type Comment = { id: string; content: string; authorName: string; createdAt: number };

export default function ChannelDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, loading: authLoading } = useAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [tab, setTab] = useState<'notice' | 'prayer'>('notice');
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const isMember = !!channel?.myRole;

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const pageTitle = useMemo(() => channel?.name ?? '채널', [channel?.name]);

  async function loadChannel() {
    if (!id) return;
    const res = await apiFetch(`/api/channels/${id}`);
    if (res.status === 401) {
      nav('/login');
      return;
    }
    if (!res.ok) throw new Error('LOAD_CHANNEL_FAILED');
    setChannel(await res.json());
  }

  async function loadPosts() {
    if (!id) return;
    const res = await apiFetch(`/api/channels/${id}/posts?board=${tab}`);
    if (!res.ok) throw new Error('LOAD_POSTS_FAILED');
    setPosts(await res.json());
  }

  async function loadAll() {
    setErr(null);
    try {
      await loadChannel();
      await loadPosts();
    } catch (e: any) {
      setErr(e?.message ?? '불러오기에 실패했습니다.');
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      nav('/login');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, me, tab]);

  async function openComments(p: Post) {
    setActivePost(p);
    setCommentsOpen(true);
    const res = await apiFetch(`/api/channels/posts/${p.id}/comments`);
    if (res.ok) setComments(await res.json());
  }

  return (
    <div>
      <TopBar title={pageTitle} backTo="/channels" />

      {err && <div style={errorBox}>{err}</div>}

      {channel && (
        <section style={card}>
          <div style={{ fontWeight: 950 }}>{channel.name}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{channel.description ?? '설명 없음'}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={pill}>초대코드: {channel.inviteCode}</span>
            <span style={pill}>내 역할: {channel.myRole ?? '미가입'}</span>
          </div>

          {!isMember && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>초대코드로 가입</div>
              <div style={{ height: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="예) ABC123" style={input} />
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={async () => {
                    const res = await apiFetch(`/api/channels/${channel.id}/join`, { method: 'POST', body: JSON.stringify({ inviteCode: joinCode.trim() }) });
                    if (!res.ok) {
                      alert('가입 실패: 초대코드를 확인하세요.');
                      return;
                    }
                    setJoinCode('');
                    await loadAll();
                    alert('가입되었습니다.');
                  }}
                >
                  가입
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div style={{ height: 12 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={{ ...tabBtn, background: tab === 'notice' ? 'black' : 'var(--primary-text)', color: tab === 'notice' ? 'var(--primary-text)' : 'black' }} onClick={() => setTab('notice')}>
          공지
        </button>
        <button type="button" style={{ ...tabBtn, background: tab === 'prayer' ? 'black' : 'var(--primary-text)', color: tab === 'prayer' ? 'var(--primary-text)' : 'black' }} onClick={() => setTab('prayer')}>
          기도
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" style={ghostBtn} onClick={() => (isMember ? setComposerOpen(true) : alert('먼저 채널에 가입하세요.'))}>
          + 글쓰기
        </button>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.length === 0 ? (
          <div style={{ padding: 14, borderRadius: 14, border: '1px dashed rgba(0,0,0,0.2)', color: 'var(--muted)' }}>게시글이 없습니다.</div>
        ) : (
          posts.map((p) => (
            <button key={p.id} type="button" style={postCard} onClick={() => openComments(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 950 }}>{p.title || (tab === 'notice' ? '공지' : '기도제목')}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>{formatTime(p.createdAt)}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{p.content}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>{p.authorName}</div>
            </button>
          ))
        )}
      </div>

      <BottomSheet open={composerOpen} onClose={() => setComposerOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>글쓰기 · {tab === 'notice' ? '공지' : '기도'}</div>
        <div style={{ height: 10 }} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목(선택)" style={input} />
        <div style={{ height: 10 }} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" style={textarea} />
        <div style={{ height: 12 }} />
        <button
          type="button"
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
          disabled={saving}
          onClick={async () => {
            if (!id) return;
            if (!content.trim()) {
              alert('내용을 입력하세요.');
              return;
            }
            setSaving(true);
            try {
              const res = await apiFetch(`/api/channels/${id}/posts`, {
                method: 'POST',
                body: JSON.stringify({ boardType: tab, title: title.trim() || null, content: content.trim() })
              });
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
          }}
        >
          {saving ? '등록 중…' : '등록'}
        </button>
      </BottomSheet>

      <BottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>{activePost?.title ?? '댓글'}</div>
        <div style={{ height: 8 }} />
        <div style={{ color: 'var(--text)', lineHeight: 1.45 }}>{activePost?.content}</div>
        <div style={{ height: 12 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflow: 'auto' }}>
          {comments.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>댓글이 없습니다.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={commentRow}>
                <div style={{ fontWeight: 900 }}>{c.authorName}</div>
                <div style={{ marginTop: 4, color: 'var(--text)' }}>{c.content}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 10 }} />
        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="댓글 입력" style={{ ...textarea, minHeight: 72 }} />
        <div style={{ height: 10 }} />
        <button
          type="button"
          style={{ ...primaryBtn, opacity: commentSaving ? 0.7 : 1 }}
          disabled={commentSaving}
          onClick={async () => {
            if (!activePost) return;
            if (!commentText.trim()) return;
            setCommentSaving(true);
            try {
              const res = await apiFetch(`/api/channels/posts/${activePost.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content: commentText.trim() })
              });
              if (!res.ok) throw new Error('COMMENT_FAILED');
              setCommentText('');
              await openComments(activePost);
            } catch {
              alert('댓글 등록 실패');
            } finally {
              setCommentSaving(false);
            }
          }}
        >
          댓글 등록
        </button>
      </BottomSheet>
    </div>
  );
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: any }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 18,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 46, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }} />
        </div>
        {children}
        <div style={{ height: 10 }} />
        <button type="button" onClick={onClose} style={{ ...ghostBtn, width: '100%' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 26,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--soft)',
  fontSize: 12,
  fontWeight: 900,
  color: 'rgba(0,0,0,0.7)'
};

const tabBtn: React.CSSProperties = {
  height: 38,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontWeight: 950
};

const postCard: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)'
};

const commentRow: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--soft)'
};

const ghostBtn: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontWeight: 900,
  fontSize: 13
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--primary-bg)',
  color: 'var(--primary-text)',
  fontWeight: 950,
  fontSize: 15
};

const input: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '0 12px',
  fontSize: 15
};

const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  resize: 'vertical',
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 14,
  lineHeight: 1.45
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,0,0,0.25)',
  background: 'rgba(255,0,0,0.06)',
  marginBottom: 12,
  fontWeight: 900
};
