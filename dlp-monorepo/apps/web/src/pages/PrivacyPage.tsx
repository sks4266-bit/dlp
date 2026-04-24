import { Link } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import PolicySupportHeaderNav from '../components/legal/PolicySupportHeaderNav';
import PolicySupportFooter from '../components/legal/PolicySupportFooter';
import { Card } from '../ui/Card';

const updatedAt = '2026.04.24';
const contactEmail = 'sks4266@gmail.com';

const sections = [
  {
    title: '1. 총칙',
    body: [
      'ChristianDLP(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며 「개인정보 보호법」 등 관련 법령을 준수하기 위하여 본 개인정보 처리방침을 공개합니다.',
      `서비스는 개인 운영 형태로 제공되며, 개인정보 관련 문의와 요청은 앱 내 문의하기 페이지(/support) 또는 이메일(${contactEmail})로 접수할 수 있습니다.`
    ]
  },
  {
    title: '2. 개인정보 처리 목적',
    body: [
      '서비스는 회원 식별, 로그인 유지, 개인별 신앙 기록 제공, 커뮤니티 기능 운영, 문의 및 버그 대응, 계정 관리, 서비스 개선, 보안 관리 목적으로 개인정보를 처리합니다.',
      '회원탈퇴 요청, 개인정보 삭제 요청, 분쟁 대응, 부정 이용 방지 및 시스템 안정화에 필요한 범위에서도 개인정보를 처리할 수 있습니다.'
    ]
  },
  {
    title: '3. 처리하는 개인정보 항목',
    body: [
      '회원가입 및 계정 관리 시: 이름, 아이디(username), 비밀번호(평문이 아닌 해시값 형태), 선택항목으로 휴대폰번호와 출석교회.',
      '서비스 이용 시: 맥체인 진행 정보, DLP 체크 기록, QT/감사 기록, 채널 게시글·댓글, 긴급기도 등록 내용 등 이용자가 직접 작성하거나 저장한 기록.',
      '인증 및 보안 시: 세션 식별 정보, 로그인 상태 유지용 토큰 정보, 기본적인 요청 정보와 보안 점검용 기록이 처리될 수 있습니다.'
    ]
  },
  {
    title: '4. 문의하기·버그 리포트·삭제 요청 접수 시 수집 항목',
    body: [
      '문의하기 또는 버그 리포트 접수 시에는 문의 유형, 제목, 본문, 이용자가 입력한 이름, 이메일, 접수 시각, 접속한 페이지 URL 등이 처리될 수 있습니다.',
      '계정 탈퇴, 개인정보 삭제, 처리정지 요청 시에는 본인 확인과 요청 이력 관리를 위해 필요한 최소한의 정보가 추가로 처리될 수 있습니다.',
      `회신이 필요한 경우 운영자는 이용자가 직접 기재한 연락수단 또는 운영 연락처(${contactEmail})를 통해 안내할 수 있습니다.`
    ]
  },
  {
    title: '5. 개인정보의 보유 및 이용기간',
    body: [
      '회원정보와 개인 기록은 원칙적으로 회원 탈퇴 시까지 보관합니다.',
      '로그인 세션 정보는 발급일로부터 최대 30일 범위에서 유지될 수 있으며 만료 후 정리됩니다.',
      '문의 및 버그 접수 내역은 처리 이력 관리와 분쟁 대응을 위해 접수일 기준 최대 3년간 보관 후 파기할 수 있습니다.',
      '법령상 보존의무가 있거나 분쟁 해결, 부정 이용 방지, 보안 대응을 위해 필요한 경우 해당 목적 달성 시까지 별도 보관할 수 있습니다.'
    ]
  },
  {
    title: '6. 회원탈퇴 및 개인정보 삭제 요청 처리',
    body: [
      '이용자는 내정보 페이지 또는 문의 채널을 통해 회원탈퇴를 요청할 수 있습니다.',
      '회원탈퇴가 완료되면 계정은 더 이상 사용할 수 없으며, 이용자 식별에 연결된 정보와 기록은 서비스 구조와 법적 의무를 고려하여 삭제 또는 비식별 처리됩니다.',
      '개인정보 삭제 요청은 회원탈퇴와 별도로도 가능하며, 운영자는 법령에 반하지 않는 범위에서 지체 없이 처리 여부를 검토합니다.',
      '다만 다른 이용자의 권리 보호, 분쟁 대응, 보안 조사, 법령 준수에 필요한 최소 정보는 분리 보관 후 보존기간 종료 시 삭제될 수 있습니다.'
    ]
  },
  {
    title: '7. 개인정보의 제3자 제공',
    body: [
      '서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.',
      '다만 이용자 동의가 있거나 법령에 따른 제출 의무가 있는 경우에 한하여 필요한 범위에서 제공할 수 있습니다.'
    ]
  },
  {
    title: '8. 개인정보 처리위탁 및 인프라 이용',
    body: [
      '서비스는 원활한 운영을 위해 클라우드 기반 인프라를 사용할 수 있으며, 현재 서비스 구조상 Cloudflare Workers, D1, R2 등 기술 인프라가 사용될 수 있습니다.',
      '문의 접수 알림 메일 전송을 위해 이메일 전송 서비스 연동이 사용될 수 있으며, 이는 문의 처리 및 운영 알림 목적 범위 내에서만 활용됩니다.',
      '이러한 인프라 이용은 서비스 제공, 저장, 전송, 보안 유지 등 기술적 처리 범위 내에서만 이루어집니다.'
    ]
  },
  {
    title: '9. 개인정보의 파기 절차 및 방법',
    body: [
      '개인정보 보유기간이 경과하거나 처리 목적이 달성된 경우에는 지체 없이 파기합니다.',
      '전자적 파일 형태의 정보는 복구 또는 재생이 어렵도록 안전한 방식으로 삭제하며, 별도 보관 중인 정보도 보존기간 종료 후 동일한 기준으로 파기합니다.'
    ]
  },
  {
    title: '10. 정보주체의 권리와 행사 방법',
    body: [
      '이용자는 자신의 개인정보에 대하여 열람, 정정, 삭제, 처리정지, 회원탈퇴를 요구할 수 있습니다.',
      `이러한 권리 행사는 서비스 내 기능 또는 /support, 이메일(${contactEmail})을 통해 요청할 수 있으며, 운영자는 본인 확인 후 관련 법령에 따라 처리합니다.`
    ]
  },
  {
    title: '11. 안전성 확보조치',
    body: [
      '서비스는 비밀번호 해시 저장, 세션 만료 관리, 접근권한 최소화, 관리자 권한 통제, 운영 로그 기반 점검 등 기본적인 보호조치를 시행합니다.',
      '운영자는 보안상 필요 시 기능 제한, 세션 종료, 정책 변경, 추가 인증 요청 등의 조치를 할 수 있습니다.'
    ]
  },
  {
    title: '12. 자동 수집 장치 및 로컬 저장소',
    body: [
      '서비스는 로그인 상태 유지를 위해 브라우저 localStorage 등 클라이언트 저장소에 인증 토큰을 저장할 수 있습니다.',
      '이용자는 로그아웃 또는 브라우저 저장 데이터 삭제를 통해 이를 제거할 수 있습니다.'
    ]
  },
  {
    title: '13. 문의처 및 권익침해 구제방법',
    body: [
      `개인정보 관련 문의는 /support 또는 ${contactEmail}로 접수할 수 있습니다.`,
      '추가적인 개인정보 침해 신고나 상담이 필요한 경우 개인정보 포털(privacy.go.kr), 개인정보보호위원회(pipc.go.kr) 등 공공기관을 통해 도움을 받을 수 있습니다.'
    ]
  },
  {
    title: '14. 처리방침 변경',
    body: [
      '본 방침은 법령, 서비스 기능, 운영 정책의 변경에 따라 수정될 수 있으며, 중요한 내용이 변경되는 경우 서비스 내 관련 페이지를 통해 안내합니다.'
    ]
  }
];

export default function PrivacyPage() {
  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="개인정보 처리방침" backTo="/" hideAuthActions />
        <PolicySupportHeaderNav variant="privacy" />

        <Card pad style={heroCard}>
          <div style={eyebrow}>PRIVACY POLICY</div>
          <h1 style={title}>ChristianDLP 개인정보 처리방침</h1>
          <p style={desc}>
            문의하기, 버그 리포트, 회원탈퇴, 개인정보 삭제 요청까지 같은 기준으로 이해할 수 있도록
            수집 항목, 보관 기간, 권리 행사 절차를 정리한 문서입니다.
          </p>
          <div style={metaRow}>
            <span style={chip}>최종 업데이트 {updatedAt}</span>
            <span style={chipSoft}>문의 이메일 {contactEmail}</span>
            <Link to="/terms" style={linkChip}>이용약관</Link>
            <Link to="/support" style={linkChip}>문의 / 요청 접수</Link>
          </div>
        </Card>

        {sections.map((section) => (
          <Card key={section.title} pad style={sectionCard}>
            <div style={sectionTitle}>{section.title}</div>
            <div style={bodyStack}>
              {section.body.map((text) => (
                <p key={text} style={paragraph}>{text}</p>
              ))}
            </div>
          </Card>
        ))}

        <PolicySupportFooter variant="public" />
      </div>
    </div>
  );
}

const heroCard = {
  marginBottom: 14,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,251,255,0.74))'
};

const eyebrow = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#6a8fc9'
};

const title = {
  margin: '10px 0 0',
  fontSize: 28,
  lineHeight: 1.18,
  color: '#24313a'
};

const desc = {
  margin: '10px 0 0',
  fontSize: 14,
  lineHeight: 1.7,
  color: '#61717a'
};

const metaRow = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
  marginTop: 14
};

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(159,195,255,0.14)',
  color: '#4e73b4',
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid rgba(159,195,255,0.24)'
};

const chipSoft = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.78)',
  color: '#42535c',
  fontSize: 12,
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.56)'
};

const linkChip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.78)',
  color: '#42535c',
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid rgba(255,255,255,0.56)',
  textDecoration: 'none'
};

const sectionCard = {
  marginBottom: 12,
  borderRadius: 22
};

const sectionTitle = {
  fontSize: 19,
  lineHeight: 1.3,
  fontWeight: 800,
  color: '#24313a'
};

const bodyStack = {
  display: 'grid',
  gap: 10,
  marginTop: 12
};

const paragraph = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.75,
  color: '#52616a'
};
