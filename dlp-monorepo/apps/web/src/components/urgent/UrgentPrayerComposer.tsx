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
      <div style={heroCard}>
        <div style={eyebrowStyle}>URGENT PRAYER</div>
        <div style={titleStyle}>지금 함께 기도할 제목을 나눠주세요</div>
        <div style={descStyle}>홈 화면 톤과 같은 유리 질감 카드 위에서, 공동체가 바로 이해할 수 있도록 한 문장으로 또렷하게 작성하면 좋아요.</div>

        <div style={chipRowStyle}>
          <span style={chipPeach}>실명 표시</span>
          <span style={chipMint}>24시간 노출</span>
          <span style={chipNeutral}>한 번에 한 건</span>
        </div>
      </div>

      <div style={editorCard}>
        <label className="glassField" style={fieldReset}>
          <div className="glassFieldLabel">기도 제목</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예) 수술을 앞둔 성도님이 평안 가운데 준비하고 회복할 수 있도록 함께 기도해주세요."
            className="glassTextarea"
            style={{ minHeight: 144 }}
            maxLength={280}
          />
        </label>

        <div style={exampleBoxStyle}>
          <div style={exampleTitleStyle}>작성 팁</div>
          <div style={exampleTextStyle}>누가, 어떤 상황인지 너무 길지 않게 적고, 함께 기도해주길 원하는 포인트를 자연스럽게 덧붙이면 더 읽기 쉬워집니다.</div>
        </div>

        {err ? <div style={errorStyle}>{err}</div> : null}

        <div style={footerStyle}>
          <div style={countStyle}>{content.length}/280</div>
          <Button type="button" variant="primary" size="lg" onClick={submit} disabled={loading || content.trim().length === 0}>
            {loading ? '등록 중…' : '기도제목 올리기'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: 12
};

const heroCard: CSSProperties = {
  padding: '2px 0 0'
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#b57a67'
};

const titleStyle: CSSProperties = {
  marginTop: 6,
  color: '#27343c',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.28,
  letterSpacing: '-0.02em'
};

const descStyle: CSSProperties = {
  marginTop: 8,
  color: '#697780',
  fontSize: 14,
  lineHeight: 1.6
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12
};

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800
};

const chipPeach: CSSProperties = {
  ...chipBase,
  background: 'rgba(243,180,156,0.16)',
  border: '1px solid rgba(243,180,156,0.26)',
  color: '#9b644f'
};

const chipMint: CSSProperties = {
  ...chipBase,
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.24)',
  color: '#2f7f73'
};

const chipNeutral: CSSProperties = {
  ...chipBase,
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(221,230,235,0.9)',
  color: '#6b7780'
};

const editorCard: CSSProperties = {
  padding: 14,
  borderRadius: 20,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,251,252,0.76))',
  border: '1px solid rgba(255,255,255,0.62)',
  boxShadow: '0 12px 28px rgba(77,90,110,0.08)',
  display: 'grid',
  gap: 12
};

const fieldReset: CSSProperties = {
  margin: 0
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
