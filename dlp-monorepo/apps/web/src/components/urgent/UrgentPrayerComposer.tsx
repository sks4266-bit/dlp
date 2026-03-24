import { useState, type CSSProperties } from 'react';
import { apiFetch } from '../../lib/api';
import Button from '../../ui/Button';

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
    <div style={wrapStyle}>
      <div style={eyebrowStyle}>URGENT PRAYER</div>
      <div style={titleStyle}>지금 함께 기도할 제목을 편하게 나눠주세요</div>
      <div style={descStyle}>한 문장으로 간단히 적으면 실명으로 등록되고, 24시간 동안 공동체가 바로 함께 기도할 수 있어요.</div>

      <div style={chipRowStyle}>
        <span style={chipStyle}>실명 표시</span>
        <span style={chipStyle}>24시간 노출</span>
        <span style={chipStyle}>한 건씩 작성</span>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="예) 수술을 앞둔 성도님을 위해 오늘 함께 기도 부탁드립니다."
        style={textareaStyle}
        maxLength={280}
      />

      <div style={exampleBoxStyle}>
        <div style={exampleTitleStyle}>작성 팁</div>
        <div style={exampleTextStyle}>누가 보아도 바로 이해되도록, 상황과 기도 포인트를 짧고 자연스럽게 적어주면 좋아요.</div>
      </div>

      <div style={footerStyle}>
        <div style={countStyle}>{content.length}/280</div>
        <Button type="button" variant="primary" size="lg" onClick={submit} disabled={loading || content.trim().length === 0}>
          {loading ? '등록 중…' : '기도제목 올리기'}
        </Button>
      </div>

      {err ? <div style={errorStyle}>{err}</div> : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: 12
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#b57a67'
};

const titleStyle: CSSProperties = {
  color: '#27343c',
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-0.02em'
};

const descStyle: CSSProperties = {
  color: '#697780',
  fontSize: 14,
  lineHeight: 1.6
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9b644f',
  fontSize: 12,
  fontWeight: 800
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 132,
  borderRadius: 18,
  border: '1px solid rgba(231, 216, 205, 0.96)',
  background: 'rgba(255,255,255,0.82)',
  padding: '14px 15px',
  fontSize: 15,
  lineHeight: 1.6,
  color: '#33424b',
  resize: 'none',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)'
};

const exampleBoxStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(255,247,242,0.72)',
  border: '1px solid rgba(243,180,156,0.22)'
};

const exampleTitleStyle: CSSProperties = {
  color: '#855746',
  fontSize: 12,
  fontWeight: 800
};

const exampleTextStyle: CSSProperties = {
  marginTop: 6,
  color: '#7b6a64',
  fontSize: 13,
  lineHeight: 1.55
};

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const countStyle: CSSProperties = {
  color: '#87939b',
  fontSize: 12,
  fontWeight: 700
};

const errorStyle: CSSProperties = {
  padding: '11px 12px',
  borderRadius: 14,
  background: 'rgba(255, 238, 235, 0.8)',
  border: '1px solid rgba(228, 143, 132, 0.26)',
  color: '#a64b43',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5
};
