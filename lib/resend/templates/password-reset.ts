import {
  emailButton,
  emailDivider,
  emailParagraph,
  escapeHtml,
  renderEmailLayout,
  type EmailLayoutLocale,
} from '../layout'

// Security emails for the password-reset flow. 繁體 copy is written Standard
// Chinese (書面語). Each builder returns subject + html + text so Resend always
// carries a plain-text part.

export type RenderedEmail = { subject: string; html: string; text: string }

export type SignInMethod = 'google' | 'apple' | 'sms'

const METHOD_LABEL: Record<EmailLayoutLocale, Record<SignInMethod, string>> = {
  'zh-HK': { google: 'Google', apple: 'Apple', sms: '手機短訊驗證碼' },
  'zh-CN': { google: 'Google', apple: 'Apple', sms: '手机短信验证码' },
  en: { google: 'Google', apple: 'Apple', sms: 'an SMS code to your phone' },
}

function joinMethods(locale: EmailLayoutLocale, methods: SignInMethod[]): string {
  const labels = methods.map((m) => METHOD_LABEL[locale][m])
  if (locale === 'en') {
    if (labels.length <= 1) return labels[0] ?? ''
    return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
  }
  return labels.join(' 或 ')
}

const HKT_SUFFIX: Record<EmailLayoutLocale, string> = {
  'zh-HK': '（香港時間）',
  'zh-CN': '（香港时间）',
  en: ' (HKT)',
}

export function formatHkTime(date: Date, locale: EmailLayoutLocale): string {
  const formatted = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${formatted}${HKT_SUFFIX[locale]}`
}

// ── Reset link ──────────────────────────────────────────────────────────────

const RESET_COPY: Record<EmailLayoutLocale, {
  subject: string
  title: string
  intro: string
  button: string
  fallback: string
  expiry: string
  security: string
}> = {
  'zh-HK': {
    subject: '重設你的 Space8 密碼',
    title: '重設密碼',
    intro: '我們收到重設你 Space8 帳戶密碼的要求。請按下方按鈕設定新密碼。',
    button: '設定新密碼',
    fallback: '如按鈕無法使用，請將以下連結複製到瀏覽器：',
    expiry: '此連結將於 60 分鐘後失效，並只可使用一次。',
    security: '如你沒有提出此要求，請忽略此電郵，你的密碼不會被更改。請勿將此連結轉寄給任何人。',
  },
  'zh-CN': {
    subject: '重设你的 Space8 密码',
    title: '重设密码',
    intro: '我们收到重设你 Space8 账户密码的请求。请点击下方按钮设定新密码。',
    button: '设定新密码',
    fallback: '如按钮无法使用，请将以下链接复制到浏览器：',
    expiry: '此链接将于 60 分钟后失效，且只可使用一次。',
    security: '如你没有提出此请求，请忽略此邮件，你的密码不会被更改。请勿将此链接转发给任何人。',
  },
  en: {
    subject: 'Reset your Space8 password',
    title: 'Reset your password',
    intro: 'We received a request to reset the password for your Space8 account. Use the button below to set a new one.',
    button: 'Set a new password',
    fallback: 'If the button does not work, copy this link into your browser:',
    expiry: 'This link expires in 60 minutes and can be used once.',
    security: 'If you did not request this, ignore this email and your password will stay the same. Do not forward this link to anyone.',
  },
}

export function passwordResetLinkEmail(locale: EmailLayoutLocale, resetUrl: string): RenderedEmail {
  const c = RESET_COPY[locale]
  const href = escapeHtml(resetUrl)
  const body = [
    emailParagraph(c.intro),
    `<div style="margin:28px 0;">${emailButton(href, c.button)}</div>`,
    emailParagraph(c.expiry, { muted: true, small: true, center: true }),
    emailDivider(),
    emailParagraph(c.fallback, { muted: true, small: true }),
    `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:#22c55e;text-decoration:underline;">${href}</a></p>`,
    emailParagraph(c.security, { muted: true, small: true }),
  ].join('\n')

  return {
    subject: c.subject,
    html: renderEmailLayout({ locale, title: c.title, preheader: c.expiry, bodyHtml: body }),
    text: [c.title, '', c.intro, '', resetUrl, '', c.expiry, '', c.security].join('\n'),
  }
}

// ── Password changed notice ─────────────────────────────────────────────────

const CHANGED_COPY: Record<EmailLayoutLocale, {
  subject: string
  title: string
  body: (time: string) => string
  signedOut: string
  notYou: string
  button: string
}> = {
  'zh-HK': {
    subject: '你的 Space8 密碼已更新',
    title: '密碼已更新',
    body: (time) => `你的 Space8 帳戶密碼已於${time}更新。`,
    signedOut: '為保障帳戶安全，所有裝置已登出，請以新密碼重新登入。',
    notYou: '如非本人操作，請立即聯絡客服。',
    button: 'WhatsApp 聯絡客服',
  },
  'zh-CN': {
    subject: '你的 Space8 密码已更新',
    title: '密码已更新',
    body: (time) => `你的 Space8 账户密码已于${time}更新。`,
    signedOut: '为保障账户安全，所有设备已登出，请使用新密码重新登录。',
    notYou: '如非本人操作，请立即联系客服。',
    button: 'WhatsApp 联系客服',
  },
  en: {
    subject: 'Your Space8 password was changed',
    title: 'Password updated',
    body: (time) => `The password for your Space8 account was changed on ${time}.`,
    signedOut: 'For your security, every device has been signed out. Sign in again with your new password.',
    notYou: 'If this was not you, contact our support team right away.',
    button: 'Contact us on WhatsApp',
  },
}

export function passwordChangedEmail(locale: EmailLayoutLocale, changedAt: Date, whatsappUrl: string): RenderedEmail {
  const c = CHANGED_COPY[locale]
  const time = formatHkTime(changedAt, locale)
  const body = [
    emailParagraph(escapeHtml(c.body(time))),
    emailParagraph(c.signedOut, { muted: true }),
    emailDivider(),
    emailParagraph(`<strong style="color:#ffffff;">${c.notYou}</strong>`, { center: true }),
    `<div style="margin:20px 0 0;">${emailButton(escapeHtml(whatsappUrl), c.button)}</div>`,
  ].join('\n')

  return {
    subject: c.subject,
    html: renderEmailLayout({ locale, title: c.title, preheader: c.body(time), bodyHtml: body }),
    text: [c.title, '', c.body(time), c.signedOut, '', c.notYou, whatsappUrl].join('\n'),
  }
}

// ── Sign-in method explanation (account has no password) ────────────────────

const METHOD_COPY: Record<EmailLayoutLocale, {
  subject: string
  title: string
  intro: string
  how: (methods: string) => string
  noPassword: string
  button: string
  security: string
}> = {
  'zh-HK': {
    subject: '關於你的 Space8 登入方式',
    title: '你的帳戶無須密碼',
    intro: '我們收到重設你 Space8 帳戶密碼的要求，但此帳戶並未設定密碼。',
    how: (m) => `此帳戶可透過 ${m} 登入。請於登入頁面選擇相同方式。`,
    noPassword: '因此無須重設密碼，我們亦不會為你建立密碼。',
    button: '前往登入',
    security: '如你沒有提出此要求，可忽略此電郵，你的帳戶不會有任何變更。',
  },
  'zh-CN': {
    subject: '关于你的 Space8 登录方式',
    title: '你的账户无需密码',
    intro: '我们收到重设你 Space8 账户密码的请求，但此账户并未设定密码。',
    how: (m) => `此账户可通过 ${m} 登录。请在登录页面选择相同方式。`,
    noPassword: '因此无需重设密码，我们也不会为你建立密码。',
    button: '前往登录',
    security: '如你没有提出此请求，可忽略此邮件，你的账户不会有任何变更。',
  },
  en: {
    subject: 'How you sign in to Space8',
    title: 'Your account has no password',
    intro: 'We received a request to reset the password for your Space8 account, but this account does not use a password.',
    how: (m) => `You sign in with ${m}. Choose the same option on the sign-in page.`,
    noPassword: 'There is nothing to reset, and we have not created a password for you.',
    button: 'Go to sign in',
    security: 'If you did not request this, you can ignore this email. Nothing on your account has changed.',
  },
}

export function signInMethodEmail(locale: EmailLayoutLocale, methods: SignInMethod[], loginUrl: string): RenderedEmail {
  const c = METHOD_COPY[locale]
  const how = c.how(joinMethods(locale, methods))
  const body = [
    emailParagraph(c.intro),
    emailParagraph(escapeHtml(how)),
    emailParagraph(c.noPassword, { muted: true }),
    `<div style="margin:28px 0;">${emailButton(escapeHtml(loginUrl), c.button)}</div>`,
    emailParagraph(c.security, { muted: true, small: true }),
  ].join('\n')

  return {
    subject: c.subject,
    html: renderEmailLayout({ locale, title: c.title, preheader: c.intro, bodyHtml: body }),
    text: [c.title, '', c.intro, how, c.noPassword, '', loginUrl, '', c.security].join('\n'),
  }
}
