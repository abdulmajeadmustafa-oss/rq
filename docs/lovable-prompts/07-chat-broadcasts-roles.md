# Phase 7 — Chat (carrier pigeon), broadcasts, role-based views, privacy page

## Floating chat widget (every page, public and logged-in)
- Small circle bottom-left (RTL-friendly), `#fab838` background, icon: an SVG of a **pigeon's foot with a small rolled message tied to it** (draw a simple line icon in `src/components/icons/PigeonMessage.tsx`, stroke dark). Unread badge.
- Guests: before the first message they must enter **"وش اسمك؟"** (required, 2–40 chars). A `guest_id` (uuid) is stored in localStorage to keep their thread. Turnstile on first message; rate-limit 10 messages / 10 min per guest/IP. Guests can only message the admin.
- Logged-in users: their thread is tied to `user_id`.
- Tables: `chat_threads(id, user_id null, guest_id uuid null, guest_name null, last_message_at, unread_admin int default 0, unread_user int default 0)`, `chat_messages(id, thread_id, sender text check (sender in ('admin','user')), body text check (length(body) between 1 and 2000), created_at, read_at)`. Realtime subscription on own thread. Guest access only via Edge Function `guest-chat` (guest_id acts as bearer secret).
- Admin `/admin/chat`: thread list (name, guest/registered tag, last message, unread), open a thread to read/reply in real time. Admin can start a thread with any registered user from the user detail page.

## Broadcasts ("رسالة عامة")
- Table `broadcasts(id, author_id, body, status text check (status in ('pending','published','rejected')), auto_published bool, starts_at, expires_at, created_at)`.
- Display: a dismissible banner at the top of every page for anyone on the site while `now()` is between `starts_at` and `expires_at` (realtime insert/update → appears immediately to people currently browsing). After expiry it is never shown to anyone.
- **Admin**: compose with text + validity duration (minutes/hours/days) → published immediately. Can edit `expires_at` of any broadcast (including friends' auto-published ones), approve/reject pending ones (setting the duration on approval).
- **Friend** (`friend` role), counted per day in Asia/Riyadh via function `post-broadcast`:
  - The first broadcast of the day is **auto-published** with a fixed **10-minute** validity (friend cannot change duration).
  - Further ones that day go to `pending` (admin approval), **max 9 pending/day**. Beyond that: "وصلت الحد اليومي، بكرة إن شاء الله".
- Nobody else can broadcast.

## Role-based "الطلبات" tab in `/me`
Implemented with security-definer RPCs that return **only** allowed columns (never expose the base table to these roles). Personal data = name, email, phone, user_id, access_token.
- `friend`: `list_requests_for_friend()` → code, request_type, status, preferred_date, deadline_date, created_at — **excluding** requests where `who_are_you = 'client'`. No brief, no sector, no personal data.
- `colleague`: `list_requests_for_colleague()` → same columns + brief/sector, only rows where `who_are_you = 'colleague'`. No personal data.
  - **Load warning** at the top of the colleague's home tab: `colleague_load()` returns N = count of **open** requests (status not in `done`,`declined`) with `who_are_you='colleague'` and `deadline_date` between today and today+5 (Asia/Riyadh). Always show "طلبات الزملاء الحالية: {N}". If **N > 10**, show prominently: **"إذا تقدر تأجل طلبك ترا عندي {N} طلب من الزملاء وكلها مواعيدها خلال الأيام الخمسة الجاية، روح لطلبك وحدّث تاريخ الاستلام بالموعد اللي يناسبك."**
  - **Postpone**: only while N > 10 (re-checked server-side in `postpone-request`), on the colleague's own **open** requests, a button **"أجّل طلبك"** appears in the request detail. Same calendar component; new preferred date ≥ old preferred date, new deadline ≥ old deadline and > new preferred. Writes both changes to `request_edits` and notifies admin.
- `loyal`: **"طلب جديد"** tab — the request form without name/email fields (taken from profile; editable only in "ملفي"); other fields prefilled from their last request and editable. Same validation and same `submit-request` function (authenticated path, Turnstile skipped). Note: `client` restriction on same-day still applies.
- `father` / `mother`: `list_requests_for_parent()` → all requests, same columns as colleague view (no personal data), plus the works gallery page `/me/works` (all works incl. inactive ones).
- A user can hold several roles; show the union of tabs.

## `/privacy` page
Arabic privacy notice (Saudi PDPL-aligned), plain and short: what we collect (الاسم، الإيميل، تفاصيل الطلب، الجوال والعنوان إذا قدمتها في التقييم، محادثاتك)، why (تنفيذ طلبك والتواصل معك)، who sees it (صاحب المنصة فقط؛ بعض المستخدمين المخوّلين يرون تفاصيل الطلب بلا بياناتك الشخصية)، retention (حتى تطلب حذفها)، your rights (الاطلاع، التصحيح، الحذف — عبر المحادثة أو الإيميل)، contact email from `EMAIL_REPLY_TO`. Last-updated date.

Acceptance: guests must enter a name before chatting; admin sees and answers all threads live; broadcasts appear only during validity; friend limits enforced server-side; each role sees only its permitted columns (verify by calling the RPCs as each role); colleague postpone only available while N > 10.
