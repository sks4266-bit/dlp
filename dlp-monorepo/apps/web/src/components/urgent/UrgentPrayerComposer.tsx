import { useMemo, useState, type CSSProperties } from 'react';
import { apiFetch } from '../../lib/api';
import Button from '../../ui/Button';

type Props = {
  onDone?: (newId: string) => void;
  onUnauthorized?: () => void;
};

const MAX_LENGTH = 280;

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractMessage(data: unknown, fallback: string) {
  if (typeof data === 'string' && data.trim()) return data.trim();

  if (data && typeof data === 'object') {
    const message =
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null;

    if (message && message.trim()) return message.trim();
  }

  return fallback;
}

export default function UrgentPrayerComposer({
  onDone,
  onUnauthorized
}: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => content.trim(), [content]);
  const canSubmit = !loading && trimmed.length > 0;
  const remain = MAX_LENGTH - content.length;

  async function submit() {
    if (loading) return;

    if (!trimmed) {
      setErr('기도제목을 입력해주세요.');
      return;
    }

    if (trimmed.length > MAX_LENGTH) {
      setErr(`기도제목은 최대 ${MAX_LENGTH}자까지 입력할 수 있습니다.`);
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

      const data = await safeReadJson(res);

      if (!res.ok) {
        throw new Error(extractMessage(data, '긴급기도 등록에 실패했습니다.'));
      }

      const newId =
        data &&
        typeof data === 'object' &&
        typeof (data as { id?: unknown }).id === 'string'
          ? (data as { id: string }).id
          : '';

      setContent('');
      setErr(null);
      onDone?.(newId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '긴급기도 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={headRow}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>URGENT COMPOSER</div>
          <div style={title}>긴급기도제목 작성</div>
          <div style={desc}>
            작성자 표시는 <strong>실명</strong>으로 고정되며, 등록된 글은{' '}
            <strong>24시간</strong> 동안 노출됩니다.
          </div>
        </div>

        <div style={metaStack}>
          <MetaChip tone="peach">{MAX_LENGTH}자 이내</MetaChip>
          <MetaChip tone="mint">한 번에 1제목</MetaChip>
        </div>
      </div>

      <div className="stack12" />

      <div style={helperPanel}>
        <div style={helperTitle}>작성 팁</div>
        <div style={helperDesc}>
          배경 설명을 길게 쓰기보다, 지금 함께 기도해야 할 핵심 한 가지를 짧고
          분명하게 적어 주세요.
        </div>
      </div>

      <div className="stack12" />

      <label style={fieldLabel} htmlFor="urgent-prayer-content">
        기도제목
      </label>

      <textarea
        id="urgent-prayer-content"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (err) setErr(null);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="예) 오늘 수술을 앞둔 가족을 위해 평안과 회복을 기도해 주세요."
        className="glassTextarea"
        style={textarea}
        maxLength={MAX_LENGTH}
        aria-label="긴급기도제목 입력"
      />

      <div className="stack10" />

      <div style={footerRow}>
        <div
          style={{
            ...countChip,
            ...(remain <= 30 ? countChipWarn : null)
          }}
          aria-live="polite"
        >
          {content.length}/{MAX_LENGTH}
        </div>

        <div style={hintText}>⌘/Ctrl + Enter 로 바로 등록</div>
      </div>

      {err ? (
        <>
          <div className="stack10" />
          <div style={errorBox} role="alert">
            {err}
          </div>
        </>
      ) : null}

      <div className="stack12" />

      <div style={actionRow}>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => {
            setContent('');
            setErr(null);
          }}
          disabled={loading || content.length === 0}
        >
          비우기
        </Button>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {loading ? '등록 중…' : '긴급기도 등록'}
        </Button>
      </div>
    </div>
  );
}

function MetaChip({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: 'mint' | 'peach' | 'neutral';
}) {
  const toneStyle =
    tone === 'mint' ? metaMint : tone === 'peach' ? metaPeach : metaNeutral;

  return <div style={{ ...metaChip, ...toneStyle }}>{children}</div>;
}

const wrap: CSSProperties = {
  display: 'block'
};

const headRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap'
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#9d8a7b',
  marginBottom: 6
};

const title: CSSProperties = {
  color: '#223038',
  fontSize: 20,
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: '-0.03em'
};

const desc: CSSProperties = {
  marginTop: 8,
  color: '#6f7d87',
  fontSize: 13,
  lineHeight: 1.6
};

const metaStack: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const metaChip: CSSProperties = {
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap'
};

const metaMint: CSSProperties = {
  background: 'rgba(114,215,199,0.14)',
  border: '1px solid rgba(114,215,199,0.22)',
  color: '#2b7f72'
};

const metaPeach: CSSProperties = {
  background: 'rgba(235,168,141,0.16)',
  border: '1px solid rgba(235,168,141,0.24)',
  color: '#a56448'
};

const metaNeutral: CSSProperties = {
  background: 'rgba(255,255,255,0.48)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a'
};

const helperPanel: CSSProperties = {
  borderRadius: 16,
  padding: '12px 13px',
  background: 'rgba(255,255,255,0.42)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)'
};

const helperTitle: CSSProperties = {
  color: '#42515b',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4
};

const helperDesc: CSSProperties = {
  color: '#6f7d87',
  fontSize: 12,
  lineHeight: 1.55
};

const fieldLabel: CSSProperties = {
  display: 'block',
  marginBottom: 8,
  color: '#42515b',
  fontSize: 12,
  fontWeight: 800
};

const textarea: CSSProperties = {
  minHeight: 144,
  resize: 'vertical'
};

const footerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap'
};

const countChip: CSSProperties = {
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.50)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#72808a',
  fontSize: 12,
  fontWeight: 800
};

const countChipWarn: CSSProperties = {
  background: 'rgba(235,168,141,0.14)',
  border: '1px solid rgba(235,168,141,0.22)',
  color: '#a56448'
};

const hintText: CSSProperties = {
  color: '#93a0a8',
  fontSize: 12,
  fontWeight: 700
};

const errorBox: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 16,
  background: 'rgba(255,243,240,0.92)',
  border: '1px solid rgba(235,138,127,0.24)',
  color: '#9a4a4a',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.5
};

const actionRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};
