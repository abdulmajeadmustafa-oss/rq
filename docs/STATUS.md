# Build status

- **Lovable project:** "Sam's Creative Flame". ID: `a7c41db9-b01c-4e46-89a9-cf00ac00ef34`
  - Editor: https://lovable.dev/projects/a7c41db9-b01c-4e46-89a9-cf00ac00ef34
- **Project knowledge** (permanent rules: Arabic verbatim copy, RTL, colors, Hijri, security) is set in Lovable.

| Phase | Status | Notes |
|---|---|---|
| 1. Design + home | ✅ Done | Counters seeded (376 / 32452 / 120 / 13). RLS: read-only for the public. Storage bucket `works` was created **private** because of a workspace policy. It needs a public bucket or signed URLs in phase 5. |
| 2. Request form | ✅ Done | Hijri/Gregorian calendar (Umm al-Qura, verified: 1 Shawwal 1447 = 2026-03-20, 10 Dhu al-Hijjah 1447 = 2026-05-27). 8 unit tests pass. Submission is still a placeholder; it gets wired up in phase 3. Lovable wrote a few short error messages of its own (validation errors, the hint for clients). |
| 3. Backend + emails | ⏳ Waiting on keys | Needs Resend + Turnstile keys and the sending-domain decision. |
| 4–7 | ⏳ | — |
