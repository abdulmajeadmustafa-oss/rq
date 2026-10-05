# Phase 6 — Request review & service review (no stars anywhere)

All fields in both forms are **optional**. No star ratings, no numeric scores.

## `/review` (public)
- If `?t=` → lookup by token; else ask "كود الطلب" + "الإيميل" → `request-lookup`.
- If request status is `done` and not yet reviewed → show the **request review form**.
- If already reviewed → "سبق وقيمت هالطلب، الله يجزاك خير".
- If status is `declined` → message **"أنا اعتذرت عن طلبك"** + button **"قيم الخدمة"** → `/review/service?t=…`.
- Any other status → message **"طلبك بعده ما تم، حالة طلبك {اسم الحالة} مدري كيف جيت هنا لكن يمديك تقيم الخدمة حتى الآن"** + button **"قيم الخدمة"**.

### Request review form (table `request_reviews`, one per request — unique `request_id`)
1. **شرايك بالله؟** — textarea → `opinion`
2. **بتنصح أحد يتعامل معي؟** — two flat toggle buttons نعم / لا → `recommend`
   - if لا → textarea **"معذور بس ليه؟"** → `recommend_reason`
   - if نعم → textarea **"مشكور بس ليه؟"** → `recommend_reason`
3. **وش أفضل شيء شفته بتجربتك؟** — textarea → `best_thing`
4. **كيف أطور نفسي؟** — textarea → `how_to_improve`
5. **تسمح لي أقول للعالم كلها إني تشرفت بالعمل معك وإنجاز شيء طيب بفضل الله أعجبك؟** — نعم / لا → `allow_showcase`
   - if لا → show (text only, no input):
     "خير بإذن الله، ما بحط عملي معك بموقعي لكن إذا صادف وتعاملت مع أحد طلب سابقة عمل شبيهة باللي اشتغلناها مع بعض بقول له إني اشتغلت معك وبوريه الشغل الطيب بيني وبينه وما بقول عنك إلا بخير بإذن الله، إلا إذا اللي اشتغلناه استراتيجية ولا شيء سري، هذيك فيها علوم ثانية والعقد شريعة المتعاقدين والله قال: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ﴾ والله يقدرنا وإياك نحفظ أيماننا وأماناتنا."
   - if نعم → show (text only):
     "الحمدلله رب العالمين، بهذا الإذن اللي وضعته تعطيني الحق إني أقول إني اشتغلت على هذا المشروع على موقعي وأحط رابط يؤدي لمشاهدته أو الاطلاع عليه، إلا إذا اللي اشتغلناه استراتيجية ولا شيء سري، هذيك فيها علوم ثانية والعقد شريعة المتعاقدين والله قال: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ﴾ والله يقدرنا وإياك نحفظ أيماننا وأماناتنا."
- Button **"إرسال التقييم"** (flat). Function `submit-request-review` (validates token/code+email, status `done`, not reviewed yet).
- After submit, replace the form with: **"أنا تشرفت فيك يا {اسم صاحب الطلب} وبإذن الله يكون بيننا معرفة خير وتعاون في خير دائمًا والمعذرة منك على القصور وشكرًا لوقتك"** (use the requester's first name).

## `/review/service` (public; `?t=` optional — links the review to a request)
Table `service_reviews(id, request_id null, user_id null, annoyance, what_pleases, phone, contact_pref, visit_details, created_at)`.
1. **خير إن شاء الله؟ في شيء مزعجك؟** — textarea → `annoyance`
2. **وش اللي يرضيك الله يطول بعمرك ويبارك فيه بطاعة ربي؟** — textarea → `what_pleases`
3. **ممكن تعطيني رقم جوالك؟** — text → `phone`
4. **كيف تفضل أتواصل معك:** — dropdown: `whatsapp` واتساب، `call` اتصال، `email` إيميل، `fax` فاكس، `visit` أجيك بحول الله → `contact_pref`
   - if `visit` → textarea "وين وإيش الوقت المناسب للزيارة؟" → `visit_details` (otherwise nothing extra appears).
   - if `whatsapp`, `call` or `fax` → phone (Q3) becomes **required** with hint "عشان أقدر أتواصل معك أحتاج رقمك".
- Button **"إرسال التقييم"**. Turnstile + rate limit 5/IP/hour. After submit: **"أشكر لك تقييمك، بتواصل معك إذا قدرني الله"**.

## Admin → "التقييمات"
Two tabs (تقييمات الطلبات / تقييمات الخدمة): list with request code, requester name, date, all answers; filter by recommend / allow_showcase; badge for new ones.

Acceptance: no stars; conditional fields appear exactly as specified; one review per request; non-done statuses show the right message and the service-review button.
