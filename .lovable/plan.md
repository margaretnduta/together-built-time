# Plan: 5 new feature modules

Scope is large but each piece slots into the existing patterns (Supabase + RLS, TanStack routes, `TopNav`, realtime channels). Data persistence is already in place — every module already uses Supabase with realtime, so "save/retrieve" is satisfied by enriching the existing tables rather than rebuilding storage.

## 1. Mobile off-canvas navigation
File: `src/components/top-nav.tsx`
- On screens `<md`, replace the horizontal scrolling pill bar with a hamburger trigger that opens a Radix `Sheet` (`side="left"`).
- Inside the sheet: vertical nav list, current user avatar/name header, sign-out button at bottom, auto-close on link click.
- Keep the desktop pill bar unchanged on `md+`.

## 2. Recurring daily tasks (automation)
Migration (new fields on `daily_tasks` + new table):
- Add `recurrence text default 'none'` (`'none' | 'daily' | 'weekly'`) and `recurrence_weekday smallint null` (0-6 for weekly).
- New `recurring_task_templates` table (id, owner_id, partnership_id, title, recurrence, weekday, active) with same RLS pattern as `daily_tasks` (owner-scoped writes, partnership-scoped reads).
- SQL function `materialize_recurring_tasks_for_today(_user uuid)` (SECURITY DEFINER) that inserts today's `daily_tasks` rows from active templates if not already present.

Frontend in `src/routes/app.tsx`:
- When a user adds a daily task, show a small "Repeat" select (Once / Daily / Every <weekday>). Saving with a recurrence creates a template AND inserts today's task.
- On dashboard mount, call `materialize_recurring_tasks_for_today` RPC to backfill today's recurring tasks.
- "Manage recurring tasks" small section below the task list to toggle/delete templates.

## 3. Partner approval for shared items (couple goals + important dates)
Migration:
- Add `approval_status text default 'accepted'`, `proposed_by uuid`, `approved_by uuid[] default '{}'` to `couple_goals` and `important_dates`.
- When `proposed_by` is set and partner hasn't approved, status = `'pending'`.
- RLS unchanged (partnership scoped); both partners can `UPDATE` to add themselves to `approved_by`.
- Trigger: when both partners are in `approved_by`, flip `approval_status` to `'accepted'`.

Frontend:
- On insert in `goals.tsx` (Together tab) and `dates.tsx`: set `proposed_by = me`, `approved_by = [me]`, status `'pending'`.
- Render pending items with a yellow "Awaiting partner" badge for the proposer and an "Accept / Decline" action card for the partner (decline = delete).
- Only `accepted` items count toward streaks (filter in queries that feed streaks; streak SQL already counts all rows — add `WHERE approval_status='accepted'` clause in the streak functions).

## 4. Dress code on important dates
Migration: `ALTER TABLE important_dates ADD COLUMN dress_code text` (max 200 chars validated client-side).
Frontend in `dates.tsx`:
- Add optional "Dress code / attire" text input in `AddDateForm`.
- Render with a 👗 icon line under notes on each list item and inside the "Coming up next" hero.

## 5. Data persistence confirmation
No new infra — all existing tables already persist via Supabase and stream via realtime channels. No action needed beyond the migrations above.

---

## Technical notes
- All migrations in one batch.
- No edge functions; all logic stays in `createServerFn`-free direct supabase calls + RPCs (existing pattern).
- Streak SQL functions updated to ignore `pending` approvals so a one-sided proposal doesn't inflate streaks.
- Keep `TopNav` API identical (no caller changes needed).
- All new UI uses existing tokens (`bg-gradient-primary`, `lavender-deep`, `shadow-soft`).

## Order of execution
1. Run migration (tables, columns, RPC, trigger, streak updates).
2. Refactor `top-nav.tsx` for off-canvas mobile.
3. Update `app.tsx` for recurring tasks (template UI + materialize RPC call).
4. Update `goals.tsx` and `dates.tsx` for approval workflow.
5. Add dress code field to `dates.tsx`.
