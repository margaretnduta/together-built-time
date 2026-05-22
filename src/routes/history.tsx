import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, ChevronLeft, ChevronRight, CalendarDays, Check, Circle, Lock, Target, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — TwoGether" }] }),
  component: HistoryPage,
});

type Profile = { id: string; display_name: string };
type Partnership = {
  id: string;
  partner_a_id: string;
  partner_b_id: string | null;
  status: "pending" | "active" | "dissolved";
};
type Task = { id: string; owner_id: string; task_date: string; title: string; is_complete: boolean };
type Goal = { id: string; created_by: string; title: string; description: string | null; is_complete: boolean; completed_at: string | null; month_start: string; approval_status?: string | null };
type PersonalGoal = { id: string; title: string; is_complete: boolean; completed_at: string | null; month_start: string };

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function monthStart(d: Date) { return toISO(new Date(d.getFullYear(), d.getMonth(), 1)); }
function startOfMonthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const wd = first.getDay();
  first.setDate(first.getDate() - wd);
  return first;
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selected, setSelected] = useState<Date>(new Date());
  const [cursor, setCursor] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [personals, setPersonals] = useState<PersonalGoal[]>([]);
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Load partnership + profiles
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: parts } = await supabase
        .from("partnerships")
        .select("*")
        .eq("status", "active")
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      const p = parts as Partnership | null;
      setPartnership(p);

      const ids = [user.id, p?.partner_a_id, p?.partner_b_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        const map: Record<string, Profile> = {};
        (data as Profile[] | null)?.forEach((x) => (map[x.id] = x));
        setProfiles(map);
      }
    })();
  }, [user]);

  // Load all data for selected day + month
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const dayISO = toISO(selected);
    const mStart = monthStart(selected);

    // tasks for selected day (mine + partner if active)
    let tQ = supabase.from("daily_tasks").select("id, owner_id, task_date, title, is_complete").eq("task_date", dayISO);
    if (partnership) tQ = tQ.eq("partnership_id", partnership.id);
    else tQ = tQ.eq("owner_id", user.id);
    const { data: tData } = await tQ;
    setTasks((tData as Task[] | null) ?? []);

    // couple goals for selected month
    if (partnership) {
      const { data: gData } = await supabase
        .from("couple_goals")
        .select("id, created_by, title, description, is_complete, completed_at, month_start, approval_status")
        .eq("partnership_id", partnership.id)
        .eq("month_start", mStart);
      setGoals((gData as Goal[] | null) ?? []);
    } else setGoals([]);

    // personal goals for selected month (mine only)
    const { data: pgData } = await supabase
      .from("personal_goals")
      .select("id, title, is_complete, completed_at, month_start")
      .eq("owner_id", user.id)
      .eq("month_start", mStart);
    setPersonals((pgData as PersonalGoal[] | null) ?? []);

    // calendar dots: dates in the visible cursor month where all tasks complete
    const cMonthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const cMonthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    let mtQ = supabase
      .from("daily_tasks")
      .select("task_date, is_complete")
      .gte("task_date", toISO(cMonthStart))
      .lte("task_date", toISO(cMonthEnd));
    if (partnership) mtQ = mtQ.eq("partnership_id", partnership.id);
    else mtQ = mtQ.eq("owner_id", user.id);
    const { data: mtData } = await mtQ;
    const byDay: Record<string, { total: number; done: number }> = {};
    ((mtData as { task_date: string; is_complete: boolean }[] | null) ?? []).forEach((r) => {
      byDay[r.task_date] ??= { total: 0, done: 0 };
      byDay[r.task_date].total++;
      if (r.is_complete) byDay[r.task_date].done++;
    });
    const done = new Set<string>();
    Object.entries(byDay).forEach(([d, v]) => { if (v.total > 0 && v.done === v.total) done.add(d); });
    setCompletedDays(done);

    setBusy(false);
  }, [user, partnership, selected, cursor]);

  useEffect(() => { load(); }, [load]);

  const calendarDays = useMemo(() => {
    const start = startOfMonthGrid(cursor);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  function partnerId() {
    if (!partnership || !user) return null;
    return partnership.partner_a_id === user.id ? partnership.partner_b_id : partnership.partner_a_id;
  }

  const myTasks = tasks.filter((t) => t.owner_id === user?.id);
  const partnerTasks = tasks.filter((t) => t.owner_id !== user?.id);
  const myName = user ? (profiles[user.id]?.display_name ?? "You") : "You";
  const partnerName = partnerId() ? (profiles[partnerId()!]?.display_name ?? "Partner") : null;

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-lavender-deep" /></div>;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isFuture = selected > new Date();

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSignOut={handleSignOut} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your history</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Look back, learn forward</h1>
          <p className="mt-2 text-sm text-muted-foreground">Browse any day. Tap a date to see what you accomplished — together and on your own.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Calendar */}
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-display text-base font-semibold">{monthLabel}</p>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((d) => {
                const iso = toISO(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const isSelected = iso === toISO(selected);
                const isToday = iso === toISO(new Date());
                const future = d > new Date();
                const completed = completedDays.has(iso);
                return (
                  <button
                    key={iso}
                    onClick={() => setSelected(d)}
                    disabled={future}
                    className={`relative aspect-square rounded-lg text-sm transition ${
                      isSelected
                        ? "bg-gradient-primary font-semibold text-primary-foreground shadow-soft"
                        : inMonth
                          ? "text-foreground hover:bg-secondary"
                          : "text-muted-foreground/40 hover:bg-secondary/40"
                    } ${future ? "cursor-not-allowed opacity-40" : ""} ${isToday && !isSelected ? "ring-1 ring-lavender-deep" : ""}`}
                  >
                    {d.getDate()}
                    {completed && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lavender-deep" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-lavender-deep" /> All tasks completed
            </div>
          </section>

          {/* Detail */}
          <section className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <CalendarDays className="h-5 w-5 text-lavender-deep" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Selected day</p>
                  <h2 className="font-display text-xl font-semibold">{selectedLabel}</h2>
                </div>
              </div>
            </div>

            {busy ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-lavender-deep" /></div>
            ) : isFuture ? (
              <EmptyCard text="That day hasn't happened yet." />
            ) : (
              <>
                <DaySection
                  title={`${myName}'s tasks`}
                  items={myTasks.map((t) => ({ id: t.id, title: t.title, done: t.is_complete }))}
                  emptyText="No tasks logged for this day."
                />
                {partnership && partnerName && (
                  <DaySection
                    title={`${partnerName}'s tasks`}
                    items={partnerTasks.map((t) => ({ id: t.id, title: t.title, done: t.is_complete }))}
                    emptyText={`${partnerName} didn't log tasks.`}
                  />
                )}

                <MonthSection
                  icon={<Target className="h-4 w-4 text-lavender-deep" />}
                  title="Couple goals this month"
                  items={goals
                    .filter((g) => g.approval_status !== "pending")
                    .map((g) => ({
                      id: g.id,
                      title: g.title,
                      sub: g.is_complete && g.completed_at ? `Completed ${new Date(g.completed_at).toLocaleDateString()}` : `Added by ${profiles[g.created_by]?.display_name ?? "Partner"}`,
                      done: g.is_complete,
                    }))}
                  emptyText="No shared goals set this month."
                />

                <MonthSection
                  icon={<Lock className="h-4 w-4 text-lavender-deep" />}
                  title="Your private goals this month"
                  items={personals.map((g) => ({
                    id: g.id,
                    title: g.title,
                    sub: g.is_complete && g.completed_at ? `Completed ${new Date(g.completed_at).toLocaleDateString()}` : "In progress",
                    done: g.is_complete,
                  }))}
                  emptyText="No private goals set this month."
                />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-lavender-deep" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function DaySection({ title, items, emptyText }: { title: string; items: { id: string; title: string; done: boolean }[]; emptyText: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h3 className="mb-3 font-display text-base font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2">
              {it.done ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lavender-deep text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`flex-1 text-sm ${it.done ? "text-muted-foreground line-through" : ""}`}>{it.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthSection({ icon, title, items, emptyText }: { icon: React.ReactNode; title: string; items: { id: string; title: string; sub: string; done: boolean }[]; emptyText: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-display text-base font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/60 px-3 py-2">
              {it.done ? (
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-lavender-deep text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${it.done ? "text-muted-foreground line-through" : ""}`}>{it.title}</p>
                <p className="text-[11px] text-muted-foreground">{it.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
