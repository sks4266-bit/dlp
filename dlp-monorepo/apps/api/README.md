# dlp-api (Cloudflare Workers + D1 + R2)

## 로컬 개발

```bash
pnpm i

# 1) D1 마이그레이션(로컬)
pnpm --filter api db:migrate:local

# 2) 맥체인 xlsx -> seed 마이그레이션 생성 + 로컬 D1 반영
pnpm --filter api seed:mcheyne:local

# 3) API 실행
pnpm --filter api dev
```

## ADMIN(운영진) 수동 등록

- `migrations/9999_admin_manual_insert.sql` 참고

## 참고: 맥체인 외부 본문 열기

- MVP에서는 월별 페이지로 이동합니다.
- 예: 3월 `https://bible.fgtv.com/b2/03.asp` [Source](https://bible.fgtv.com/b2/03.asp)
