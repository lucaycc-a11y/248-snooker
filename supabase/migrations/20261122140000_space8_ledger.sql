-- SPACE8 費用帳 (/admin/space8): 開發費用、資本、Claim 扣減。
-- 數據來自 SPACE8_Fee.xlsx（AI Usage + Other Expenses 共 58 行，總額 HKD 14,437）。
-- Claim = 向公司申請返還的金額，只用來扣減「未 Claim」，不計入開支。
-- RLS 已開、無 policy：只有 service role（server routes）可讀寫。

create table if not exists public.space8_expenses (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ai', 'other')),
  spent_on date not null,
  item text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.space8_claims (
  id uuid primary key default gen_random_uuid(),
  claimed_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_to text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.space8_capital (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists space8_expenses_spent_on_idx on public.space8_expenses (spent_on);
create index if not exists space8_claims_claimed_on_idx on public.space8_claims (claimed_on);

alter table public.space8_expenses enable row level security;
alter table public.space8_claims enable row level security;
alter table public.space8_capital enable row level security;

-- 只在空表時匯入 Excel 數據，重跑 migration 不會重複。
do $seed$
begin
  if not exists (select 1 from public.space8_expenses) then
    insert into public.space8_expenses (kind, spent_on, item, amount, paid_by, note) values
    ('ai', '2026-06-25', 'AI Usage', 11, 'Luca Y.', NULL),
    ('ai', '2026-06-25', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-06-28', 'AI Usage', 54, 'Luca Y.', NULL),
    ('ai', '2026-06-28', 'AI Usage', 102, 'Luca Y.', NULL),
    ('ai', '2026-06-29', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-06-30', 'AI Usage', 131, 'Luca Y.', NULL),
    ('ai', '2026-06-30', 'AI Usage', 57, 'Luca Y.', NULL),
    ('ai', '2026-07-01', 'AI Usage', 236, 'Luca Y.', NULL),
    ('ai', '2026-07-01', 'AI Usage', 236, 'Luca Y.', NULL),
    ('ai', '2026-07-02', 'AI Usage', 259, 'Luca Y.', NULL),
    ('ai', '2026-07-03', 'AI Usage', 128, 'Luca Y.', NULL),
    ('ai', '2026-07-12', 'AI Usage', 237, 'Luca Y.', NULL),
    ('ai', '2026-07-15', 'AI Usage', 257, 'Luca Y.', NULL),
    ('ai', '2026-07-24', 'AI Usage', 264, 'Luca Y.', NULL),
    ('ai', '2026-08-17', 'AI Usage', 139, 'Luca Y.', NULL),
    ('ai', '2026-08-17', 'AI Usage', 68, 'Luca Y.', NULL),
    ('ai', '2026-08-18', 'AI Usage', 140, 'Luca Y.', NULL),
    ('ai', '2026-08-19', 'AI Usage', 258, 'Luca Y.', NULL),
    ('ai', '2026-08-20', 'AI Usage', 234, 'Luca Y.', NULL),
    ('ai', '2026-08-21', 'AI Usage', 227, 'Luca Y.', NULL),
    ('ai', '2026-08-28', 'AI Usage', 227, 'Luca Y.', NULL),
    ('ai', '2026-08-29', 'AI Usage', 227, 'Luca Y.', NULL),
    ('ai', '2026-09-05', 'AI Usage', 227, 'Luca Y.', NULL),
    ('ai', '2026-09-14', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-09-15', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-09-23', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-09-24', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-09-26', 'AI Usage', 251, 'Luca Y.', NULL),
    ('ai', '2026-09-29', 'AI Usage', 160, 'Luca Y.', NULL),
    ('ai', '2026-09-29', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-01', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Alvin Y.', NULL),
    ('ai', '2026-10-02', 'AI Usage', 235, 'Luca Y.', NULL),
    ('ai', '2026-10-03', 'AI Usage', 590, 'Luca Y.', NULL),
    ('ai', '2026-10-04', 'AI Usage', 354, 'Luca Y.', NULL),
    ('other', '2026-06-01', 'Claude Pro', 156, 'Luca Y.', NULL),
    ('other', '2026-06-16', 'Apple Developer', 788, 'Keri L.', NULL),
    ('other', '2026-07-01', 'Claude Pro', 156, 'Luca Y.', NULL),
    ('other', '2026-07-22', 'Kimi Monthly Fee', 172, 'Luca Y.', NULL),
    ('other', '2026-08-01', 'Claude Pro', 156, 'Luca Y.', NULL),
    ('other', '2026-08-20', 'SMS OTP', 80, 'Luca Y.', NULL),
    ('other', '2026-08-23', 'Kimi Monthly Fee', 172, 'Luca Y.', NULL),
    ('other', '2026-08-31', 'Kimi Monthly Fee', 268, 'Luca Y.', NULL),
    ('other', '2026-09-09', 'GoDaddy server', 131, 'Luca Y.', NULL),
    ('other', '2026-09-09', 'GoDaddy server', 131, 'Keri L.', NULL),
    ('other', '2026-09-10', 'SPACE8 Tee', 2800, 'Alvin Y.', NULL),
    ('other', '2026-10-24', 'SPACE8 Web testing (KPay)', 322, 'Luca Y.', NULL),
    ('other', '2026-10-24', 'SPACE8 Web testing (KPay)', 36, 'Alvin Y.', NULL),
    ('other', '2026-10-26', 'SPACE8 Web testing (KPay)', 36, 'Luca Y.', NULL),
    ('other', '2026-10-28', 'SPACE8 Web testing (KPay)', 36, 'Luca Y.', NULL),
    ('other', '2026-11-10', 'Xiaomi Mimo', 47, 'Alvin Y.', NULL),
    ('other', '2026-10-06', 'Xiaomi Mimo', 115, 'Luca Y.', NULL),
    ('other', '2026-08-01', 'Claude Pro', 156, 'Luca Y.', 'Excel 內與較早一行完全相同（No.5 重複），請確認是否重複輸入');
  end if;
  if not exists (select 1 from public.space8_capital) then
    insert into public.space8_capital (received_on, amount, note)
    values ('2026-10-19', 20000, '原 Excel 資本');
  end if;
end
$seed$;
