# Phase 1 — Design system + Home (hero, counters, works slider)

Build a new app named **"ســـم"** (tagline **"وش تبي؟"**). Arabic only, `dir="rtl"`, `lang="ar"`. Stack: React + Vite + TypeScript + Tailwind + shadcn/ui. Enable Lovable Cloud now (we need the database in this phase for counters and works).

## Assets (already in the repo — use them, do not regenerate)
- Fonts: `public/fonts/TheYearofHandicrafts-{Regular,Medium,SemiBold,Bold,Black}.woff2` → weights 400/500/600/700/900. Register with `@font-face` (`font-display: swap`) as family `Handicrafts` and make it the default font for the whole app (Tailwind `fontFamily.sans`).
- Candle illustration: `public/candle.svg`. It contains `<g class="candle-flame">` and `<circle class="candle-glow">`; inline it as a React component so those can be animated.
- Visual reference: `docs/assets/reference.png` (layout + mood), `docs/assets/hero-mock.png` (our first composition).

## Design tokens (CSS variables on `:root`, dark theme only)
- `--primary: #fab838` (the only accent color)
- `--bg-left: #202124`, `--bg-right: #26272b`, `--surface: #2b2c31`, `--border: #34353b`
- `--text: #eeeeee`, `--text-warm: #f3e4c4`, `--muted: #8a8b91`
- `--warning: #d97706` (amber, used ONLY for warnings, always with a ⚠️ icon and a 1px border — must not look like the primary yellow)
- Flame colors: `#fab838`, `#2f8cff`, `#7b5cff`
- Radius small (6px). Buttons are flat rectangles, **no shadows anywhere on buttons**.
- Never mention "مجمر" anywhere.

## Hero section (full viewport height, mirrors the reference)
- Background split vertically: right half `--bg-right`, left half `--bg-left` (like the reference's two tones).
- Giant faint background phrase **"عد العدة"**, weight 900, ~22vw, color `#2d2e33` (very close to background), centered behind everything.
- **Candle** centered horizontally, height ≈ 70vh on desktop (wide pillar — similar footprint to the cup in the reference). Behind its top-left, a yellow ring (`border: 26px solid var(--primary)`, ~200px, like the orange ring in the reference).
- Flame animation: gentle flicker (scaleY 0.97↔1.03 + 1–2° skew, 2.4s ease-in-out infinite, transform-origin bottom center) and glow opacity pulse. Respect `prefers-reduced-motion` (no animation).
- **Left side** (as in the reference): logo text **"ســـم"** — exactly `س` + three tatweel `U+0640` + `م` (string `"ســـم"`), weight 700, ~10vw, color `--primary`. Below it **"وش تبي؟"** in `--text-warm`, ~2.6vw.
- **Right side**: the four counters stacked, each = big number (weight 700, `--primary`, Arabic-Indic digits via `toLocaleString('ar-SA')`) + label below in `--text`:
  1. key `creative_direction` — "توجه إبداعي"
  2. key `social_content` — "محتوى منشور بمنصات التواصل الاجتماعي"
  3. key `initial_marketing_plan` — "خطة تسويق أولية"
  4. key `full_marketing_strategy` — "استراتيجية تسويق متكاملة"
  Numbers count up from 0 on first view (1.2s). Values come from the database (see below) and update live via Realtime.
- Top bar: small "ســـم." at the right, a menu icon at the left (menu links: الأعمال، اطلب، سجل الدخول) — like the reference.
- A small "→" style scroll cue at the bottom pointing down to the works section.
- **Scroll fade:** as the user scrolls from the hero to the works section, the candle (and ring) fades out and slightly scales down: opacity 1→0 and scale 1→0.9 over the first ~70% of the hero height. Use a scroll listener with `requestAnimationFrame` or framer-motion `useScroll`.
- Mobile (<768px): stack — logo + tagline on top, candle centered (≈ 50vh), counters as a 2×2 grid below. No horizontal scrolling at any width.

## Works slider (section below the hero, id `works`)
- Section title: "من أعمالنا" (small, `--muted`).
- One row of small rectangular cards (aspect 4:3) with image, title under it, and a subtle **reflection** under each card (`-webkit-box-reflect: below 6px linear-gradient(transparent 70%, rgba(255,255,255,.12))` with a CSS fallback of a flipped, faded copy for Firefox).
- Visible cards: ≥1280px → 4, 768–1279px → 3, <768px → ~1.3 (peek of next card).
- Clicking a card opens its `link_url` in a new tab (`target="_blank" rel="noopener noreferrer"`). A drag must not trigger a click (ignore clicks if pointer moved > 6px).
- Motion: continuous slow auto-scroll toward the **left** (~20px/s), infinite loop (duplicate the list). Pauses on hover/focus and while dragging. User can drag with mouse/touch, and use **horizontal** trackpad scroll (`deltaX`). Do **NOT** capture vertical mouse-wheel (`deltaY`) — page scroll must keep working. Reduced-motion → no auto-scroll.

## Database (Lovable Cloud) for this phase
```sql
create table public.counters (
  key text primary key,
  label text not null,
  base_value bigint not null default 0,
  sort int not null default 0
);
create table public.counter_credits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique,            -- FK added in phase 3
  counter_key text not null references public.counters(key),
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create view public.public_counters with (security_invoker = false) as
  select c.key, c.label, c.sort,
         c.base_value + coalesce((select sum(amount) from public.counter_credits cc where cc.counter_key = c.key), 0) as value
  from public.counters c;
create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  link_url text not null,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```
- Seed counters: `creative_direction`=376, `social_content`=32452, `initial_marketing_plan`=120, `full_marketing_strategy`=13 (as `base_value`), with the labels above and sort 1–4.
- Seed 6 placeholder works (dark gradient placeholder images, link `#`).
- RLS: enable on all tables. `anon`/`authenticated` may SELECT `public_counters` and active `works` only. No public writes. (Admin policies come in phase 5.)
- Create a public Storage bucket `works` for work images (used by admin later).

## Footer
At the very bottom of `/`: a full-width flat rectangular button **"سجل الدخول واحفظ بياناتك"** (links to `/auth`, page built in phase 4 — create a placeholder route now), and a small link "سياسة الخصوصية" → `/privacy` (placeholder now).

## Placeholder
Between works and footer add an empty section `id="request"` with heading "اطلب" — the form is built in phase 2.

Acceptance: hero matches the reference composition with our colors; candle fades on scroll; counters read from DB; slider auto-moves left, drags, opens links in new tab, doesn't hijack vertical scroll; mobile has no horizontal overflow; font is Handicrafts everywhere and "ســـم" shows the long kashida.
