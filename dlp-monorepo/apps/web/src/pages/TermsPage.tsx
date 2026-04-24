import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import PolicySupportHeaderNav from '../components/legal/PolicySupportHeaderNav';
import PolicySupportFooter from '../components/legal/PolicySupportFooter';
import { Card } from '../ui/Card';

const updatedAt = '2026.04.24';
const contactEmail = 'sks4266@gmail.com';

const sections = [
  {
    title: '제1조 목적',
    body: [
      '이 약관은 ChristianDLP(이하 “서비스”)가 제공하는 말씀 읽기, 맥체인 성경읽기 진행 관리, QT, DLP 체크, 감사일기, 채널, 긴급기도, 문의하기 및 버그 리포트 등 온라인 기능의 이용조건과 운영원칙을 정하는 것을 목적으로 합니다.',
      '본 서비스는 개인 운영자가 신앙 기록과 공동체적 사용을 돕기 위해 제공하는 비상거래성 서비스이며, 서비스의 세부 구조와 정책은 운영상 필요에 따라 변경될 수 있습니다.'
    ]
  },
  {
    title: '제2조 용어의 정의',
    body: [
      '“회원”이란 본 약관에 동의하고 계정을 생성하여 서비스를 이용하는 사람을 말합니다.',
      '“콘텐츠”란 회원이 서비스에 작성하거나 업로드한 QT 기록, 감사일기, 채널 게시글·댓글, 긴급기도 내용, 문의·버그 접수 내용 등 일체의 게시·기록 정보를 말합니다.'
    ]
  },
  {
    title: '제3조 서비스의 제공',
    body: [
      '서비스는 회원가입 및 로그인, 말씀 읽기 및 진행 현황 확인, 개인 신앙 기록 저장, 커뮤니티 기능, 문의 접수, 버그 신고 등의 기능을 제공합니다.',
      '운영자는 안정적 운영, 점검, 장애 대응, 정책 변경, 기능 개선을 위해 서비스의 전부 또는 일부를 추가·변경·중단할 수 있습니다.'
    ]
  },
  {
    title: '제4조 회원가입과 계정 관리',
    body: [
      '회원은 본인의 정보를 바탕으로 정확하게 가입해야 하며, 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.',
      '계정과 비밀번호의 관리 책임은 회원 본인에게 있으며, 무단 사용이나 보안상 의심 상황이 발생한 경우 회원은 즉시 비밀번호를 변경하고 서비스 문의 채널로 알려야 합니다.'
    ]
  },
  {
    title: '제5조 이용자의 의무',
    body: [
      '회원은 관련 법령, 본 약관, 서비스 운영정책을 준수해야 하며, 서비스의 정상 운영을 방해하는 행위를 해서는 안 됩니다.',
      '특히 욕설, 비방, 허위사실 유포, 광고·스팸, 악성 자동화 요청, 시스템 공격, 타인의 개인정보 무단 게시, 저작권 침해, 공동체를 현저히 해치는 게시행위는 금지됩니다.'
    ]
  },
  {
    title: '제6조 게시물과 운영 조치',
    body: [
      '회원이 작성한 콘텐츠에 대한 기본 책임은 작성자에게 있습니다.',
      '운영자는 서비스 보호, 공동체 안전, 법령 준수, 권리침해 대응을 위해 필요한 경우 게시물의 노출 제한, 삭제, 수정 요청, 계정 또는 기능 이용 제한 조치를 할 수 있습니다.'
    ]
  },
  {
    title: '제7조 문의하기 및 버그 리포트',
    body: [
      '회원 및 비회원은 서비스 내 문의하기 페이지(/support)를 통해 일반 문의, 계정 관련 요청, 버그 리포트를 접수할 수 있습니다.',
      '접수 내용은 서비스 개선, 오류 재현, 장애 대응, 이용자 지원을 위해 검토되며, 회신이 필요한 경우 이용자가 직접 남긴 이름 또는 이메일 정보를 이용할 수 있습니다.',
      `운영 문의 및 개인정보 관련 요청은 /support 또는 이메일(${contactEmail})로 접수할 수 있습니다.`
    ]
  },
  {
    title: '제8조 회원탈퇴',
    body: [
      '회원은 서비스가 제공하는 계정 설정 또는 운영자 문의 채널을 통해 언제든지 회원탈퇴를 요청할 수 있습니다.',
      '회원탈퇴가 완료되면 계정은 더 이상 로그인에 사용할 수 없으며, 서비스 구조상 해당 회원 식별에 연결된 기록은 삭제되거나 다른 이용자 보호 및 운영 필요 범위에서 비식별 처리될 수 있습니다.',
      '다만 법령상 보존의무가 있거나 분쟁 대응, 부정 이용 방지, 보안 점검이 필요한 정보는 관련 법령 및 내부 기준에 따라 일정 기간 별도 보관될 수 있습니다.'
    ]
  },
  {
    title: '제9조 개인정보 삭제 요청',
    body: [
      '회원은 회원탈퇴와 별도로 개인정보 삭제 또는 처리정지를 요청할 수 있으며, 운영자는 관계 법령에 반하지 않는 범위에서 지체 없이 검토·처리합니다.',
      '삭제 요청 시 본인 확인이 필요할 수 있으며, 문의 처리 이력, 보안 대응 이력 등 일부 정보는 법령상 의무 또는 정당한 운영 목적이 있는 경우 일정 기간 분리 보관 후 삭제될 수 있습니다.',
      `개인정보 삭제 요청은 /support 또는 ${contactEmail}로 접수할 수 있습니다.`
    ]
  },
  {
    title: '제10조 개인정보 보호',
    body: [
      '운영자는 관련 법령에 따라 개인정보를 처리하며, 구체적인 수집 항목, 이용 목적, 보관 기간, 권리 행사 방법은 개인정보 처리방침에서 정합니다.',
      '회원은 서비스 이용 전 개인정보 처리방침을 함께 확인해야 합니다.'
    ]
  },
  {
    title: '제11조 서비스 중단 및 책임 제한',
    body: [
      '운영자는 시스템 점검, 서버 장애, 통신 문제, 외부 플랫폼 장애, 천재지변, 불가항력 등 사유로 서비스 제공을 일시 중단할 수 있습니다.',
      '운영자는 고의 또는 중대한 과실이 없는 한 이용자의 귀책사유, 기기·브라우저 환경, 외부 인프라 장애 등으로 발생한 손해에 대하여 책임을 제한할 수 있습니다.'
    ]
  },
  {
    title: '제12조 약관 변경 및 준거법',
    body: [
      '운영자는 법령 변경, 서비스 개편, 정책 조정이 필요한 경우 본 약관을 개정할 수 있으며, 중요한 내용은 서비스 내 관련 페이지에 공지합니다.',
      `본 약관은 대한민국 법령을 준거법으로 하며, 서비스 이용과 관련한 문의는 /support 또는 이메일(${contactEmail})로 할 수 있습니다.`
    ]
  }
];

export default function TermsPage() {
  return (
    <div className="sanctuaryPage">
      <div className="sanctuaryPageInner">
        <TopBar title="서비스 이용약관" backTo="/" hideAuthActions />
        <PolicySupportHeaderNav variant="terms" />

        <Card pad style={heroCard}>
          <div style={eyebrow}>TERMS OF SERVICE</div>
          <h1 style={title}>ChristianDLP 서비스 이용약관</h1>
          <p style={desc}>
            문의하기, 버그 리포트, 회원탈퇴, 개인정보 삭제 요청 절차까지 한 흐름으로 이해할 수 있도록
            ChristianDLP 운영 기준을 정리한 문서입니다.
          </p>
          <div style={metaRow}>
            <span style={chip}>최종 업데이트 {updatedAt}</span>
            <span style={chipSoft}>문의 이메일 {contactEmail}</span>
            <Link to="/privacy" style={linkChip}>
              개인정보 처리방침
            </Link>
            <Link to="/support" style={linkChip}>
              문의 / 요청 접수
            </Link>
          </div>
        </Card>

        {sections.map((section) => (
          <Card key={section.title} pad style={sectionCard}>
            <div style={sectionTitle}>{section.title}</div>
            <div style={bodyStack}>
              {section.body.map((text) => (
                <p key={text} style={paragraph}>
                  {text}
                </p>
              ))}
            </div>
          </Card>
        ))}

        <PolicySupportFooter variant="public" />
      </div>
    </div>
  );
}

const heroCard: CSSProperties = {
  marginBottom: 14,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(248,255,252,0.72))'
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#5ea898'
};

const title: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 28,
  lineHeight: 1.18,
  color: '#24313a'
};

const desc: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 14,
  lineHeight: 1.7,
  color: '#61717a'
};

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 14
};

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(114,215,199,0.12)',
  color: '#287a6f',
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid rgba(114,215,199,0.22)'
};

const chipSoft: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.72)',
  color: '#42535c',
  fontSize: 12,
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.56)'
};

const linkChip: CSSProperties = {
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

const sectionCard: CSSProperties = {
  marginBottom: 12,
  borderRadius: 22
};

const sectionTitle: CSSProperties = {
  fontSize: 19,
  lineHeight: 1.3,
  fontWeight: 800,
  color: '#24313a'
};

const bodyStack: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 12
};

const paragraph: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.75,
  color: '#52616a'
};
