import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Check, Circle, Plus, X, Loader2, Copy, Unlock, Lock, Sparkles, Repeat, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { StreakBar } from "@/components/streak-bar";
import { CoupleAchievements } from "@/components/couple-achievements";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserMinus } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Today — TwoGether" }],
  }),
  component: AppPage,
});

type Profile = { id: string; display_name: string };
type Partnership = {
  id: string;
  partner_a_id: string;
  partner_b_id: string | null;
  status: "pending" | "active" | "dissolved";
  invite_code: string | null;
  formed_at: string | null;
};
type Task = {
  id: string;
  partnership_id: string;
  owner_id: string;
  task_date: string;
  title: string;
  is_complete: boolean;
  sort_order: number;
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function AppPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [loadingPartnership, setLoadingPartnership] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
    } else if (!user.email_confirmed_at && !user.confirmed_at) {
      // Email not yet verified — bounce back to /auth so the verify
      // screen can guide them to confirm before accessing the app.
      navigate({ to: "/auth", search: { verify: user.email ?? "" } as never });
    }
  }, [user, loading, navigate]);

  const loadPartnership = useCallback(async () => {
    if (!user) return;
    setLoadingPartnership(true);
    const { data } = await supabase
      .from("partnerships")
      .select("*")
      .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPartnership(data as Partnership | null);
    setLoadingPartnership(false);
  }, [user]);

  useEffect(() => {
    loadPartnership();
  }, [loadPartnership]);

  // Realtime: refresh partnership when something changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("partnerships-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "partnerships" }, () => {
        loadPartnership();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadPartnership]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading || loadingPartnership || !user) {
    return <FullScreenLoader />;
  }

  return (
    <main className="min-h-screen bg-background">
      <TopNav onSignOut={handleSignOut} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {!partnership || partnership.status === "pending" ? (
          <Onboarding user={user} partnership={partnership} onChange={loadPartnership} />
        ) : (
          <Dashboard user={user} partnership={partnership} />
        )}
      </div>
    </main>
  );
}


function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-lavender-deep" />
    </div>
  );
}

// =================== ONBOARDING ===================

function Onboarding({
  user,
  partnership,
  onChange,
}: {
  user: { id: string };
  partnership: Partnership | null;
  onChange: () => void;
}) {
  const isInviter = partnership && partnership.partner_a_id === user.id;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createInvite() {
    setBusy(true);
    try {
      const newCode = genCode();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("partnerships").insert({
        partner_a_id: user.id,
        partner_b_id: null,
        status: "pending",
        invite_code: newCode,
        invite_expires_at: expires,
      } as never);
      if (error) throw error;
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not create invite");
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite() {
    if (!partnership) return;
    setBusy(true);
    await supabase.from("partnerships").delete().eq("id", partnership.id);
    onChange();
    setBusy(false);
  }

  async function acceptInvite() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("accept_invite", { _code: code.trim().toUpperCase() });
      if (error) throw error;
      toast.success("Partnership formed.");
      onChange();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not accept invite";
      if (msg.includes("invite_invalid")) toast.error("Invite code is invalid or expired.");
      else if (msg.includes("cannot_accept_own")) toast.error("That's your own invite code.");
      else if (msg.includes("already_in")) toast.error("You're already in a partnership.");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!partnership?.invite_code) return;
    navigator.clipboard.writeText(partnership.invite_code);
    toast.success("Code copied.");
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-lavender-deep" />
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Find your partner.</h1>
        <p className="mt-3 text-muted-foreground">Send an invite code, or enter one you received.</p>
      </div>

      {isInviter && partnership?.invite_code ? (
        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your invite code</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <code className="font-display text-4xl font-bold tracking-[0.3em] text-lavender-deep">
              {partnership.invite_code}
            </code>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-accent"
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Share this with your partner. They sign up, enter this code, and you're paired.
          </p>
          <button
            onClick={cancelInvite}
            disabled={busy}
            className="mt-6 text-sm text-muted-foreground hover:text-destructive"
          >
            Cancel invite
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Send an invite</h2>
            <p className="mt-2 text-sm text-muted-foreground">Generate a code your partner will enter.</p>
            <button
              onClick={createInvite}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate code
            </button>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Accept an invite</h2>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-display text-2xl font-bold tracking-[0.3em] uppercase focus:border-ring focus:outline-none"
            />
            <button
              onClick={acceptInvite}
              disabled={busy || code.length < 6}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary px-4 py-3 text-sm font-semibold transition hover:bg-accent disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== DASHBOARD ===================

function Dashboard({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const today = todayISO();
  const partnerId = useMemo(
    () => (partnership.partner_a_id === user.id ? partnership.partner_b_id! : partnership.partner_a_id),
    [partnership, user.id]
  );

  const [viewedDate, setViewedDate] = useState<string>(today);
  const [weekOffset, setWeekOffset] = useState( 0 );
  const isToday = viewedDate === today;
  const isPast = viewedDate < today;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<"once" | "daily" | "weekly">("once");
  const [adding, setAdding] = useState(false);
  const [myTemplates, setMyTemplates] = useState<{ id: string; title: string; recurrence: "daily" | "weekly"; weekday: number | null; active: boolean }[]>([]);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("partnership_id", partnership.id)
      .eq("task_date", viewedDate)
      .order("sort_order")
      .order("created_at");
    setTasks((data as Task[]) ?? []);
  }, [partnership.id, viewedDate]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [user.id, partnerId]);
    const map: Record<string, Profile> = {};
    (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
    setProfiles(map);
  }, [user.id, partnerId]);

  // Materialize today's recurring tasks once per mount, then load tasks.
  useEffect(() => {
    (async () => {
      await supabase.rpc("materialize_recurring_tasks_for_today");
      loadTasks();
    })();
    loadProfiles();
  }, [loadTasks, loadProfiles]);

  // Load my recurring templates (used to project planned tasks on non-today days)
  const loadMyTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_task_templates")
      .select("id, title, recurrence, weekday, active")
      .eq("owner_id", user.id)
      .eq("active", true);
    setMyTemplates((data as typeof myTemplates) ?? []);
  }, [user.id]);
  useEffect(() => { loadMyTemplates(); }, [loadMyTemplates]);

  // Realtime subscription — tasks for the partnership, plus my templates
  useEffect(() => {
    const ch = supabase
      .channel(`tasks-${partnership.id}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_tasks", filter: `partnership_id=eq.${partnership.id}` },
        () => loadTasks()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_task_templates", filter: `owner_id=eq.${user.id}` },
        () => loadMyTemplates()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnership.id, user.id, loadTasks, loadMyTemplates]);

  // Planned items: for non-today views, surface recurring templates that would
  // apply on the viewed weekday but don't yet have a materialized row.
  const viewedWeekday = new Date(viewedDate + "T00:00:00").getDay();
  const plannedForMe = useMemo(() => {
    if (isToday) return [];
    const titlesOnDate = new Set(tasks.filter(t => t.owner_id === user.id).map(t => t.title));
    return myTemplates
      .filter(t => t.recurrence === "daily" || (t.recurrence === "weekly" && t.weekday === viewedWeekday))
      .filter(t => !titlesOnDate.has(t.title));
  }, [isToday, myTemplates, tasks, user.id, viewedWeekday]);

  const myTasks = tasks.filter((t) => t.owner_id === user.id);
  const partnerTasks = tasks.filter((t) => t.owner_id === partnerId);

  const myPct = myTasks.length === 0 ? 100 : Math.round((myTasks.filter((t) => t.is_complete).length / myTasks.length) * 100);
  const partnerPct = partnerTasks.length === 0 ? 100 : Math.round((partnerTasks.filter((t) => t.is_complete).length / partnerTasks.length) * 100);
  const meReady = myTasks.length === 0 || myTasks.every((t) => t.is_complete);
  const partnerReady = partnerTasks.length === 0 || partnerTasks.every((t) => t.is_complete);
  const bothReady = meReady && partnerReady;

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    // If recurring, create template first so we capture the template_id
    let templateId: string | null = null;
    if (newRecurrence !== "once") {
      const weekday = newRecurrence === "weekly" ? new Date().getDay() : null;
      const { data: tpl, error: tplErr } = await supabase.from("recurring_task_templates").insert({
        owner_id: user.id,
        partnership_id: partnership.id,
        title,
        recurrence: newRecurrence,
        weekday,
        active: true,
      } as never).select("id").single();
      if (tplErr) { toast.error(tplErr.message); setAdding(false); return; }
      templateId = (tpl as { id: string } | null)?.id ?? null;
    }
    const { error } = await supabase.from("daily_tasks").insert({
      partnership_id: partnership.id,
      owner_id: user.id,
      task_date: viewedDate,
      title,
      sort_order: myTasks.length,
      template_id: templateId,
    } as never);
    if (error) toast.error(error.message);
    else { setNewTitle(""); setNewRecurrence("once"); }
    setAdding(false);
  }

  async function toggleTask(t: Task) {
    const { error } = await supabase
      .from("daily_tasks")
      .update({ is_complete: !t.is_complete } as never)
      .eq("id", t.id);
    if (error) toast.error(error.message);
  }

  async function deleteTask(t: Task) {
    await supabase.from("daily_tasks").delete().eq("id", t.id);
  }

  async function renameTask(t: Task, newTitle: string) {
    const title = newTitle.trim();
    if (!title || title === t.title) return;
    const { error } = await supabase
      .from("daily_tasks")
      .update({ title } as never)
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else toast.success("Task updated");
  }


  const partnerName = profiles[partnerId]?.display_name ?? "Partner";
  const myName = profiles[user.id]?.display_name ?? "You";
  const dateLabel = new Date(viewedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  // Partnership days counter
  const daysTogether = useMemo(() => {
    if (!partnership.formed_at) return null;
    const start = new Date(partnership.formed_at);
    start.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((t.getTime() - start.getTime()) / 86400000)) + 1;
  }, [partnership.formed_at]);

  const combinedPct = Math.round((myPct + partnerPct) / 2);

  // Build a 7-day strip for the selected week (offset by weekOffset from current week)
  const weekDays = useMemo(() => {
    const d = new Date(today + "T00:00:00");
    const day = d.getDay(); // 0=Sun..6=Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(d); currentMonday.setDate(d.getDate() + mondayOffset);
    const selectedMonday = new Date(currentMonday);
    selectedMonday.setDate(currentMonday.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(selectedMonday); dd.setDate(selectedMonday.getDate() + i);
      return dd.toISOString().slice(0, 10);
    });
  }, [today, weekOffset]);

  // Week range label like "Mon, May 19 – Sun, May 25"
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return "";
    const start = new Date(weekDays[0] + "T00:00:00");
    const end = new Date(weekDays[6] + "T00:00:00");
    const fmt = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [weekDays]);

  return (
    <div>
      <CoupleAchievements userId={user.id} partnershipId={partnership.id} formedAt={partnership.formed_at} />
      <StreakBar userId={user.id} partnershipId={partnership.id} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{dateLabel}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            {isToday ? "Today" : isPast ? "Looking back" : "Planning ahead"}
          </h1>
        </div>
        {daysTogether !== null && (
          <div className="rounded-2xl border border-border bg-card px-4 py-2 text-right shadow-soft">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Together</p>
            <p className="font-display text-2xl font-semibold text-lavender-deep">
              {daysTogether} <span className="text-sm text-muted-foreground">day{daysTogether === 1 ? "" : "s"}</span>
            </p>
          </div>
        )}
      </div>

      {/* Week navigator: Mon-Sun with prev/next controls */}
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft transition hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {weekRangeLabel}
          </p>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft transition hover:text-foreground"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex items-stretch justify-between gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
            {weekDays.map((iso) => {
              const d = new Date(iso + "T00:00:00");
              const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
              const active = iso === viewedDate;
              const isTodayPill = iso === today;
              const isFuture = iso > today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setViewedDate(iso)}
                  aria-pressed={active}
                  aria-label={`View ${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${isTodayPill ? " (today)" : ""}`}
                  className={`group relative flex flex-1 cursor-pointer flex-col items-center rounded-xl px-2 py-2 text-[11px] font-medium transition active:scale-95 ${
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span className="uppercase tracking-wider">{labels[d.getDay()]}</span>
                  <span className={`mt-0.5 font-display text-lg leading-none ${isTodayPill && !active ? "text-lavender-deep" : ""}`}>
                    {d.getDate()}
                  </span>
                  {isTodayPill && !active && (
                    <span aria-hidden className="mt-1 h-1 w-1 rounded-full bg-lavender-deep" />
                  )}
                  {isFuture && !active && (
                    <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary/40" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {weekOffset !== 0 && (
          <button
            type="button"
            onClick={() => { setWeekOffset(0); setViewedDate(today); }}
            className="cursor-pointer text-xs font-medium text-lavender-deep hover:underline"
          >
            ← Back to this week
          </button>
        )}
      </div>

      {/* Engagement banner */}
      <div
        className={`mb-8 flex items-center gap-4 rounded-3xl border p-6 shadow-soft transition ${
          bothReady
            ? "border-lavender-deep/30 bg-gradient-primary text-primary-foreground"
            : "border-border bg-card"
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            bothReady ? "bg-white/20" : "bg-secondary"
          }`}
        >
          {bothReady ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5 text-lavender-deep" />}
        </div>
        <div className="flex-1">
          <p className={`font-display text-xl font-semibold ${bothReady ? "" : "text-foreground"}`}>
            {bothReady ? "Ready for engagement" : "Doing something constructive"}
          </p>
          <p className={`text-sm ${bothReady ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {bothReady
              ? `You've both shown up today. Go connect with ${partnerName}.`
              : `Complete your tasks to unlock time with ${partnerName}.`}
          </p>
          <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${bothReady ? "bg-white/20" : "bg-secondary"}`}>
            <div
              className={`h-full transition-all duration-500 ${bothReady ? "bg-white" : "bg-gradient-primary"}`}
              style={{ width: `${combinedPct}%` }}
            />
          </div>
        </div>
        <p className={`font-display text-2xl font-semibold ${bothReady ? "" : "text-lavender-deep"}`}>
          {combinedPct}%
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* My panel */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <PanelHeader name={myName} pct={myPct} isMe />
          <ul className="mt-5 space-y-2">
            {myTasks.map((t) => (
              <EditableTaskRow
                key={t.id}
                task={t}
                onToggle={() => toggleTask(t)}
                onDelete={() => deleteTask(t)}
                onRename={(title) => renameTask(t, title)}
              />
            ))}

            {plannedForMe.map((tpl) => (
              <li key={`planned-${tpl.id}`} className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-sm">
                <Repeat className="h-4 w-4 shrink-0 text-lavender-deep" />
                <span className="flex-1 truncate text-muted-foreground">{tpl.title}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lavender-deep">Scheduled</span>
              </li>
            ))}

            {myTasks.length === 0 && plannedForMe.length === 0 && (
              <li className="rounded-xl bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                {isPast ? "Nothing was logged for this day." : "A rest day is valid. Or add what you're working on."}
              </li>
            )}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
            className="mt-4 space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isToday ? "Add a task for today…" : isPast ? "Log a task for this day…" : "Plan a task for this day…"}
                maxLength={200}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-ring focus:outline-none"
              />
              <button
                type="submit"
                disabled={adding || !newTitle.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground transition hover:scale-105 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Repeat className="h-3 w-3" /> Repeat:</span>
              {([
                { v: "once", label: "Once" },
                { v: "daily", label: "Every day" },
                { v: "weekly", label: `Every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()]}` },
              ] as const).map((opt) => (
                <button
                  key={opt.v} type="button" onClick={() => setNewRecurrence(opt.v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    newRecurrence === opt.v ? "bg-gradient-primary text-primary-foreground shadow-soft" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </form>

          <ProgressBar pct={myPct} />
        </section>

        {/* Partner panel */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <PanelHeader name={partnerName} pct={partnerPct} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tasks are blurred to keep your focus — hover to peek.
          </p>
          <ul className="mt-3 space-y-2">
            {partnerTasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 rounded-xl p-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    t.is_complete ? "border-lavender-deep bg-lavender-deep" : "border-border"
                  }`}
                >
                  {t.is_complete ? (
                    <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                  ) : (
                    <Circle className="h-2 w-2 text-muted-foreground" />
                  )}
                </div>
                <span
                  className={`flex-1 select-none text-sm blur-[5px] transition group-hover:blur-0 ${
                    t.is_complete ? "text-muted-foreground" : "text-foreground"
                  }`}
                  aria-label="Partner task (blurred for focus)"
                >
                  {t.title}
                </span>
              </li>
            ))}
            {partnerTasks.length === 0 && (
              <li className="rounded-xl bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                {partnerName} hasn't added anything yet.
              </li>
            )}
          </ul>
          <ProgressBar pct={partnerPct} />
        </section>
      </div>

      <RecurringTemplates userId={user.id} partnershipId={partnership.id} />
      <ManagePartnership partnerName={partnerName} />
    </div>
  );
}

type Template = {
  id: string;
  title: string;
  recurrence: "daily" | "weekly";
  weekday: number | null;
  active: boolean;
};

function RecurringTemplates({ userId, partnershipId }: { userId: string; partnershipId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_task_templates")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    setTemplates((data as Template[]) ?? []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`templates-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_task_templates", filter: `owner_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  async function toggleActive(t: Template) {
    await supabase.from("recurring_task_templates").update({ active: !t.active } as never).eq("id", t.id);
  }
  async function remove(t: Template) {
    await supabase.from("recurring_task_templates").delete().eq("id", t.id);
    toast.success("Recurring task removed");
  }

  if (templates.length === 0) return null;

  return (
    <section className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Repeat className="h-4 w-4 text-lavender-deep" />
        <h3 className="font-display text-lg font-semibold">Your recurring tasks</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These automatically appear on your daily list. Pause or remove anytime.
      </p>
      <ul className="mt-4 space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
            <div className="flex-1">
              <p className={`text-sm font-medium ${t.active ? "" : "text-muted-foreground line-through"}`}>{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.recurrence === "daily" ? "Every day" : `Every ${DAYS[t.weekday ?? 0]}`}
                {!t.active && " · paused"}
              </p>
            </div>
            <button
              onClick={() => toggleActive(t)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t.active ? "Pause" : "Resume"}
            </button>
            <button onClick={() => remove(t)} aria-label="Delete template" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ManagePartnership({ partnerName }: { partnerName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDissolve() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("dissolve_partnership");
      if (error) throw error;
      toast.success("Partnership ended. You can invite a new partner now.");
      setOpen(false);
      // Realtime listener on partnerships will refresh the screen and
      // surface the Onboarding flow automatically.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not end partnership";
      toast.error(msg.includes("no_partnership") ? "No active partnership found." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Partnership
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">
            Paired with {partnerName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            End this partnership to invite or accept a new partner. Finish this step before starting a new invite.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
        >
          <UserMinus className="h-4 w-4" /> Remove partner
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End partnership with {partnerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your shared today tasks, monthly goals, reflections,
              important dates and celebrations will stay archived but neither of you will
              be able to access or edit them anymore. Streaks tied to this partnership will reset.
              After this, you'll be able to invite or accept a new partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep partnership</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDissolve();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Ending…
                </span>
              ) : (
                "Yes, end partnership"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function EditableTaskRow({
  task, onToggle, onDelete, onRename,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  useEffect(() => { setDraft(task.title); }, [task.title]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.title) onRename(draft);
    else setDraft(task.title);
  }

  return (
    <li className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-secondary/50">
      <button
        onClick={onToggle}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          task.is_complete ? "border-lavender-deep bg-lavender-deep" : "border-border hover:border-lavender-deep"
        }`}
        aria-label={task.is_complete ? "Mark incomplete" : "Mark complete"}
      >
        {task.is_complete && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(task.title); setEditing(false); }
          }}
          maxLength={200}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left text-sm ${task.is_complete ? "text-muted-foreground line-through" : "text-foreground"}`}
          title="Click to edit"
        >
          {task.title}
        </button>
      )}

      <button
        onClick={() => setEditing((v) => !v)}
        className="opacity-0 transition group-hover:opacity-100"
        aria-label="Edit task"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 transition group-hover:opacity-100"
        aria-label="Delete task"
      >
        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </button>
    </li>
  );
}

function PanelHeader({ name, pct, isMe }: { name: string; pct: number; isMe?: boolean }) {

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {isMe ? "You" : "Your partner"}
        </p>
        <h2 className="mt-0.5 font-display text-xl font-semibold">{name}</h2>
      </div>
      <span className="font-display text-2xl font-semibold text-lavender-deep">{pct}%</span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full bg-gradient-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
