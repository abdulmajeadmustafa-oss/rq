# Phase 3 — Requests backend, request code, parents check, emails (Resend)

All server logic in Supabase Edge Functions (Deno). All date/time logic uses timezone **Asia/Riyadh**. Secrets needed: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `ســـم <hello@YOUR-DOMAIN>`), `EMAIL_REPLY_TO`, `SITE_URL`, `TURNSTILE_SECRET_KEY`, `HASH_PEPPER`. Ask me for them via the secrets form.

## Enums & tables
```sql
create type public.request_type as enum ('creative_direction','social_content','initial_marketing_plan','full_marketing_strategy','video_idea','video_script','national_day_video','founding_day_video','other');
create type public.who_are_you as enum ('friend','colleague','client','teacher','father','mother');
create type public.sector as enum ('education','health','food_beverage','retail','tech','other');
create type public.request_status as enum ('new','great','needs_info','complete_brief','declined','done');

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  access_token text not null unique default encode(gen_random_bytes(24),'hex'),
  user_id uuid references auth.users(id) on delete set null,
  name text not null, email text not null,
  email_confirmed_at timestamptz, acknowledged_at timestamptz,
  request_type public.request_type not null, request_type_other text,
  who_are_you public.who_are_you not null,
  preferred_date date not null, deadline_date date not null check (deadline_date > preferred_date),
  sector public.sector, brief text,
  status public.request_status not null default 'new', status_changed_at timestamptz not null default now(),
  decline_reasons text,
  hijri_ymd text not null, day_half smallint not null check (day_half in (12,13)), day_seq int not null,
  created_at timestamptz not null default now()
);
create table public.request_edits (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests on delete cascade, user_id uuid, field text not null, old_value text, new_value text, created_at timestamptz not null default now());
create table public.request_status_history (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests on delete cascade, from_status public.request_status, to_status public.request_status not null, note text, changed_by uuid, created_at timestamptz not null default now());
create table public.holidays (id uuid primary key default gen_random_uuid(), gregorian_date date not null unique, kind text not null check (kind in ('eid_fitr','eid_adha')), day_index int not null, label text not null);
create table public.parent_phones (role text primary key check (role in ('father','mother')), phone_hash text, locked_at timestamptz);
create table public.rate_limits (key text primary key, window_start timestamptz not null, count int not null);
alter table public.counter_credits add constraint counter_credits_request_fk foreign key (request_id) references public.requests(id) on delete cascade;
```
- Seed `holidays` for Eid al-Fitr (1–3 Shawwal) and Eid al-Adha (10–13 Dhu al-Hijjah) of 1447–1450 AH using Umm al-Qura; `day_index` 1..n. Seed `parent_phones` rows for father & mother with `phone_hash = null`.
- Public read of `holidays` (needed by the calendar). Wire the phase-2 calendar to it.
- RLS on: `requests` — **no direct anon access at all**; owner (`user_id = auth.uid()`) can SELECT own rows. Everything else through functions.

## Request code (function `next_request_code()` in SQL, `security definer`, called inside the insert transaction)
Format: `YYMMDD` + `HH` + `SS`
- `YYMMDD`: **Hijri (Umm al-Qura)** 2-digit year, month, day of the creation moment in Asia/Riyadh (civil day, midnight boundary). Compute the Hijri parts in the Edge Function with `Intl` and pass them in.
- `HH`: `12` if local time 00:00–11:59, `13` if 12:00–23:59.
- `SS`: order of this request **within that civil day** (all halves together), 2 digits zero-padded `01..99`; if it exceeds 99, it simply grows (`100`, `101`, …).
- Example: 13 Rabi' II 1447, 09:10, 3rd request of the day → `4704131203`.
- Use a per-day advisory lock (`pg_advisory_xact_lock(hashtext(hijri_ymd))`) to avoid duplicate sequence numbers.

## `submit-request` (public)
1. Verify Turnstile token (skip if `TURNSTILE_SECRET_KEY` unset). Drop if honeypot filled.
2. Rate-limit: 5 submissions / IP / hour.
3. Re-validate everything from phase 2 server-side (dates in Asia/Riyadh: preferred ≥ tomorrow, or ≥ today unless `client`; deadline > preferred; `request_type_other` required when `other`).
4. If `who_are_you ∈ {father, mother}`: rate-limit 5 attempts / IP / day; load `parent_phones` row. **Reject** with code `NOT_PARENT` if `phone_hash` is null, or `locked_at` is not null, or `sha256(HASH_PEPPER + normalizedPhone) != phone_hash`. On success set `locked_at = now()` (one-time). Never return or log the phone.
5. Insert request (+ status history row `null → new`). If the caller is logged in, set `user_id`.
6. Send **receipt email** (template below). Return `{ id, code }`.

## `acknowledge-request` (public, body `{id, email}`)
Sets `acknowledged_at` if `email` matches (case-insensitive). Idempotent.

## `confirm-email` (public, `GET ?t=access_token`)
Sets `email_confirmed_at`, then redirects to `SITE_URL/?confirmed=1` where a toast says "تأكد إيميلك، الله يسعدك".

## `request-lookup` (public)
Input `{ token }` or `{ code, email }` (both required in the manual path). Rate-limit 10 / IP / 10 min. Returns only: `id, code, status, request_type, name (first name only), questions (phase 5)`. Generic error on mismatch: "ما لقيت طلب بهالبيانات، تأكد من الكود والإيميل".

## Emails (Resend)
- Shared HTML layout: dark background `#202124`, RTL, Arabic, logo text "ســـم" in `#fab838` (use a web-safe Arabic fallback stack `'Handicrafts', Tahoma, Arial` — many mail clients ignore web fonts), max-width 560px, flat rectangular buttons (`#fab838`, dark text, no shadow). Footer: "ســـم — وش تبي؟". Plain-text alternative always included.
- Put templates in `supabase/functions/_shared/emails.ts`, one function per template, all text verbatim from below.
- **Receipt** (subject: "استلمت طلبك — {code}"):
  "استلمت طلبك وأبشر باللي يسرك"
  "كود طلبك: {code}"
  Button "أكد إيميلك" → `{SUPABASE_FUNCTIONS_URL}/confirm-email?t={access_token}`.
- Log every send in table `email_log(id, request_id, template, to_email, resend_id, error, created_at)` (admin-only read).

Acceptance: submitting the form creates a row with a correct code, sends the receipt email, the parent check behaves as specified (rejected until a hash exists; locked after first success), RLS blocks anon reads of `requests`.
