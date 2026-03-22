import { useState } from 'react';
import { apiFetch } from '../../lib/api';

type Props = {
  onDone?: (newId: string) => void;
  onUnauthorized?: () => void;
};

export default function UrgentPrayerComposer({ onDone, onUnauthorized }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (loading) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setErr('기도제목을 입력해주세요.');
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/urgent-prayers', {
        method: 'POST',
        body: JSON.stringify({ content: trimmed })
      });

      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? 'CREATE_FAILED');
      }

      setContent('');
      onDone?.(data.id);
    } catch (e: any) {
      setErr(e?.message ?? '작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>긴급기도제목 작성</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        작성자 표시는 <b>실명</b>으로 고정되며, 글은 <b>24시간</b> 노출됩니다.
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="기도제목 1가지만 입력해주세요 (최대 280자)"
        style={{
          width: '100%',
          minHeight: 120,
          borderRadius: 14,
          border: '1px solid var(--border)',
          padding: 12,
          fontSize: 15,
          lineHeight: 1.45,
          resize: 'none'
        }}
        maxLength={280}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{content.length}/280</div>
        <button
          type="button"
          onClick={submit}
          disabled={loading || content.trim().length === 0}
          style={{
            height: 42,
            padding: '0 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,0,0,0.18)',
            background: 'rgba(255,0,0,0.06)',
            fontWeight: 900,
            color: 'rgb(180,0,0)'
          }}
        >
          {loading ? '등록 중…' : '등록'}
        </button>
      </div>

      {err && <div style={errorStyle}>{err}</div>}
    </div>
  );
}

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: 'rgba(255,0,0,0.06)',
  border: '1px solid rgba(255,0,0,0.18)'
};
