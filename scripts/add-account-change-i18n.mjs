#!/usr/bin/env node
/**
 * Adds i18n keys for the mandatory-password-setup and secure phone/password
 * change flows. Idempotent: existing keys are never overwritten.
 *
 * Usage: node scripts/add-account-change-i18n.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES = join(__dirname, '..', 'messages')

// zh-HK is 書面語 (no 嘅 喺 咁 佢 哋 咗 俾). zh-CN is simplified equivalent.
const auth = {
  'zh-HK': {
    set_password_title: '設定密碼',
    set_password_subtitle: '為保障帳戶安全，請設定密碼以繼續使用。',
    set_password_button: '設定密碼',
    password_label: '密碼',
    new_password_label: '新密碼',
    confirm_password_label: '確認密碼',
    err_passwords_mismatch: '兩次輸入的密碼不相同。',
    err_password_too_weak: '密碼至少 8 個字元，並須包含字母及數字。',
    err_password_same_as_old: '新密碼不可與舊密碼相同。',
    err_session_expired: '登入狀態已失效，請重新登入。',
    validating_token: '正在驗證連結⋯',
    back_to_settings: '返回設定',
    change_password_title: '更改密碼',
    change_password_subtitle: '請輸入你的新密碼。',
    change_password_button: '更改密碼',
    change_password_invalid_title: '連結無效',
    change_password_invalid_message: '此連結無效，請從設定頁面重新申請。',
    change_password_expired_title: '連結已過期',
    change_password_expired_message: '此連結已過期，請從設定頁面重新申請。',
    change_password_used_title: '連結已使用',
    change_password_used_message: '此連結已使用過，請從設定頁面重新申請。',
    change_password_wrong_user_title: '帳戶不符',
    change_password_wrong_user_message: '此連結並非發給目前登入的帳戶。',
    password_changed_title: '密碼已更改',
    password_changed_message: '你的密碼已成功更改，其他裝置的登入狀態已登出。',
    change_phone_title: '更改電話號碼',
    change_phone_subtitle: '請輸入你的新電話號碼，我們會發送驗證碼。',
    current_phone_label: '目前電話號碼',
    new_phone_label: '新電話號碼',
    send_otp_button: '發送驗證碼',
    verify_new_phone_title: '驗證新號碼',
    verify_new_phone_subtitle: '驗證碼已發送至 {phone}',
    err_phone_format: '請輸入有效的香港電話號碼。',
    err_phone_same_as_current: '新號碼與目前號碼相同。',
    err_phone_in_use: '此號碼無法使用，請輸入其他號碼。',
    err_otp_invalid: '驗證碼不正確，尚可嘗試 {attempts} 次。',
    change_phone_invalid_title: '連結無效',
    change_phone_invalid_message: '此連結無效，請從設定頁面重新申請。',
    change_phone_expired_title: '連結已過期',
    change_phone_expired_message: '此連結已過期，請從設定頁面重新申請。',
    change_phone_used_title: '連結已使用',
    change_phone_used_message: '此連結已使用過，請從設定頁面重新申請。',
    change_phone_wrong_user_title: '帳戶不符',
    change_phone_wrong_user_message: '此連結並非發給目前登入的帳戶。',
    phone_changed_title: '電話號碼已更改',
    phone_changed_message: '你的電話號碼已成功更改。',
  },
  'zh-CN': {
    set_password_title: '设置密码',
    set_password_subtitle: '为保障账户安全，请设置密码以继续使用。',
    set_password_button: '设置密码',
    password_label: '密码',
    new_password_label: '新密码',
    confirm_password_label: '确认密码',
    err_passwords_mismatch: '两次输入的密码不相同。',
    err_password_too_weak: '密码至少 8 个字符，并须包含字母及数字。',
    err_password_same_as_old: '新密码不可与旧密码相同。',
    err_session_expired: '登录状态已失效，请重新登录。',
    validating_token: '正在验证链接⋯',
    back_to_settings: '返回设置',
    change_password_title: '更改密码',
    change_password_subtitle: '请输入你的新密码。',
    change_password_button: '更改密码',
    change_password_invalid_title: '链接无效',
    change_password_invalid_message: '此链接无效，请从设置页面重新申请。',
    change_password_expired_title: '链接已过期',
    change_password_expired_message: '此链接已过期，请从设置页面重新申请。',
    change_password_used_title: '链接已使用',
    change_password_used_message: '此链接已使用过，请从设置页面重新申请。',
    change_password_wrong_user_title: '账户不符',
    change_password_wrong_user_message: '此链接并非发给当前登录的账户。',
    password_changed_title: '密码已更改',
    password_changed_message: '你的密码已成功更改，其他设备的登录状态已退出。',
    change_phone_title: '更改电话号码',
    change_phone_subtitle: '请输入你的新电话号码，我们会发送验证码。',
    current_phone_label: '当前电话号码',
    new_phone_label: '新电话号码',
    send_otp_button: '发送验证码',
    verify_new_phone_title: '验证新号码',
    verify_new_phone_subtitle: '验证码已发送至 {phone}',
    err_phone_format: '请输入有效的香港电话号码。',
    err_phone_same_as_current: '新号码与当前号码相同。',
    err_phone_in_use: '此号码无法使用，请输入其他号码。',
    err_otp_invalid: '验证码不正确，还可尝试 {attempts} 次。',
    change_phone_invalid_title: '链接无效',
    change_phone_invalid_message: '此链接无效，请从设置页面重新申请。',
    change_phone_expired_title: '链接已过期',
    change_phone_expired_message: '此链接已过期，请从设置页面重新申请。',
    change_phone_used_title: '链接已使用',
    change_phone_used_message: '此链接已使用过，请从设置页面重新申请。',
    change_phone_wrong_user_title: '账户不符',
    change_phone_wrong_user_message: '此链接并非发给当前登录的账户。',
    phone_changed_title: '电话号码已更改',
    phone_changed_message: '你的电话号码已成功更改。',
  },
  en: {
    set_password_title: 'Set a password',
    set_password_subtitle: 'To keep your account secure, please set a password to continue.',
    set_password_button: 'Set password',
    password_label: 'Password',
    new_password_label: 'New password',
    confirm_password_label: 'Confirm password',
    err_passwords_mismatch: 'The two passwords do not match.',
    err_password_too_weak: 'Password must be at least 8 characters and include a letter and a number.',
    err_password_same_as_old: 'New password must be different from your current one.',
    err_session_expired: 'Your session has expired. Please sign in again.',
    validating_token: 'Verifying link…',
    back_to_settings: 'Back to settings',
    change_password_title: 'Change password',
    change_password_subtitle: 'Enter your new password.',
    change_password_button: 'Change password',
    change_password_invalid_title: 'Invalid link',
    change_password_invalid_message: 'This link is not valid. Please request a new one from settings.',
    change_password_expired_title: 'Link expired',
    change_password_expired_message: 'This link has expired. Please request a new one from settings.',
    change_password_used_title: 'Link already used',
    change_password_used_message: 'This link has already been used. Please request a new one from settings.',
    change_password_wrong_user_title: 'Account mismatch',
    change_password_wrong_user_message: 'This link was not issued to the account you are signed in to.',
    password_changed_title: 'Password changed',
    password_changed_message: 'Your password has been changed. Other devices have been signed out.',
    change_phone_title: 'Change phone number',
    change_phone_subtitle: 'Enter your new phone number and we will send a verification code.',
    current_phone_label: 'Current phone number',
    new_phone_label: 'New phone number',
    send_otp_button: 'Send code',
    verify_new_phone_title: 'Verify new number',
    verify_new_phone_subtitle: 'Code sent to {phone}',
    err_phone_format: 'Please enter a valid Hong Kong phone number.',
    err_phone_same_as_current: 'This is already your current number.',
    err_phone_in_use: 'This number cannot be used. Please enter a different one.',
    err_otp_invalid: 'Incorrect code. {attempts} attempts remaining.',
    change_phone_invalid_title: 'Invalid link',
    change_phone_invalid_message: 'This link is not valid. Please request a new one from settings.',
    change_phone_expired_title: 'Link expired',
    change_phone_expired_message: 'This link has expired. Please request a new one from settings.',
    change_phone_used_title: 'Link already used',
    change_phone_used_message: 'This link has already been used. Please request a new one from settings.',
    change_phone_wrong_user_title: 'Account mismatch',
    change_phone_wrong_user_message: 'This link was not issued to the account you are signed in to.',
    phone_changed_title: 'Phone number changed',
    phone_changed_message: 'Your phone number has been changed successfully.',
  },
  ja: {
    set_password_title: 'パスワードを設定',
    set_password_subtitle: 'アカウントを保護するため、パスワードを設定してください。',
    set_password_button: 'パスワードを設定',
    password_label: 'パスワード',
    new_password_label: '新しいパスワード',
    confirm_password_label: 'パスワードの確認',
    err_passwords_mismatch: 'パスワードが一致しません。',
    err_password_too_weak: 'パスワードは8文字以上で、英字と数字を含めてください。',
    err_password_same_as_old: '新しいパスワードは現在のものと異なる必要があります。',
    err_session_expired: 'セッションが期限切れです。再度ログインしてください。',
    validating_token: 'リンクを確認中⋯',
    back_to_settings: '設定に戻る',
    change_password_title: 'パスワードを変更',
    change_password_subtitle: '新しいパスワードを入力してください。',
    change_password_button: 'パスワードを変更',
    change_password_invalid_title: '無効なリンク',
    change_password_invalid_message: 'このリンクは無効です。設定から再度申請してください。',
    change_password_expired_title: 'リンクの有効期限切れ',
    change_password_expired_message: 'このリンクは期限切れです。設定から再度申請してください。',
    change_password_used_title: '使用済みのリンク',
    change_password_used_message: 'このリンクは既に使用されています。設定から再度申請してください。',
    change_password_wrong_user_title: 'アカウント不一致',
    change_password_wrong_user_message: 'このリンクは現在ログイン中のアカウント宛ではありません。',
    password_changed_title: 'パスワードを変更しました',
    password_changed_message: 'パスワードを変更しました。他の端末からはログアウトされました。',
    change_phone_title: '電話番号を変更',
    change_phone_subtitle: '新しい電話番号を入力してください。確認コードを送信します。',
    current_phone_label: '現在の電話番号',
    new_phone_label: '新しい電話番号',
    send_otp_button: 'コードを送信',
    verify_new_phone_title: '新しい番号を確認',
    verify_new_phone_subtitle: '{phone} にコードを送信しました',
    err_phone_format: '有効な香港の電話番号を入力してください。',
    err_phone_same_as_current: '現在の番号と同じです。',
    err_phone_in_use: 'この番号は使用できません。別の番号を入力してください。',
    err_otp_invalid: 'コードが正しくありません。残り {attempts} 回。',
    change_phone_invalid_title: '無効なリンク',
    change_phone_invalid_message: 'このリンクは無効です。設定から再度申請してください。',
    change_phone_expired_title: 'リンクの有効期限切れ',
    change_phone_expired_message: 'このリンクは期限切れです。設定から再度申請してください。',
    change_phone_used_title: '使用済みのリンク',
    change_phone_used_message: 'このリンクは既に使用されています。設定から再度申請してください。',
    change_phone_wrong_user_title: 'アカウント不一致',
    change_phone_wrong_user_message: 'このリンクは現在ログイン中のアカウント宛ではありません。',
    phone_changed_title: '電話番号を変更しました',
    phone_changed_message: '電話番号を変更しました。',
  },
}

const memberPage = {
  'zh-HK': {
    settings_change_phone: '更改電話',
    settings_change_link_sent: '驗證連結已發送至你的電郵，請於 30 分鐘內開啟連結完成更改。',
    settings_change_resend_in: '{seconds} 秒後可重新發送',
    settings_change_rate_limited: '申請次數過多，請稍後再試。',
    settings_change_no_email: '你的帳戶未綁定電郵，請聯絡我們協助更改。',
  },
  'zh-CN': {
    settings_change_phone: '更改电话',
    settings_change_link_sent: '验证链接已发送至你的邮箱，请于 30 分钟内打开链接完成更改。',
    settings_change_resend_in: '{seconds} 秒后可重新发送',
    settings_change_rate_limited: '申请次数过多，请稍后再试。',
    settings_change_no_email: '你的账户未绑定邮箱，请联系我们协助更改。',
  },
  en: {
    settings_change_phone: 'Change phone',
    settings_change_link_sent:
      'A verification link has been sent to your email. Open it within 30 minutes to complete the change.',
    settings_change_resend_in: 'Resend available in {seconds}s',
    settings_change_rate_limited: 'Too many requests. Please try again later.',
    settings_change_no_email: 'Your account has no email address. Please contact us for help.',
  },
  ja: {
    settings_change_phone: '電話番号を変更',
    settings_change_link_sent:
      '確認リンクをメールに送信しました。30分以内にリンクを開いて変更を完了してください。',
    settings_change_resend_in: '{seconds}秒後に再送信できます',
    settings_change_rate_limited: 'リクエストが多すぎます。しばらくしてからお試しください。',
    settings_change_no_email: 'アカウントにメールアドレスが登録されていません。お問い合わせください。',
  },
}

let totalAdded = 0

for (const locale of Object.keys(auth)) {
  const file = join(MESSAGES, `${locale}.json`)
  const json = JSON.parse(readFileSync(file, 'utf-8'))
  let added = 0

  for (const [ns, values] of [
    ['auth', auth[locale]],
    ['memberPage', memberPage[locale]],
  ]) {
    if (!json[ns]) json[ns] = {}
    for (const [key, value] of Object.entries(values)) {
      if (!(key in json[ns])) {
        json[ns][key] = value
        added++
      }
    }
  }

  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf-8')
  console.log(`${locale}: +${added} keys`)
  totalAdded += added
}

console.log(`\nTotal keys added: ${totalAdded}`)
