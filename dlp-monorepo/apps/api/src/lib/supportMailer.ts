import type { Env } from '../env';

type SupportType = 'INQUIRY' | 'BUG' | 'ACCOUNT_DELETE' | 'PRIVACY_DELETE';

type SupportEmailPayload = {
  id: string;
  type: SupportType;
  typeLabel: string;
  title: string;
  message: string;
  contactName: string | null;
  contactEmail: string | null;
  userId: string | null;
  userName: string | null;
  pageUrl: string | null;
  createdAt: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

function createTextBody(payload: SupportEmailPayload) {
  return [
    'ChristianDLP 새 접수 알림',
    '',
    `유형: ${payload.typeLabel}`,
    `제목: ${payload.title}`,
    `접수 ID: ${payload.id}`,
    `접수 시각: ${formatTime(payload.createdAt)}`,
    `회원 이름: ${payload.userName ?? '-'}`,
    `회원 ID: ${payload.userId ?? '-'}`,
    `연락 이름: ${payload.contactName ?? '-'}`,
    `연락 이메일: ${payload.contactEmail ?? '-'}`,
    `페이지 URL: ${payload.pageUrl ?? '-'}`,
    '',
    '[본문]',
    payload.message
  ].join('\n');
}

function createHtmlBody(payload: SupportEmailPayload) {
  const rows = [
    ['유형', payload.typeLabel],
    ['제목', payload.title],
    ['접수 ID', payload.id],
    ['접수 시각', formatTime(payload.createdAt)],
    ['회원 이름', payload.userName ?? '-'],
    ['회원 ID', payload.userId ?? '-'],
    ['연락 이름', payload.contactName ?? '-'],
    ['연락 이메일', payload.contactEmail ?? '-'],
    ['페이지 URL', payload.pageUrl ?? '-']
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 10px;background:#f7fafc;border:1px solid #e6edf3;font-weight:700;color:#425466;width:140px;">${escapeHtml(label)}</td><td style="padding:8px 10px;border:1px solid #e6edf3;color:#24313a;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const messageHtml = escapeHtml(payload.message).replaceAll('\n', '<br />');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f7fb;padding:24px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px;border:1px solid #e6edf3;">
        <div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#6a8fc9;">CHRISTIANDLP SUPPORT</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;color:#24313a;">새 ${escapeHtml(payload.typeLabel)} 접수</h1>
        <p style="margin:10px 0 18px;font-size:14px;line-height:1.7;color:#61717a;">ChristianDLP /support 페이지에서 새로운 요청이 접수되었습니다.</p>
        <table style="width:100%;border-collapse:collapse;border-spacing:0;">${rows}</table>
        <div style="margin-top:18px;padding:16px;border-radius:14px;background:#fafcff;border:1px solid #e6edf3;">
          <div style="font-size:13px;font-weight:900;color:#4f739d;">본문</div>
          <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#33424c;white-space:normal;">${messageHtml}</div>
        </div>
      </div>
    </div>
  `;
}

export async function sendSupportNotificationEmail(env: Env, payload: SupportEmailPayload) {
  if (!env.RESEND_API_KEY || !env.SUPPORT_TO_EMAIL || !env.SUPPORT_FROM_EMAIL) {
    console.warn('Support email delivery skipped: missing RESEND_API_KEY or support email env vars.');
    return { ok: false, skipped: true as const };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.SUPPORT_FROM_EMAIL,
      to: [env.SUPPORT_TO_EMAIL],
      reply_to: payload.contactEmail ?? undefined,
      subject: `[ChristianDLP] ${payload.typeLabel} 접수 - ${payload.title}`,
      text: createTextBody(payload),
      html: createHtmlBody(payload)
    })
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`EMAIL_SEND_FAILED:${res.status}:${errorText}`);
  }

  return { ok: true as const, skipped: false as const };
}
