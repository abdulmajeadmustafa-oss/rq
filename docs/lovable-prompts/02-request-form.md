# Phase 2 — Request form (UI + client validation + Hijri/Gregorian calendar)

Build the request form inside section `#request` on `/`. All labels are Arabic and must be used **verbatim**. Use react-hook-form + zod. Submission wiring to the backend is phase 3 — for now, on submit, call a stub `submitRequest(values)` in `src/lib/api.ts` that resolves after 600ms.

## Required fields
1. **الاسم:** text, 2–80 chars.
2. **الإيميل:** email.
3. **نوع الطلب:** single-select dropdown (shadcn Select). Options (value → label):
   - `creative_direction` → توجه إبداعي
   - `social_content` → محتوى منشور بمنصات التواصل الاجتماعي
   - `initial_marketing_plan` → خطة تسويق أولية
   - `full_marketing_strategy` → استراتيجية تسويق متكاملة
   - `video_idea` → فكرة فيديو
   - `video_script` → سكريبت فيديو
   - `national_day_video` → فكرة فيديو لليوم الوطني
   - `founding_day_video` → فكرة فيديو ليوم التأسيس
   - `other` → اللي أبيه مو بالاختيارات
   If `other` is selected, show a **required** textarea **"وش هو؟"** (`request_type_other`, 3–500 chars).
4. **من أنت؟:** single-select dropdown. Options (the quoted part is part of the label):
   - `friend` → صديق
   - `colleague` → زميل
   - `client` → عميل
   - `teacher` → أستاذ
   - `father` → أبوي "هلا بابا"
   - `mother` → أمي "هلا حبيبتي"
   If `father` or `mother` is selected, show a **required** field **"رقم جوالك"** (Saudi mobile, `05XXXXXXXX` or `+9665XXXXXXXX`, normalize to `+9665…`). Verification is server-side in phase 3: if the server rejects, show the error **above the field** in red: **"انت مو أبوي، خلك من المزح وعب البيانات بارك الله فيك"** and keep the submit blocked until the user changes "من أنت؟" or the number. (Same text for both options.)
5. **تاريخ التنفيذ اللي تتمناه:** date picked from a calendar only (no typing).
   - Earliest allowed: **tomorrow** (Asia/Riyadh). Exception: if "من أنت؟" ∈ {friend, colleague, teacher, father, mother} then **today** is also allowed. (i.e. `client` cannot pick today.)
   - If "من أنت؟" changes to `client` while today is selected → clear the date and show inline hint.
6. **تاريخ التنفيذ اللي ما أتعداه:** calendar only. Must be **strictly after** the previous date (not equal, not before). Disabled until the previous date is picked. If the previous date changes to ≥ this date → clear this date.
   - **Non-blocking warning** shown **above this field** (amber `--warning` box with ⚠️, NOT an error, does not block submit) when the chosen date is a Friday or falls in Eid al-Fitr (1–3 Shawwal) or Eid al-Adha (10–13 Dhu al-Hijjah):
     **"ترا اليوم اللي حددت {وصف} وغالبًا ما يمديني"** where `{وصف}` is one of: "يوم جمعة"، "يوم عيد الفطر"، "يوم من أيام عيد الفطر"، "يوم عيد الأضحى"، "يوم من أيام عيد الأضحى" (first day = "يوم عيد…", other days = "يوم من أيام عيد…"). If a date is both Friday and Eid, mention Eid.
   - Eid dates: compute with `Intl.DateTimeFormat('en-u-ca-islamic-umalqura')`, **but** prefer rows from table `holidays` (phase 3) when present — create `src/lib/holidays.ts` with `getHolidayInfo(date)` that checks a passed-in list first, then falls back to Umm al-Qura computation.

## The calendar (custom component `HijriGregorianCalendar`)
- Toggle at the top: **هجري | ميلادي** — default **هجري**. Remember the choice in `localStorage` (wrapped in try/catch).
- Hijri mode: month grid built from **Umm al-Qura** (`islamic-umalqura` via `Intl`), Hijri month names (محرم، صفر، ربيع الأول، ربيع الآخر، جمادى الأولى، جمادى الآخرة، رجب، شعبان، رمضان، شوال، ذو القعدة، ذو الحجة), Arabic-Indic digits, week starts Sunday, days labeled أحد…سبت. Under each Hijri day show the Gregorian day number tiny/muted, and vice versa in Gregorian mode.
- Disabled days are greyed and unclickable. Fridays and Eid days are marked with a small amber dot (only on the deadline calendar).
- Value is always a Gregorian ISO date string `YYYY-MM-DD` (stored that way). Display the selected value in the input as e.g. "الأحد ١٣ ربيع الآخر ١٤٤٧هـ — 5 أكتوبر 2025م" (Hijri first).
- Opens in a popover; keyboard accessible; RTL arrows (next month = left).
- Put Hijri helpers in `src/lib/hijri.ts` (toHijriParts, hijriMonthGrid, formatDual) with unit tests (vitest) for: month boundaries, 1 Shawwal 1447 & 10 Dhu al-Hijjah 1447 detection, Friday detection.

## Optional section
Intro paragraph above it (muted, centered):
**"إجابتك على الأسئلة القادمة يساعدني أنجز طلبك أسرع وأكفأ وإن اجتماعنا يكون أقصر ولو إني أتشرف فيك"**
1. **القطاع:** dropdown: `education` → التعليم "أرحب"، `health` → الصحة، `food_beverage` → الأغذية والمشروبات، `retail` → التجزئة، `tech` → التقنية، `other` → غير كذا اعذرني من بدري.
2. **الموجز الإرشادي:** textarea (max 4000), helper text above it: **"اشرح لي شوي وش تبي وأبشر بعزك بحول الله وقوته"**.

## Consent line + bot protection
- Small line under the form: "بإرسالك الطلب توافق على [سياسة الخصوصية](/privacy)".
- Add Cloudflare Turnstile widget (invisible/managed). Site key from env `VITE_TURNSTILE_SITE_KEY`; if missing in dev, skip the widget. Token is sent with the submission (verified server-side in phase 3).
- Hidden honeypot input `company` — if filled, silently drop.

## Submit button
- Full-width **flat rectangle, no shadow**.
- While any required field is missing/invalid: disabled, muted style, text **"أكمل البيانات الله يسلمك"**.
- When all required valid: enabled, `--primary` background, dark text, text **"أرسل طلبي لو سمحت"**.
- Loading state: spinner, still disabled.

## After successful submit — the form area is replaced by:
1. Line: **"حياك الله وأبشر باللي يسر خاطرك بإذن الله"**
2. A bordered text box (centered). Inside: the word **"تكفى"** very prominent — font-size exactly **5×** the paragraph below it (e.g. paragraph 18px → تكفى 90px). Under it the paragraph:
   **"بيجيك إيميل يأكد إني استلمت طلبك، إذا ما وصلك فاعلم أنك حطيت الإيميل غلط، اضغط على زر "سجل الدخول واحفظ بياناتك" وعدل في بياناتك وحط لي الإيميل السليم"**
   Also show the request code: "كود طلبك: {code}".
3. Button **"وصل الإيميل والأمور طيبة"** (flat, primary). On click: call stub `acknowledgeRequest(requestId)` (phase 3), save `{name, email}` to localStorage key `sum.lastIdentity` (try/catch), then replace the word "تكفى" with **"كفو"** at the same size, hide the paragraph and this button.
4. Button **"سجل الدخول واحفظ بياناتك"** → `/auth?from=request&rid={requestId}`. When this success box is shown, **hide the footer copy of this button** (so it effectively moves up into the success box).
- Store `{requestId, code, email}` in localStorage key `sum.pendingRequests` (array) so phase 4 can link guest requests to the new account.
- On load, if `sum.lastIdentity` exists, prefill name and email.

Acceptance: every rule above enforced in the UI; calendar defaults to Hijri; amber warning never blocks; button text switches correctly; success box sizes "تكفى"/"كفو" at 5× the paragraph.
