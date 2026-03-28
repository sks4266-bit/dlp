import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import Button from '../ui/Button';
import { Card, CardDesc, CardTitle } from '../ui/Card';

type BookmarkItem = {
  ref: string;
  note: string;
  savedAt: number;
  updatedAt: number;
};

const BOOKMARK_READ_KEY = 'dlp_bible_read_bookmarks_v1';

function normalizeBookmarks(input: unknown): BookmarkItem[] {
  const now = Date.now();
  if (!Array.isArray(input)) return [];

  return input
    .map((item, idx) => {
      if (typeof item === 'string') {
        const ref = item.trim();
        if (!ref) return null;
        const ts = now - idx;
        return { ref, note: '', savedAt: ts, updatedAt: ts };
      }
      if (!item || typeof item !== 'object') return null;

      const ref = String((item as any).ref ?? '').trim();
      if (!ref) return null;

      const savedAt = Number((item as any).savedAt ?? now - idx);
      const updatedAt = Number((item as any).updatedAt ?? savedAt);
      return {
        ref,
        note: String((item as any).note ?? ''),
        savedAt: Number.isFinite(savedAt) ? savedAt : now - idx,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : savedAt
      };
    })
    .filter((item): item is BookmarkItem => Boolean(item))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 200);
}

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_READ_KEY);
    if (!raw) return [];
    return normalizeBookmarks(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveBookmarks(list: BookmarkItem[]) {
  try {
    localStorage.setItem(BOOKMARK_READ_KEY, JSON.stringify(normalizeBookmarks(list)));
  } catch {
    // ignore
  }
}

function formatBookmarkDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

export default function BibleBookmarksPage() {
  const nav = useNavigate();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    const sync = () => setBookmarks(loadBookmarks());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sync();
    };

    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const sortedBookmarks = useMemo(() => [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt), [bookmarks]);

  function openBookmark(ref: string) {
    nav(`/bible-search?${new URLSearchParams({ tab: 'read', ref }).toString()}`);
  }

  function deleteBookmark(ref: string) {
    setBookmarks((prev) => {
      const next = prev.filter((item) => item.ref !== ref);
      saveBookmarks(next);
      return next;
    });
  }

  function updateBookmarkDraft(ref: string, note: string) {
    setBookmarks((prev) => prev.map((item) => (item.ref === ref ? { ...item, note } : item)));
  }

  function persistBookmarkNote(ref: string) {
    setBookmarks((prev) => {
      const next = prev.map((item) => (item.ref === ref ? { ...item, note: item.note.trim(), updatedAt: Date.now() } : item));
      const normalized = normalizeBookmarks(next);
      saveBookmarks(normalized);
      return normalized;
    });
  }

  return (
    <div style={page}>
      <div style={pageInner}>
        <TopBar title="성경 북마크" backTo="/" />

        <Card pad style={heroCard}>
          <div style={badgeMint}>BIBLE BOOKMARKS</div>
          <CardTitle style={heroTitle}>절 북마크 전용 페이지</CardTitle>
          <CardDesc style={heroDesc}>선택해서 저장한 절 북마크를 한곳에서 보고, 메모를 수정하거나 삭제할 수 있어요.</CardDesc>
          <div style={heroMetaRow}>
            <div style={heroMetaBadge}>총 {sortedBookmarks.length}개</div>
            <Button type="button" variant="secondary" size="md" onClick={() => nav('/bible-search?tab=read')}>
              본문 읽기 열기
            </Button>
          </div>
        </Card>

        <section style={sectionWrap}>
          <Card pad style={sectionCard}>
            <div style={sectionHead}>
              <div>
                <div style={miniEyebrow}>BOOKMARK LIST</div>
                <CardTitle style={sectionCardTitle}>저장된 절 목록</CardTitle>
                <CardDesc style={sectionCardDesc}>최신 수정 순으로 정렬됩니다.</CardDesc>
              </div>
            </div>

            {sortedBookmarks.length === 0 ? (
              <div style={emptyNote}>
                아직 저장된 절 북마크가 없어요. 성경 본문 읽기에서 원하는 절을 선택한 뒤 북마크 저장을 눌러보세요.
                <div style={{ marginTop: 12 }}>
                  <Button type="button" variant="primary" size="md" onClick={() => nav('/bible-search?tab=read')}>
                    성경 본문 읽기 열기
                  </Button>
                </div>
              </div>
            ) : (
              <div style={bookmarkList}>
                {sortedBookmarks.map((item) => (
                  <div key={item.ref} style={bookmarkCard}>
                    <div style={bookmarkCardTop}>
                      <div>
                        <div style={bookmarkRef}>★ {item.ref}</div>
                        <div style={bookmarkDate}>저장 {formatBookmarkDate(item.savedAt)} · 수정 {formatBookmarkDate(item.updatedAt)}</div>
                      </div>
                      <div style={bookmarkActionInline}>
                        <button type="button" style={bookmarkGhostBtn} onClick={() => openBookmark(item.ref)}>
                          열기
                        </button>
                        <button type="button" style={bookmarkDeleteBtn} onClick={() => deleteBookmark(item.ref)}>
                          삭제
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={item.note}
                      onChange={(e) => updateBookmarkDraft(item.ref, e.target.value)}
                      placeholder="이 절에 대한 메모를 남겨보세요."
                      style={bookmarkNoteInput}
                    />

                    <div style={bookmarkCardFooter}>
                      <button type="button" style={bookmarkSaveBtn} onClick={() => persistBookmarkNote(item.ref)}>
                        메모 저장
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100dvh',
  paddingBottom: 32
};

const pageInner: CSSProperties = {
  maxWidth: 430,
  margin: '0 auto',
  padding: '16px 14px 0'
};

const heroCard: CSSProperties = {
  marginTop: 12,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(245,252,249,0.96), rgba(255,255,255,0.92))',
  border: '1px solid rgba(214,231,224,0.9)',
  boxShadow: '0 14px 32px rgba(77,90,110,0.08)'
};

const badgeMint: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(236,253,248,0.92)',
  color: '#257567',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const heroTitle: CSSProperties = {
  marginTop: 12,
  fontSize: 24,
  lineHeight: 1.22,
  letterSpacing: '-0.03em'
};

const heroDesc: CSSProperties = {
  marginTop: 8,
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.6
};

const heroMetaRow: CSSProperties = {
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const heroMetaBadge: CSSProperties = {
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(214,223,229,0.9)',
  color: '#53626c',
  fontSize: 12,
  fontWeight: 800
};

const sectionWrap: CSSProperties = {
  marginTop: 14
};

const sectionCard: CSSProperties = {
  borderRadius: 22,
  background: 'rgba(255,255,255,0.74)',
  border: '1px solid rgba(255,255,255,0.56)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)'
};

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const miniEyebrow: CSSProperties = {
  color: '#83a39a',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em'
};

const sectionCardTitle: CSSProperties = {
  marginTop: 6,
  fontSize: 20,
  lineHeight: 1.25,
  letterSpacing: '-0.03em'
};

const sectionCardDesc: CSSProperties = {
  marginTop: 6,
  color: '#6d7a83',
  fontSize: 13,
  lineHeight: 1.55
};

const emptyNote: CSSProperties = {
  marginTop: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(247,250,251,0.72)',
  border: '1px solid rgba(224,231,236,0.9)',
  color: '#6d7a83',
  fontSize: 14,
  lineHeight: 1.6
};

const bookmarkList: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gap: 10
};

const bookmarkCard: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(224,231,236,0.9)',
  background: 'rgba(255,255,255,0.9)',
  padding: '14px 14px 12px'
};

const bookmarkCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10
};

const bookmarkRef: CSSProperties = {
  color: '#257567',
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.4
};

const bookmarkDate: CSSProperties = {
  marginTop: 4,
  color: '#7b8790',
  fontSize: 12,
  lineHeight: 1.45
};

const bookmarkActionInline: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const bookmarkGhostBtn: CSSProperties = {
  minHeight: 34,
  borderRadius: 12,
  border: '1px solid rgba(214,223,229,0.92)',
  background: 'rgba(247,250,251,0.9)',
  color: '#4f6472',
  fontSize: 12,
  fontWeight: 800,
  padding: '0 12px',
  cursor: 'pointer'
};

const bookmarkDeleteBtn: CSSProperties = {
  ...bookmarkGhostBtn,
  color: '#a14c43',
  border: '1px solid rgba(234,178,161,0.6)',
  background: 'rgba(255,243,240,0.95)'
};

const bookmarkNoteInput: CSSProperties = {
  width: '100%',
  minHeight: 76,
  marginTop: 12,
  borderRadius: 14,
  border: '1px solid rgba(221,228,233,0.95)',
  background: 'rgba(250,252,255,0.96)',
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.6,
  color: '#24313a',
  boxSizing: 'border-box',
  resize: 'vertical'
};

const bookmarkCardFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 10
};

const bookmarkSaveBtn: CSSProperties = {
  minHeight: 36,
  borderRadius: 12,
  border: '1px solid rgba(114,215,199,0.3)',
  background: 'rgba(236,253,248,0.92)',
  color: '#257567',
  fontSize: 12,
  fontWeight: 900,
  padding: '0 12px',
  cursor: 'pointer'
};
