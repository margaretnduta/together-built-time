import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Check, Plus, X, Loader2, LogOut, Target, Sparkles, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals — TwoGether" }] }),
  component: GoalsPage,
});

type Partnership = {
  id: string;
  partner_a_id: string;
  partner_b_id: string | null;
  status: string;
};

type Goal = {
  id: string;
  partnership_id: string;
  month: string;
  title: string;
  description: string | null;
  is_complete: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  sort_order: number;
};

type Profile = { id: string; display_name: string };

function monthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function shiftMonth(iso: string, delta: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + delta);
  return monthISO(d);
}

function GoalsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [loadingP, setLoadingP] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const loadPartnership = useCallback(async () => {
    if (!user) return;
    setLoadingP(true);
    const { data } = await supabase
      .from("partnerships")
      .select("*")
      .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
      .eq("status", "active")
      .maybeSingle();
    setPartnership(data as Partnership | null);
    setLoadingP(false);
  }, [user]);

  useEffect(() => { loadPartnership(); }, [loadPartnership]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (loading || loadingP || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lavender-deep" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <TopBar onSignOut={signOut} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        {!partnership ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
            <Sparkles className="mx-auto h-8 w-8 text-lavender-deep" />
            <h1 className="mt-4 font-display text-3xl font-semibold">Form a partnership first.</h1>
            <p className="mt-3 text-muted-foreground">Goals are shared between you and your partner.</p>
            <Link
              to="/app"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
            >
              Go to setup
            </Link>
          </div>
        ) : (
          <GoalsView user={user} partnership={partnership} />
        )}
      </div>
    </main>
  );
}

function TopBar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary">
            <Heart className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" />
          </div>
          TwoGether
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/app"
            className="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-secondary text-foreground" }}
          >
            Today
          </Link>
          <Link
            to="/goals"
            className="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-secondary text-foreground" }}
          >
            Goals
          </Link>
          <button
            onClick={onSignOut}
            className="ml-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function GoalsView({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [month, setMonth] = useState(monthISO());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("couple_goals")
      .select("*")
      .eq("partnership_id", partnership.id)
      .eq("month", month)
      .order("sort_order")
      .order("created_at");
    setGoals((data as Goal[]) ?? []);
  }, [partnership.id, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const partnerId = partnership.partner_a_id === user.id ? partnership.partner_b_id : partnership.partner_a_id;
    const ids = [user.id, partnerId].filter(Boolean) as string[];
    supabase.from("profiles").select("id, display_name").in("id", ids).then(({ data }) => {
      const map: Record<string, Profile> = {};
      (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
      setProfiles(map);
    });
  }, [user.id, partnership]);

  useEffect(() => {
    const ch = supabase
      .channel(`goals-${partnership.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "couple_goals", filter: `partnership_id=eq.${partnership.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnership.id, load]);

  const completedCount = useMemo(() => goals.filter((g) => g.is_complete).length, [goals]);
  const pct = goals.length === 0 ? 0 : Math.round((completedCount / goals.length) * 100);

  const GOAL_LIMIT = 3;
  const atLimit = goals.length >= GOAL_LIMIT;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (atLimit) {
      toast.error(`Maximum ${GOAL_LIMIT} goals per month. Keep it focused.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("couple_goals").insert({
      partnership_id: partnership.id,
      month,
      title: title.trim(),
      description: desc.trim() || null,
      created_by: user.id,
      sort_order: goals.length,
    } as never);
    if (error) toast.error(error.message);
    else { setTitle(""); setDesc(""); }
    setBusy(false);
  }

  async function toggle(g: Goal) {
    const { error } = await supabase
      .from("couple_goals")
      .update({ is_complete: !g.is_complete } as never)
      .eq("id", g.id);
    if (error) toast.error(error.message);
    else if (!g.is_complete) toast.success("Goal celebrated 🎉");
  }

  async function remove(g: Goal) {
    await supabase.from("couple_goals").delete().eq("id", g.id);
  }

  const isCurrent = month === monthISO();

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Monthly couple goals</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{monthLabel(month)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary"
          >
            ← Prev
          </button>
          {!isCurrent && (
            <button
              onClick={() => setMonth(monthISO())}
              className="rounded-full bg-secondary px-3 py-1.5 text-sm transition hover:bg-accent"
            >
              This month
            </button>
          )}
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Progress banner */}
      <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <Target className="h-5 w-5 text-lavender-deep" />
          </div>
          <div className="flex-1">
            <p className="font-display text-xl font-semibold">
              {goals.length === 0
                ? "What do you want to do together this month?"
                : `${completedCount} of ${goals.length} celebrated`}
            </p>
            <p className="text-sm text-muted-foreground">
              {goals.length === 0
                ? "Add your first shared goal below."
                : "Either of you can edit or mark complete — these belong to both of you."}
            </p>
          </div>
          <span className="font-display text-3xl font-semibold text-lavender-deep">{pct}%</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Goals list */}
      <ul className="space-y-3">
        {goals.map((g) => {
          const creator = profiles[g.created_by]?.display_name ?? "Partner";
          return (
            <li
              key={g.id}
              className={`group rounded-2xl border p-5 shadow-soft transition ${
                g.is_complete ? "border-lavender-deep/30 bg-gradient-soft" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggle(g)}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    g.is_complete ? "border-lavender-deep bg-lavender-deep" : "border-border hover:border-lavender-deep"
                  }`}
                >
                  {g.is_complete && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                </button>
                <div className="flex-1">
                  <p className={`font-display text-lg font-semibold ${g.is_complete ? "text-muted-foreground line-through" : ""}`}>
                    {g.title}
                  </p>
                  {g.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    Added by {creator}
                    {g.is_complete && g.completed_at && ` · Celebrated ${new Date(g.completed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => remove(g)}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete goal"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Add form */}
      <form
        onSubmit={addGoal}
        className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft"
      >
        <h2 className="font-display text-lg font-semibold">Add a goal</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Try a new restaurant together"
          maxLength={200}
          className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Optional details…"
          maxLength={500}
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="mt-3 flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add goal
        </button>
      </form>
    </div>
  );
}
