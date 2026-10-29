-- CS 中心 (customer-support centre): cases, notes, email OTP identity checks, hosted-cashier
-- payment links and reply templates. Service role only (RLS on, no policies).

create table if not exists public.cs_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  category text not null default 'other' check (category in ('payment', 'booking', 'account', 'website', 'other')),
  subject text not null,
  detail text,
  user_id uuid,
  customer_email text,
  booking_code text,
  website_issue boolean not null default false,
  owner_notified_at timestamptz,
  created_by text not null,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists cs_cases_status_idx on public.cs_cases (status, created_at desc);
create index if not exists cs_cases_user_idx on public.cs_cases (user_id);
alter table public.cs_cases enable row level security;

create table if not exists public.cs_case_notes (
  id bigserial primary key,
  case_id uuid not null references public.cs_cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null,
  kind text not null default 'note' check (kind in ('note', 'otp', 'payment_link', 'reply', 'spark', 'system')),
  body text not null
);
create index if not exists cs_case_notes_case_idx on public.cs_case_notes (case_id, created_at);
alter table public.cs_case_notes enable row level security;

create table if not exists public.cs_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_by text not null,
  case_id uuid references public.cs_cases(id) on delete set null
);
create index if not exists cs_otp_user_idx on public.cs_otp_challenges (user_id, created_at desc);
alter table public.cs_otp_challenges enable row level security;

create table if not exists public.cs_payment_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null,
  case_id uuid references public.cs_cases(id) on delete set null,
  user_id uuid not null,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  managed_order_no text,
  amount numeric(10,2) not null,
  note text
);
create index if not exists cs_payment_links_booking_idx on public.cs_payment_links (booking_id);
alter table public.cs_payment_links enable row level security;

create table if not exists public.cs_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  category text not null default 'other' check (category in ('payment', 'booking', 'account', 'website', 'other')),
  body text not null,
  updated_by text
);
alter table public.cs_templates enable row level security;

insert into public.cs_templates (title, category, body) values
  ('付款後未收到確認', 'payment',
   E'你好 {{name}}，\n多謝你聯絡 Space8。我哋已經幫你查過付款紀錄，{{result}}。\n如果仲未收到確認電郵，請先檢查垃圾郵件匣；我哋亦已經重新發送一次確認電郵俾你。\n有任何問題隨時 WhatsApp 我哋。\nSpace8 客務團隊'),
  ('付款失敗 / 重複扣款', 'payment',
   E'你好 {{name}}，\n對於今次付款不順，我哋非常抱歉。我哋已核對 KPay 記錄：{{result}}。\n如有重複扣款，我哋會安排退款，款項通常 3–7 個工作天內回到原付款方式。\nSpace8 客務團隊'),
  ('網站暫時無法使用 — 付款連結', 'website',
   E'你好 {{name}}，\n我哋網站暫時未能正常使用，對你造成不便，十分抱歉。\n我哋已為你預留時段，請用以下連結完成付款，付款成功後系統會自動確認預約並電郵確認書：\n{{link}}\n連結有效時間較短，如過期請通知我哋重新發出。\nSpace8 客務團隊'),
  ('身份核對（電郵驗證碼）', 'account',
   E'你好 {{name}}，\n為保障你的帳戶安全，我哋剛向你登記的電郵發出一個 6 位數驗證碼，請把驗證碼告知我哋，以便核對身份。驗證碼 10 分鐘內有效，請勿向其他人透露。\nSpace8 客務團隊'),
  ('預約改期 / 取消', 'booking',
   E'你好 {{name}}，\n已收到你嘅要求。預約 {{code}} 我哋已按條款處理：{{result}}。\n如需再調整，請提早 WhatsApp 通知我哋。\nSpace8 客務團隊'),
  ('問題已修復', 'other',
   E'你好 {{name}}，\n你反映嘅問題已經處理好：{{result}}。多謝你嘅耐心等候，如再遇到任何情況，請隨時聯絡我哋。\nSpace8 客務團隊');
