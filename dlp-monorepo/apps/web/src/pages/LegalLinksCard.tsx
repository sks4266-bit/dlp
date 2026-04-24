import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

export default function LegalLinksCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card pad style={{ borderRadius: 20, marginTop: compact ? 12 : 14 }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', color: '#83a39a' }}>
        POLICY & SUPPORT
      </div>
      <div style={{ marginTop: 8, fontSize: compact ? 15 : 16, fontWeight: 800, color: '#24313a' }}>
        이용약관, 개인정보 처리방침, 문의/요청 접수
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: '#61717a' }}>
        서비스 정책 확인부터 문의하기, 버그 리포트, 계정 탈퇴/개인정보 삭제 요청 안내까지 한 곳에서 연결했습니다.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Link to="/terms" style={linkChip}>이용약관</Link>
        <Link to="/privacy" style={linkChip}>개인정보 처리방침</Link>
        <Link to="/support" style={linkChip}>문의 / 요청 접수</Link>
      </div>
    </Card>
  );
}

const linkChip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(255,255,255,0.56)',
  color: '#43545d',
  fontSize: 12,
  fontWeight: 800,
  textDecoration: 'none'
};
