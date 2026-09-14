# Comprehensive Error Messages Implementation Plan

## Overview
This document outlines all error messages needed across the Space8 booking platform, organized by flow category. All messages will be implemented across 4 locales: zh-HK (default), zh-CN, en, ja.

## Error Message Structure
Each error follows a consistent pattern:
- **Key**: Unique identifier in messages/*.json
- **Context**: Where/when the error appears
- **User Impact**: What the user cannot do
- **Required Fields**: title, description, actionable_hint (where applicable)

---

## 1. BOOKING FLOW ERRORS (Highest Priority)

### 1.1 Slot Unavailability Errors

#### err_slot_unavailable_concurrent
**Context**: User tries to lock a slot that another user just booked
**API**: `/api/booking/lock` returns `{ error: 'Slot unavailable', reason: 'unavailable' }` (409)
```json
{
  "err_slot_unavailable_concurrent_title": "時段已被預訂",
  "err_slot_unavailable_concurrent_desc": "此時段剛被其他用戶預訂。請選擇其他時段或球枱。",
  "err_slot_unavailable_concurrent_hint": "建議：選擇相鄰時段或另一張球枱"
}
```

#### err_slot_booking_cutoff
**Context**: User tries to book within the cutoff window (too close to start time)
**API**: `/api/booking/lock` returns `{ error: 'Slot unavailable', reason: 'booking_cutoff' }` (409)
```json
{
  "err_slot_booking_cutoff_title": "時段已截止預訂",
  "err_slot_booking_cutoff_desc": "此時段距離開始時間太近，已無法預訂。",
  "err_slot_booking_cutoff_hint": "請選擇稍後的時段"
}
```

#### err_slot_lock_expired
**Context**: User's 15-minute lock expired before completing payment
**API**: `/api/payment/create-intent` returns `{ error: 'booking_expired', message: 'Slot lock no longer valid' }` (409)
```json
{
  "err_slot_lock_expired_title": "時段保留已過期",
  "err_slot_lock_expired_desc": "您的時段保留已超過 15 分鐘。請重新選擇時段。",
  "err_slot_lock_expired_hint": "提示：完成付款前，時段會為您保留 15 分鐘"
}
```

#### err_slot_multi_block_conflict
**Context**: User tries to lock multiple slots but some overlap or conflict
**API**: `/api/booking/lock` (multi-block) returns `{ error: 'Slot unavailable', reason: 'unavailable' }` with P0001 code (409)
```json
{
  "err_slot_multi_block_conflict_title": "部分時段無法預訂",
  "err_slot_multi_block_conflict_desc": "您選擇的時段中，有部分已被預訂或時間重疊。",
  "err_slot_multi_block_conflict_hint": "請檢查並重新選擇時段"
}
```

### 1.2 Lock/Session Management Errors

#### err_slot_already_locked
**Context**: Slot is temporarily locked by another user (shown on calendar UI)
**UI**: Table shows "locked" status in booking calendar
```json
{
  "err_slot_already_locked_title": "有人正在預訂",
  "err_slot_already_locked_desc": "此時段正被其他用戶暫時保留，請稍候片刻或選擇其他時段。",
  "err_slot_already_locked_hint": "時段鎖定通常在 15 分鐘內釋放"
}
```

#### err_lock_failed_server
**Context**: Server fails to execute find_or_lock_slot RPC
**API**: `/api/booking/lock` returns `{ error: 'Could not lock slot' }` (500)
```json
{
  "err_lock_failed_server_title": "無法保留時段",
  "err_lock_failed_server_desc": "系統暫時無法處理您的預訂，請稍後重試。",
  "err_lock_failed_server_hint": "如問題持續，請聯絡客服"
}
```

### 1.3 Validation Errors

#### err_invalid_slot_input
**Context**: Invalid date/time/duration/table parameters
**API**: `/api/booking/lock` returns `{ error: 'Invalid input' }` (400)
```json
{
  "err_invalid_slot_input_title": "無效的預訂參數",
  "err_invalid_slot_input_desc": "您選擇的日期、時間或時長無效，請重新選擇。",
  "err_invalid_slot_input_hint": "請確保選擇有效的日期和時段"
}
```

#### err_max_hours_exceeded
**Context**: User tries to book more than 6 hours in one slot
**UI**: Frontend validation before API call
```json
{
  "err_max_hours_exceeded_title": "超過最長時段",
  "err_max_hours_exceeded_desc": "單次預訂最多只能選擇 6 小時。",
  "err_max_hours_exceeded_hint": "如需更長時間，請分開預訂"
}
```

#### err_min_spend_not_met
**Context**: Booking doesn't meet minimum spend requirement
**API**: Future implementation for minimum spend validation
```json
{
  "err_min_spend_not_met_title": "未達最低消費",
  "err_min_spend_not_met_desc": "此時段要求最低消費 HK${amount}，當前選擇未達標。",
  "err_min_spend_not_met_hint": "請增加預訂時長或選擇其他時段"
}
```

### 1.4 Booking State Errors

#### err_booking_not_found
**Context**: Booking ID doesn't exist or user doesn't have access
**API**: Various endpoints return `{ error: 'Not found' }` (404)
```json
{
  "err_booking_not_found_title": "找不到預訂",
  "err_booking_not_found_desc": "此預訂不存在或您沒有權限查看。",
  "err_booking_not_found_hint": "請檢查預訂編號是否正確"
}
```

#### err_booking_already_confirmed
**Context**: User tries to modify a confirmed booking
```json
{
  "err_booking_already_confirmed_title": "預訂已確認",
  "err_booking_already_confirmed_desc": "此預訂已確認，無法再次修改。",
  "err_booking_already_confirmed_hint": "如需更改，請聯絡客服或申請退款"
}
```

#### err_booking_create_failed
**Context**: Server fails to create pending booking row
**API**: `/api/payment/create-intent` returns `{ error: 'Could not create booking' }` (500)
```json
{
  "err_booking_create_failed_title": "無法建立預訂",
  "err_booking_create_failed_desc": "系統暫時無法處理您的預訂，請重試。",
  "err_booking_create_failed_hint": "如問題持續，請聯絡客服"
}
```

---

## 2. PAYMENT FLOW ERRORS

### 2.1 Payment Intent Creation Errors

#### err_payment_intent_failed
**Context**: Stripe PaymentIntent creation fails
**API**: `/api/payment/create-intent` returns `{ error: 'stripe_error' }` (502)
```json
{
  "err_payment_intent_failed_title": "無法啟動付款",
  "err_payment_intent_failed_desc": "付款系統暫時無法處理您的請求，請稍後重試。",
  "err_payment_intent_failed_hint": "如問題持續，請聯絡客服"
}
```

#### err_payment_zero_amount
**Context**: Final amount is zero or negative after discount
**API**: `/api/payment/create-intent` returns `{ error: 'Zero-amount bookings are not supported' }` (400)
```json
{
  "err_payment_zero_amount_title": "金額無效",
  "err_payment_zero_amount_desc": "預訂金額為零或負數，無法繼續付款。",
  "err_payment_zero_amount_hint": "請重新選擇時段或聯絡客服"
}
```

### 2.2 Payment Processing Errors

#### err_payment_declined
**Context**: Card declined by bank/issuer
**Stripe**: Various decline codes (insufficient_funds, card_declined, etc.)
```json
{
  "err_payment_declined_title": "付款被拒絕",
  "err_payment_declined_desc": "您的付款方式被拒絕，請檢查卡片資料或使用其他付款方式。",
  "err_payment_declined_hint": "建議：檢查卡片餘額、有效期限或嘗試其他付款方式"
}
```

#### err_payment_insufficient_funds
**Context**: Specific decline: insufficient funds
**Stripe**: decline_code = "insufficient_funds"
```json
{
  "err_payment_insufficient_funds_title": "餘額不足",
  "err_payment_insufficient_funds_desc": "您的卡片餘額不足以完成此交易。",
  "err_payment_insufficient_funds_hint": "請使用其他付款方式或充值後重試"
}
```

#### err_payment_card_expired
**Context**: Card has expired
**Stripe**: decline_code = "expired_card"
```json
{
  "err_payment_card_expired_title": "卡片已過期",
  "err_payment_card_expired_desc": "您的信用卡或扣賬卡已過期，無法完成付款。",
  "err_payment_card_expired_hint": "請使用其他有效卡片"
}
```

#### err_payment_card_invalid
**Context**: Invalid card number or CVV
**Stripe**: decline_code = "invalid_card" or "incorrect_cvc"
```json
{
  "err_payment_card_invalid_title": "卡片資料無效",
  "err_payment_card_invalid_desc": "卡片號碼或安全碼不正確，請重新輸入。",
  "err_payment_card_invalid_hint": "請檢查卡片號碼、有效期限和 CVV"
}
```

#### err_payment_processing_error
**Context**: Generic payment processing failure
**Stripe**: processing_error or other non-specific errors
```json
{
  "err_payment_processing_error_title": "付款處理失敗",
  "err_payment_processing_error_desc": "付款過程中發生錯誤，未能完成交易。",
  "err_payment_processing_error_hint": "請重試或使用其他付款方式"
}
```

#### err_payment_timeout
**Context**: Payment takes too long to complete
**Recovery**: User sees timeout in recovery flow
```json
{
  "err_payment_timeout_title": "付款超時",
  "err_payment_timeout_desc": "付款處理時間較長，未能確認結果。",
  "err_payment_timeout_hint": "請檢查您的訂單記錄，如已扣款請勿重複付款"
}
```

### 2.3 KPay-Specific Errors

#### err_kpay_failed
**Context**: KPay payment fails (FPS/PayMe/Octopus)
**API**: KPay webhook or status check returns failure
```json
{
  "err_kpay_failed_title": "付款失敗",
  "err_kpay_failed_desc": "透過 {method} 的付款未能完成，請重新嘗試。",
  "err_kpay_failed_hint": "請確保完成付款操作，或選擇其他付款方式"
}
```

#### err_kpay_expired
**Context**: KPay QR code expired (15-minute timeout)
```json
{
  "err_kpay_expired_title": "二維碼已過期",
  "err_kpay_expired_desc": "付款二維碼已超過有效時間，請重新產生。",
  "err_kpay_expired_hint": "二維碼有效期為 15 分鐘"
}
```

#### err_kpay_cancelled
**Context**: User cancels KPay payment
```json
{
  "err_kpay_cancelled_title": "付款已取消",
  "err_kpay_cancelled_desc": "您已取消此次付款，預訂時段已釋放。",
  "err_kpay_cancelled_hint": "如需繼續預訂，請重新選擇時段"
}
```

### 2.4 Discount/Promo Errors

#### err_promo_invalid
**Context**: Promo code doesn't exist or is expired
**API**: `prepare_checkout` returns failure reason
```json
{
  "err_promo_invalid_title": "優惠碼無效",
  "err_promo_invalid_desc": "此優惠碼不存在或已過期，無法使用。",
  "err_promo_invalid_hint": "請檢查優惠碼是否正確"
}
```

#### err_promo_used
**Context**: User already used this promo code
```json
{
  "err_promo_used_title": "優惠碼已使用",
  "err_promo_used_desc": "您已使用過此優惠碼，無法重複使用。",
  "err_promo_used_hint": "每個優惠碼每位用戶只能使用一次"
}
```

#### err_promo_min_spend
**Context**: Order doesn't meet promo code minimum spend
```json
{
  "err_promo_min_spend_title": "未達優惠碼使用條件",
  "err_promo_min_spend_desc": "此優惠碼要求最低消費 HK${amount}，當前訂單未達標。",
  "err_promo_min_spend_hint": "請增加預訂時長或移除優惠碼"
}
```

#### err_points_insufficient
**Context**: User doesn't have enough points for redemption
**API**: `prepare_checkout` returns `{ error: 'insufficient_points', availablePoints: X }`
```json
{
  "err_points_insufficient_title": "積分不足",
  "err_points_insufficient_desc": "您的可用積分不足以兌換此優惠。當前可用：{available} 分，需要：{required} 分。",
  "err_points_insufficient_hint": "請選擇較低金額的兌換選項"
}
```

#### err_discount_invalid_amount
**Context**: Invalid points amount in request
**API**: `/api/payment/create-intent` validates pointsAmount
```json
{
  "err_discount_invalid_amount_title": "兌換金額無效",
  "err_discount_invalid_amount_desc": "積分兌換金額無效，請重新選擇。",
  "err_discount_invalid_amount_hint": "請選擇有效的兌換選項"
}
```

---

## 3. AUTH & OTP FLOW ERRORS

### 3.1 Authentication Errors

#### err_auth_required
**Context**: Anonymous user tries to access protected resource
**API**: Various endpoints return `{ error: 'Unauthorized' }` (401)
```json
{
  "err_auth_required_title": "需要登入",
  "err_auth_required_desc": "此操作需要登入帳戶，請先登入或註冊。",
  "err_auth_required_hint": "建議：使用電話號碼快速登入"
}
```

#### err_auth_session_expired
**Context**: User's session token expired
**Supabase**: Auth session validation fails
```json
{
  "err_auth_session_expired_title": "登入已過期",
  "err_auth_session_expired_desc": "您的登入狀態已過期，請重新登入。",
  "err_auth_session_expired_hint": "請重新登入以繼續"
}
```

#### err_auth_invalid_credentials
**Context**: Wrong password or identifier
**Supabase**: signInWithPassword fails
```json
{
  "err_auth_invalid_credentials_title": "帳號或密碼錯誤",
  "err_auth_invalid_credentials_desc": "您輸入的帳號或密碼不正確，請重新輸入。",
  "err_auth_invalid_credentials_hint": "建議：使用「忘記密碼」功能重設密碼"
}
```

### 3.2 OTP Verification Errors

#### err_otp_send_failed
**Context**: Engagelab SMS/Email send fails
**API**: `/api/auth/otp/send` returns failure
```json
{
  "err_otp_send_failed_title": "無法發送驗證碼",
  "err_otp_send_failed_desc": "驗證碼發送失敗，請稍後重試。",
  "err_otp_send_failed_hint": "如問題持續，請嘗試電郵驗證或聯絡客服"
}
```

#### err_otp_invalid
**Context**: Wrong OTP code entered
**Supabase**: verifyOtp fails with "invalid_otp"
```json
{
  "err_otp_invalid_title": "驗證碼錯誤",
  "err_otp_invalid_desc": "您輸入的驗證碼不正確，請重新輸入。",
  "err_otp_invalid_hint": "驗證碼區分大小寫，請檢查後重試"
}
```

#### err_otp_expired
**Context**: OTP code expired (5-minute window)
**Supabase**: verifyOtp fails with "expired_token"
```json
{
  "err_otp_expired_title": "驗證碼已過期",
  "err_otp_expired_desc": "驗證碼已超過有效時間（5 分鐘），請重新發送。",
  "err_otp_expired_hint": "請點擊「重新發送驗證碼」"
}
```

#### err_otp_rate_limited
**Context**: Too many OTP requests in short time
**API**: Rate limit on `/api/auth/otp/send`
```json
{
  "err_otp_rate_limited_title": "發送次數過多",
  "err_otp_rate_limited_desc": "您在短時間內發送過多驗證碼請求，請稍後再試。",
  "err_otp_rate_limited_hint": "請等待 {seconds} 秒後再試"
}
```

#### err_otp_too_many_attempts
**Context**: Too many wrong OTP attempts (account locked)
**Supabase**: Account temporarily locked after failed attempts
```json
{
  "err_otp_too_many_attempts_title": "嘗試次數過多",
  "err_otp_too_many_attempts_desc": "您輸入錯誤驗證碼次數過多，帳號已暫時鎖定。",
  "err_otp_too_many_attempts_hint": "請等待 {minutes} 分鐘後重試，或聯絡客服"
}
```

### 3.3 Signup/Profile Errors

#### err_signup_email_exists
**Context**: Email already registered
**Supabase**: signUp fails with "email_exists"
```json
{
  "err_signup_email_exists_title": "電郵已被註冊",
  "err_signup_email_exists_desc": "此電郵地址已被其他帳戶使用，請登入或使用其他電郵。",
  "err_signup_email_exists_hint": "建議：使用「忘記密碼」功能找回帳號"
}
```

#### err_signup_phone_exists
**Context**: Phone number already registered
**Supabase**: signUp fails with "phone_exists"
```json
{
  "err_signup_phone_exists_title": "電話號碼已被註冊",
  "err_signup_phone_exists_desc": "此電話號碼已被其他帳戶使用，請登入或使用其他號碼。",
  "err_signup_phone_exists_hint": "建議：嘗試使用驗證碼登入"
}
```

#### err_profile_incomplete
**Context**: User must complete profile before booking
**API**: `requireCompleteProfile` returns error
```json
{
  "err_profile_incomplete_title": "請完善個人資料",
  "err_profile_incomplete_desc": "預訂前需要完善個人資料（姓名、聯絡方式等）。",
  "err_profile_incomplete_hint": "請前往個人中心完善資料"
}
```

#### err_password_weak
**Context**: Password doesn't meet requirements
**Validation**: Frontend or backend password strength check
```json
{
  "err_password_weak_title": "密碼強度不足",
  "err_password_weak_desc": "密碼必須至少 8 個字符，包含大小寫字母和數字。",
  "err_password_weak_hint": "範例：Password123"
}
```

---

## 4. FORM VALIDATION ERRORS

### 4.1 Contact Information Errors

#### err_phone_invalid_format
**Context**: Invalid HK phone number format
**Validation**: Frontend regex check
```json
{
  "err_phone_invalid_format_title": "電話號碼格式錯誤",
  "err_phone_invalid_format_desc": "請輸入 8 位數字的香港電話號碼。",
  "err_phone_invalid_format_hint": "範例：6180 8022（不需要加 +852）"
}
```

#### err_email_invalid_format
**Context**: Invalid email format
**Validation**: Frontend regex check
```json
{
  "err_email_invalid_format_title": "電郵格式錯誤",
  "err_email_invalid_format_desc": "請輸入有效的電郵地址。",
  "err_email_invalid_format_hint": "範例：example@gmail.com"
}
```

#### err_contact_required
**Context**: Neither phone nor email provided
**Validation**: At least one contact method required
```json
{
  "err_contact_required_title": "需要聯絡方式",
  "err_contact_required_desc": "請提供至少一種聯絡方式（電話或電郵）。",
  "err_contact_required_hint": "建議：提供電話號碼以接收預訂通知"
}
```

### 4.2 Required Field Errors

#### err_name_required
**Context**: Name field empty on signup/profile
```json
{
  "err_name_required_title": "請輸入姓名",
  "err_name_required_desc": "姓名為必填項目，請輸入您的真實姓名。",
  "err_name_required_hint": "姓名將顯示在預訂憑證上"
}
```

#### err_terms_not_accepted
**Context**: User didn't accept terms before payment
**Validation**: Frontend checkbox validation
```json
{
  "err_terms_not_accepted_title": "請同意條款",
  "err_terms_not_accepted_desc": "繼續付款前，請先閱讀並同意場地使用守則及條款與細則。",
  "err_terms_not_accepted_hint": "請勾選同意選項"
}
```

---

## 5. SYSTEM & NETWORK ERRORS

### 5.1 Rate Limiting Errors

#### err_rate_limit_exceeded
**Context**: Too many requests from user
**API**: Various endpoints return `{ error: 'Too many requests' }` (429)
```json
{
  "err_rate_limit_exceeded_title": "請求過於頻繁",
  "err_rate_limit_exceeded_desc": "您的操作過於頻繁，請稍後再試。",
  "err_rate_limit_exceeded_hint": "請等待 {seconds} 秒後重試"
}
```

### 5.2 Network/Connection Errors

#### err_network_timeout
**Context**: Request times out (client-side)
```json
{
  "err_network_timeout_title": "連線逾時",
  "err_network_timeout_desc": "網絡連線逾時，請檢查網絡後重試。",
  "err_network_timeout_hint": "請確保網絡連線穩定"
}
```

#### err_network_offline
**Context**: Client is offline
```json
{
  "err_network_offline_title": "無網絡連線",
  "err_network_offline_desc": "目前無法連線至網絡，請檢查您的網絡設定。",
  "err_network_offline_hint": "請連接 Wi-Fi 或移動數據後重試"
}
```

#### err_network_generic
**Context**: Generic network error
```json
{
  "err_network_generic_title": "網絡錯誤",
  "err_network_generic_desc": "網絡連線出現問題，請重試。",
  "err_network_generic_hint": "如問題持續，請檢查網絡設定或聯絡客服"
}
```

### 5.3 Server Errors

#### err_server_error
**Context**: Generic 500 error
**API**: Various endpoints return `{ error: 'Internal error' }` (500)
```json
{
  "err_server_error_title": "伺服器錯誤",
  "err_server_error_desc": "伺服器暫時無法處理您的請求，請稍後重試。",
  "err_server_error_hint": "如問題持續，請聯絡客服"
}
```

#### err_service_unavailable
**Context**: Service temporarily down (503)
```json
{
  "err_service_unavailable_title": "服務暫時無法使用",
  "err_service_unavailable_desc": "系統正在維護中，請稍後再試。",
  "err_service_unavailable_hint": "預計維護時間：{duration}"
}
```

#### err_database_error
**Context**: Database query fails
```json
{
  "err_database_error_title": "資料庫錯誤",
  "err_database_error_desc": "資料讀取失敗，請重試。",
  "err_database_error_hint": "如問題持續，請聯絡客服"
}
```

---

## 6. REFUND & RESCHEDULE ERRORS

### 6.1 Refund Errors

#### err_refund_cutoff_closed
**Context**: Refund requested after cutoff window
**API**: `/api/bookings/[id]/refund` returns `{ error: 'Refund window closed', reason: 'cutoff_closed' }` (403)
```json
{
  "err_refund_cutoff_closed_title": "退款期限已過",
  "err_refund_cutoff_closed_desc": "此預訂已超過退款期限，無法辦理退款。",
  "err_refund_cutoff_closed_hint": "退款須在預訂時間 {hours} 小時前提出"
}
```

#### err_refund_not_allowed
**Context**: Booking state doesn't allow refund
**API**: `/api/bookings/[id]/refund` returns `{ error: 'Refund not allowed', reason: 'not_refundable' }` (403)
```json
{
  "err_refund_not_allowed_title": "無法退款",
  "err_refund_not_allowed_desc": "此預訂目前狀態不允許退款。",
  "err_refund_not_allowed_hint": "如有疑問，請聯絡客服"
}
```

#### err_refund_already_processed
**Context**: Booking already refunded
```json
{
  "err_refund_already_processed_title": "已退款",
  "err_refund_already_processed_desc": "此預訂已完成退款，無法重複操作。",
  "err_refund_already_processed_hint": "退款通常在 5-7 個工作天內到帳"
}
```

#### err_refund_pending_review
**Context**: Refund requires manual review
**API**: `/api/bookings/[id]/refund` returns `{ error: 'refund_pending_manual_review' }` (202)
```json
{
  "err_refund_pending_review_title": "退款審核中",
  "err_refund_pending_review_desc": "您的退款申請已提交，我們會盡快處理。",
  "err_refund_pending_review_hint": "預計處理時間：1-2 個工作天"
}
```

### 6.2 Reschedule Errors

#### err_reschedule_cutoff_closed
**Context**: Reschedule requested too close to booking time
**API**: `/api/bookings/[id]/reschedule` returns `{ error: 'Slot unavailable', reason: 'booking_cutoff' }` (409)
```json
{
  "err_reschedule_cutoff_closed_title": "無法改期",
  "err_reschedule_cutoff_closed_desc": "預訂時間太近，已無法改期。",
  "err_reschedule_cutoff_closed_hint": "改期須在預訂時間 {hours} 小時前提出"
}
```

#### err_reschedule_not_allowed
**Context**: Booking state doesn't allow reschedule
**API**: `/api/bookings/[id]/reschedule` returns `{ error: 'Reschedule not allowed', reason: 'not_reschedulable' }` (403)
```json
{
  "err_reschedule_not_allowed_title": "無法改期",
  "err_reschedule_not_allowed_desc": "此預訂目前狀態不允許改期。",
  "err_reschedule_not_allowed_hint": "如需更改，請聯絡客服"
}
```

#### err_reschedule_target_unavailable
**Context**: Target slot unavailable for reschedule
**API**: `/api/bookings/[id]/reschedule` returns `{ error: 'Slot unavailable', reason: 'unavailable' }` (409)
```json
{
  "err_reschedule_target_unavailable_title": "新時段不可用",
  "err_reschedule_target_unavailable_desc": "您選擇的新時段已被預訂，請選擇其他時段。",
  "err_reschedule_target_unavailable_hint": "建議：選擇鄰近時段"
}
```

---

## 7. ADMIN & TEST MODE ERRORS

### 7.1 Authorization Errors

#### err_admin_required
**Context**: Non-admin tries to access admin endpoint
**API**: UAT endpoints return `{ error: 'Not authorized' }` (403)
```json
{
  "err_admin_required_title": "需要管理員權限",
  "err_admin_required_desc": "此操作需要管理員權限，您沒有存取權限。",
  "err_admin_required_hint": "請聯絡系統管理員"
}
```

#### err_uat_access_denied
**Context**: IP not whitelisted for UAT environment
```json
{
  "err_uat_access_denied_title": "UAT 環境存取被拒",
  "err_uat_access_denied_desc": "您的 IP 地址未在白名單中，無法存取 UAT 環境。",
  "err_uat_access_denied_hint": "請聯絡系統管理員加入白名單"
}
```

### 7.2 Test Booking Errors

#### err_test_booking_refund_failed
**Context**: Test booking refund fails
**API**: `/api/uat/test-bookings/refund` returns error
```json
{
  "err_test_booking_refund_failed_title": "測試訂單退款失敗",
  "err_test_booking_refund_failed_desc": "無法處理測試訂單退款，請檢查訂單狀態。",
  "err_test_booking_refund_failed_hint": "僅限 is_test = true 的訂單可透過此功能退款"
}
```

---

## Implementation Priority

### Phase 1: Critical Booking Flow (Week 1)
- [ ] All Section 1 errors (Slot unavailability, locking, validation)
- [ ] Section 2.1-2.2 (Payment intent, processing)
- [ ] Section 3.1 (Authentication required)

### Phase 2: Payment & Auth (Week 2)
- [ ] Section 2.3-2.4 (KPay, discounts)
- [ ] Section 3.2-3.3 (OTP, profile)
- [ ] Section 4 (Form validation)

### Phase 3: System & Recovery (Week 3)
- [ ] Section 5 (Network, rate limiting, server errors)
- [ ] Section 6 (Refund, reschedule)
- [ ] Section 7 (Admin)

---

## Translation Requirements

For each error defined above, create translations in:
1. **zh-HK** (Traditional Chinese, Hong Kong) - BASE VERSION SHOWN ABOVE
2. **zh-CN** (Simplified Chinese, Mainland)
3. **en** (English)
4. **ja** (Japanese)

### Translation Guidelines:
- Maintain consistent tone: empathetic, professional, actionable
- Keep hints concise (1 line max)
- Preserve placeholder syntax: `{amount}`, `{time}`, `{method}`, etc.
- Adapt culturally appropriate examples (phone formats, currency, etc.)

---

## Next Steps

1. **Review & Approve** this comprehensive list with stakeholders
2. **Generate translations** for all 4 locales
3. **Update message files**: `messages/zh-HK.json`, `messages/zh-CN.json`, `messages/en.json`, `messages/ja.json`
4. **Implement in UI**: Replace all hardcoded error strings with these keys
5. **Test coverage**: Ensure all error scenarios are covered in E2E tests