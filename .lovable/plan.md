## Goal

Two things in one chapter:

1. **Partner celebration when you finish all your private goals for the month** — partner gets notified and prompted to celebrate you. If you didn't complete them all, no notification, no celebration.
2. **Unified Streaks** — three independent streak counters, all realtime:
   - **Daily streak** (couple): every day where both partners finished all their tasks
   - **Monthly couple streak**: every month where all couple goals were celebrated
   - **Personal streak**: each partner's own months where they completed all their private goals

## Backend (one migration)

**`celebrations` table** — partner-visible event when someone clears all their private goals.
- `id`, `partnership_id`, `honoree_id` (the one who finished), `celebrant_id` (the partner), `month`, `goal_count`, `message` (nullable), `acknowledged_at` (nullable), `created_at`
- Unique `(partnership_id, honoree_id, month)` — one celebration per honoree per month
- RLS: read/insert/update if `is_in_partnership(partnership_id)`; only the `celebrant_id` (partner) can write `message`/`acknowledged_at`
- Realtime enabled

**Trigger on `personal_goals`**: after insert/update/delete, if the owner now has ≥1 goal for that month AND all are complete AND they have an active partnership, insert a row into `celebrations` (on conflict do nothing). If they fall back below 100%, delete the un-acknowledged celebration for that month. Result: partner notification fires only when ALL goals complete; silently retracted if they un-check one before partner celebrates.

**Streak views (SQL functions)** — computed on demand so we don't have to maintain counters:
- `get_daily_streak(_partnership_id)` → consecutive days (ending today or yesterday) where both partners completed all their `daily_tasks` and each had ≥1 task
- `get_monthly_couple_streak(_partnership_id)` → consecutive months (ending this or last month) where all `couple_goals` were celebrated and there was ≥1 goal
- `get_personal_streak(_owner_id)` → same but for `personal_goals` of that user

All three return an `int`. SECURITY DEFINER, scoped to caller via `is_in_partnership` / `auth.uid()`.

## Frontend

**`src/components/streak-bar.tsx`** — new shared component. Three pill cards in a row: Daily (🔥), Couple month (💞), Your private (🔒). Each shows count + label + subtle gradient. Loads via the three SQL functions in parallel. Refreshes on a realtime channel subscribed to `daily_tasks`, `couple_goals`, `personal_goals` for the partnership.

**`src/routes/app.tsx` (Today)** — mount `<StreakBar />` at the top.

**`src/routes/goals.tsx`** — mount `<StreakBar />` at the top of `GoalsView`. Add a `<CelebrationInbox />` block above the panels: lists unacknowledged celebrations *from your partner* (where `celebrant_id = you`, `acknowledged_at is null`) with a "Send celebration 💖" button + optional message field. When submitted, sets `message` + `acknowledged_at`. Honoree side: if a celebration *for you* has been acknowledged with a message, show a soft confetti banner with the partner's words.

**`src/routes/reflections.tsx`** — also mount `<StreakBar />` at top (user explicitly asked: "implement that in next chapters or modules too").

**Realtime**: the celebration inbox + streak bar subscribe to the `celebrations`, `daily_tasks`, `couple_goals`, `personal_goals` tables filtered by `partnership_id` / `owner_id`. Toast on new celebration arrival ("🎉 [Partner] completed all their private goals — go celebrate them").

## Important behavior

- Celebration is only created when ALL private goals for the month are `is_complete` AND there is ≥1 goal. Partial completion = no notification.
- If the honoree un-completes a goal *before* the partner acknowledges, the pending celebration is removed (no false alarm).
- After acknowledgment, the celebration is locked — un-completing later doesn't retract it.
- Streaks are pure read queries; no streak table to keep in sync.

## Files

- `supabase/migrations/<new>.sql` — celebrations table + RLS + trigger + 3 streak functions + realtime
- `src/integrations/supabase/types.ts` — regenerated
- `src/components/streak-bar.tsx` — new
- `src/components/celebration-inbox.tsx` — new
- `src/routes/app.tsx` — add StreakBar
- `src/routes/goals.tsx` — add StreakBar + CelebrationInbox
- `src/routes/reflections.tsx` — add StreakBar