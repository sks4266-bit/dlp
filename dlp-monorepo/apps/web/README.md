# dlp-web (Mobile-first PWA-ready)

## 로컬 개발

```bash
pnpm i

# API 먼저 실행(다른 터미널)
pnpm --filter api dev

# 웹 실행
pnpm --filter web dev
```

## 라우트

- `/` 홈
- `/urgent-prayers` 긴급기도 게시판(목록)

## [MacCheyne 캘린더 UX](/mcheyne-calendar)

맥체인 캘린더는 아래 UX 개선이 반영되어 있습니다.

- 오늘 셀 자동 강조 + 오늘 셀 내 ‘바로가기’
- 바텀시트에서 reading1~4 각각 ‘바로 열기’
- 월 이동 이전/다음 버튼 + ‘오늘’ 이동
- 로그인 사용자: 체크(1~4) 및 ‘일괄 완료(4개 모두 읽음)’(즉시 반영/토스트/실패 롤백)

자세한 동작/정책/QA 체크리스트는 다음 문서를 참고하세요: `apps/web/docs/mcheyne-calendar-ux.md`
- 문서 링크: [mcheyne-calendar-ux.md](./docs/mcheyne-calendar-ux.md)
