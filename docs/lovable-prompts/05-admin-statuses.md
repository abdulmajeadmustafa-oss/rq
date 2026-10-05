# Phase 5 — Admin dashboard: requests & statuses, counters, works, users, holidays, parents

Route `/admin`, guarded by `has_role(auth.uid(),'admin')` (server-checked; RLS policies for admin on every table use `has_role`). RTL sidebar with sections below.

## 1. الطلبات
- Table: code, name, email, type, who_are_you, preferred/deadline (Hijri + Gregorian), status, created_at, flags (✓ email confirmed, ✓ acknowledged, 💬 has new answers). Filters by status/type/who_are_you, search by code/name/email, sort by deadline.
- Detail drawer: all fields, edit archive, status history, Q&A rounds, emails sent (`email_log`).
- **Change status** via function `update-status` `{request_id, to_status, payload}`. Statuses can move freely in any direction. Each change: insert `request_status_history`, set `status_changed_at`, create a `notifications` row for the owner (if any), send the status email (below), all in one function. Status names: `new` توه، `great` رهيب، `needs_info` يبيله، `complete_brief` وافي، `declined` اعذرني، `done` تم.
- **Rules enforced in UI AND in the function:**
  - `needs_info` (يبيله): a question builder — add/remove/reorder questions; the confirm button stays disabled until there are **at least 2** non-empty questions; max **99**. Saved into `request_questions(id, request_id, round int, position, question, answer, answered_at)`; each new يبيله creates a new `round`.
  - `declined` (اعذرني): required textarea "أسباب الاعتذار" (min 10 chars); saved to `decline_reasons`.
  - `done` (تم): **mandatory counter dialog** before confirming: "وش أحسب هالطلب؟" — select counter (`creative_direction`/`social_content`/`initial_marketing_plan`/`full_marketing_strategy`/"لا يُحسب") pre-selected by request type: creative_direction→creative_direction, social_content→social_content, initial_marketing_plan→initial_marketing_plan, full_marketing_strategy→full_marketing_strategy, video_idea/national_day_video/founding_day_video→creative_direction, video_script→social_content, other→nothing preselected (must choose). Quantity input (default 1; when counter is `social_content` the label is "كم منشور؟"). Creates/replaces the `counter_credits` row for this request.
  - Moving a request **out of** `done` deletes its `counter_credits` row (counter decreases).
- **Status emails** (only when the new status ≠ `new`; subject "تحديث على طلبك — {code}"):
  - `great`: "طلبك واضح ووافي ويحمس، بديت بالعمل عليه وقريب بوافيك بالتفاصيل."
  - `needs_info`: "طلبك ينقصني لإتمامه شوية تفاصيل." + numbered list of the questions + "كود طلبك: {code}" + button **"جاوب على الأسئلة"** → `SITE_URL/answer?t={access_token}`. If the requester has an account add the line "ويمديك تجاوب من حسابك بالموقع بعد".
  - `complete_brief`: "طلبك وافي وكافي وبإذن الله قريب بوافيك بالتفاصيل ونعمل مع بعض أحلى شغل بحول الله وفضله وكرمه ومنته."
  - `declined`: "اعذرني، قدرك عالي ويعز علي أرفض لك طلب، لكن ما أقدر إني أساعدك لهذه الأسباب:" + the reasons.
  - `done`: the verse in an elegant centered block, two hemistichs on separate lines, larger size, `#fab838`, thin decorative rule above/below:
    "إذا تمَّ شيءٌ بدا نقصُه"
    "ترقّب زوالًا إذا قيل تمّ"
    then: "الحمدلله على التمام وأستغفر الله لي ولك من كل ذنبٍ ونقصان، أرجو منكَ إن كان وقتك سامحًا أن تعطيني تقييمك وتزودني بمقترحاتك"
    then button **"الذهاب لصفحة التقييم"** → `SITE_URL/review?t={access_token}`.

## `/answer` page (public)
- If `?t=` present → `request-lookup {token}`; else form "كود الطلب" + "الإيميل" → `request-lookup {code,email}`.
- Shows the latest round's unanswered questions, a textarea each, button "أرسل الإجابات" → `submit-answers` (saves answers + `answered_at`, notifies admin: realtime badge in `/admin` + `notifications` row for admin). Status does **not** change automatically. Thank-you line after submit: "وصلتني إجاباتك، الله يعطيك العافية".

## 2. الأرقام (counters)
For each counter show: base value (editable input + "حفظ"), automatic credits sum (read-only), displayed total = base + auto. Editing base never touches `counter_credits`.

## 3. الأعمال (works)
CRUD: title, image upload (Storage bucket `works`, show preview), link URL (validated https), active toggle, drag-to-reorder (`sort`). Delete with confirm.

## 4. المستخدمون
List users (name, email, phone, created_at, roles, number of requests). Detail: profile, their requests, their reviews, chat thread link. **Role editor**: checkboxes for `basic`, `friend`, `colleague`, `loyal`, `father`, `mother` (admin can't remove own admin).

## 5. الأعياد
List/edit `holidays` rows (date, kind, day index) to correct for moon sighting; button "توليد من أم القرى" for a given Hijri year.

## 6. أرقام الوالدين
Two inputs (أبوي، أمي): enter phone → saved only as `sha256(HASH_PEPPER + normalized)` via function `set-parent-phone`. Show status: "غير مضبوط" / "مضبوط — لم يُستخدم" / "تم الاستخدام في {date} — مقفل". Button "إعادة فتح" (clears `locked_at`).

Acceptance: every status rule is enforced server-side too; counter dialog is mandatory for تم; leaving تم decreases the counter; base edits don't affect auto credits; emails are sent with exact texts.
