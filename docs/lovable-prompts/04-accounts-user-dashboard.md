# Phase 4 — Accounts (4-digit email code), roles, user dashboard, edit archive

## Roles
```sql
create type public.app_role as enum ('admin','basic','friend','colleague','loyal','father','mother');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, role public.app_role not null, unique (user_id, role));
create function public.has_role(_user uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user and role = _role) $$;
create table public.profiles (id uuid primary key references auth.users on delete cascade, full_name text not null, email text not null, phone text, created_at timestamptz not null default now());
```
- New users get `basic` automatically (trigger on `auth.users` insert). Roles are only ever changed by an admin (phase 5). Never store roles on `profiles`; never check roles client-side for security.
- `admin` is granted by seeding the owner's email (secret `ADMIN_EMAIL`): a trigger grants `admin` when a user with that email is created/confirmed.

## `/auth` page — three tabs/states
**A. "سجل الدخول واحفظ بياناتك" (sign-up)** — default when coming from `?from=request`.
1. Fields: الاسم، الإيميل (prefilled from the latest `sum.pendingRequests` / `sum.lastIdentity`, **editable**), كلمة المرور (min 8), تأكيد كلمة المرور (must match).
2. Submit → Edge Function `send-otp` `{email, purpose:'signup'}`: generate a random **4-digit** code (crypto, `0000`–`9999`), store `sha256(code + salt)` in `otp_codes(id, email, code_hash, salt, purpose, expires_at = now()+10min, attempts int default 0, consumed_at)`, invalidate older codes for that email/purpose, email it (subject "رمز التأكيد: ____" — don't put the code in the subject; body: "رمز التأكيد حقك" + the 4 digits big + "صالح لمدة ١٠ دقائق"). Rate-limit: 1 send / 60s / email, 5 / hour / IP.
3. Screen with **4 separate single-digit boxes** (auto-advance, paste-to-fill, numeric keyboard, LTR order for digits). "ما وصلني الرمز" link → resend (after 60s countdown).
4. `verify-otp` `{email, code, password, name}`: max 5 attempts per code (then must resend). On success: create the user with Supabase Admin API (`email_confirm: true`, the password), create profile, sign them in (return a session via `signInWithPassword` on the client after success).
5. Then call `link-requests` with the `sum.pendingRequests` items: for each `{requestId, email}` whose request email equals the original email in localStorage, set `user_id`. **If the user changed the email** on the sign-up form: update those requests' `email` to the new one, record a `request_edits` row (`field='email'`), and **re-send the receipt email** to the new address. Clear `sum.pendingRequests`.

**B. "تسجيل الدخول"** — email + password. Link "نسيت كلمة المرور" → standard Supabase reset (email link) with Arabic copy.

**C.** Handle `?from=request` copy at the top: "احفظ بياناتك عشان تتابع طلبك وتعدل عليه".

## `/me` — user dashboard (requires login)
Tabs (show tab only if allowed by role):
- **"طلباتي"** — list of own requests: code, type label, status chip (Arabic status name: توه/رهيب/يبيله/وافي/اعذرني/تم), dates (Hijri first), last update. Realtime: when the admin changes a status, the chip updates live and a toast says "حدّثت حالة طلبك {code}: {status}".
- **"الطلبات"** — role-based list (phase 7).
- **"الإشعارات"** — from `notifications` table (status changes, new questions, admin messages). Unread badge.
- **"ملفي"** — edit full name, email (email change triggers the same 4-digit flow with purpose `email_change`), phone.
- **"طلب جديد"** — only for role `loyal` (phase 7).

## `/me/requests/:id` — request detail
- Header: code, type, status, dates, status history timeline (status names + date, and for `declined` the reasons, for `needs_info` the questions).
- Mandatory fields shown read-only.
- **"إجراء تعديل"** on the optional fields only (`sector`, `brief`): each field enters edit mode independently and shows a **"حفظ"** button **right next to that field** (and "إلغاء"). Nothing is persisted until "حفظ" is pressed. Each save goes through function `edit-request-field` which writes the new value and inserts a `request_edits` row (old, new, timestamp, user). Show an "الأرشيف" collapsible listing every edit with its date/time.
- If status is `needs_info`: show the open questions with a textarea per question and one "أرسل الإجابات" button (function `submit-answers`, phase 5).

## RLS
- `profiles`: user reads/updates own row; admin reads all.
- `requests`: owner SELECT own rows. UPDATE only via functions.
- `request_edits`, `request_status_history`: owner SELECT rows of own requests; admin all.
- `notifications(id, user_id, kind, payload jsonb, read_at, created_at)`: owner SELECT/UPDATE(read_at).

Acceptance: sign-up sends a 4-digit code, wrong code 5× locks that code, guest requests get linked, email change re-sends receipt, optional-field edits only save on "حفظ" and are archived with timestamps, status changes appear live.
