import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Check, Plus, X, Loader2, Target, Sparkles, CalendarDays, Users, Lock, Pencil, Flame } from "lucide-react";
import { toast } from "sonner";
import { StreakBar } from "@/components/streak-bar";
import { CelebrationInbox } from "@/components/celebration-inbox";
import { ReasonButton } from "@/components/reason-button";
import { ChallengesPanel } from "@/components/challenges-panel";

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
  approval_status: "pending" | "accepted" | "declined";
  proposed_by: string | null;
  approved_by: string[];
  decline_reason: string | null;
  declined_by: string | null;
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
      <TopNav onSignOut={signOut} />
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


type PersonalGoal = {
  id: string;
  owner_id: string;
  month: string;
  title: string;
  description: string | null;
  is_complete: boolean;
  completed_at: string | null;
  sort_order: number;
};

type Mode = "together" | "mine" | "challenges";

function GoalsView({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [month, setMonth] = useState(monthISO());
  const [mode, setMode] = useState<Mode>("together");
  const [partnerName, setPartnerName] = useState("Partner");
  const isCurrent = month === monthISO();

  const partnerId = partnership.partner_a_id === user.id ? partnership.partner_b_id : partnership.partner_a_id;

  useEffect(() => {
    if (!partnerId) return;
    supabase.from("profiles").select("display_name").eq("id", partnerId).maybeSingle().then(({ data }) => {
      if (data?.display_name) setPartnerName(data.display_name);
    });
  }, [partnerId]);

  const showMonthNav = mode !== "challenges";

  return (
    <div>
      <StreakBar userId={user.id} partnershipId={partnership.id} />
      <CelebrationInbox userId={user.id} partnershipId={partnership.id} partnerName={partnerName} />
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {mode === "together" ? "Monthly couple goals" : mode === "mine" ? "Your private goals" : "Streak challenges"}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            {showMonthNav ? monthLabel(month) : "Challenges"}
          </h1>
        </div>
        {showMonthNav && (
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary">← Prev</button>
            {!isCurrent && (
              <button onClick={() => setMonth(monthISO())} className="rounded-full bg-secondary px-3 py-1.5 text-sm transition hover:bg-accent">This month</button>
            )}
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary">Next →</button>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mb-8 inline-flex flex-wrap rounded-full border border-border bg-card p-1 shadow-soft">
        <button
          onClick={() => setMode("together")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "together" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" /> Together
        </button>
        <button
          onClick={() => setMode("mine")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "mine" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" /> Just me
        </button>
        <button
          onClick={() => setMode("challenges")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "challenges" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="h-4 w-4" /> Challenges
        </button>
      </div>

      {mode === "together" ? (
        <CouplePanel user={user} partnership={partnership} month={month} />
      ) : mode === "mine" ? (
        <PersonalPanel user={user} month={month} />
      ) : (
        <ChallengesPanel
          user={user}
          partnershipId={partnership.id}
          partnerId={partnerId}
          partnerName={partnerName}
        />
      )}
    </div>
  );
}

// =================== COUPLE GOALS PANEL ===================

function CouplePanel({ user, partnership, month }: { user: { id: string }; partnership: Partnership; month: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("couple_goals").select("*")
      .eq("partnership_id", partnership.id).eq("month", month)
      .order("sort_order").order("created_at");
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
      .channel(`couple-goals-${partnership.id}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_goals", filter: `partnership_id=eq.${partnership.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnership.id, month, load]);

  const LIMIT = 3;
  const atLimit = goals.length >= LIMIT;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || atLimit) return;
    setBusy(true);
    const { error } = await supabase.from("couple_goals").insert({
      partnership_id: partnership.id, month,
      title: title.trim(), description: desc.trim() || null,
      created_by: user.id, sort_order: goals.length,
      proposed_by: user.id,
      approved_by: [user.id],
      approval_status: "pending",
    } as never);
    if (error) toast.error(error.message);
    else { setTitle(""); setDesc(""); toast.success("Sent for partner approval 💌"); }
    setBusy(false);
  }
  async function toggle(g: Goal) {
    if (g.approval_status !== "accepted") {
      toast.error("Waiting for partner approval before this can be completed.");
      return;
    }
    const { error } = await supabase.from("couple_goals").update({ is_complete: !g.is_complete } as never).eq("id", g.id);
    if (error) toast.error(error.message);
    else if (!g.is_complete) toast.success("Goal celebrated 🎉");
  }
  async function remove(g: Goal) { await supabase.from("couple_goals").delete().eq("id", g.id); }
  async function editGoal(g: Goal, title: string, description: string | null) {
    const t = title.trim();
    if (!t) return;
    const { error } = await supabase.from("couple_goals")
      .update({ title: t, description } as never)
      .eq("id", g.id);
    if (error) toast.error(error.message);
    else toast.success("Goal updated");
  }


  async function approve(g: Goal) {
    const next = Array.from(new Set([...(g.approved_by ?? []), user.id]));
    const { error } = await supabase.from("couple_goals").update({ approved_by: next, approval_status: "accepted" } as never).eq("id", g.id);
    if (error) toast.error(error.message);
    else toast.success("Accepted 💞");
  }
  async function declineGoal(g: Goal, reason: string) {
    const { error } = await supabase.from("couple_goals").update({
      approval_status: "declined", decline_reason: reason || null, declined_by: user.id,
    } as never).eq("id", g.id);
    if (error) toast.error(error.message);
    else toast.success("Declined — your partner will be notified.");
  }

  const accepted = goals.filter(g => g.approval_status === "accepted");
  const pendingForMe = goals.filter(g => g.approval_status === "pending" && !(g.approved_by ?? []).includes(user.id));
  const pendingMine = goals.filter(g => g.approval_status === "pending" && (g.approved_by ?? []).includes(user.id));
  const declined = goals.filter(g => g.approval_status === "declined");

  return (
    <>
      <ProgressBanner
        icon={<Target className="h-5 w-5 text-lavender-deep" />}
        title={accepted.length === 0 ? "What do you want to do together this month?" : `${accepted.filter(g=>g.is_complete).length} of ${accepted.length} celebrated`}
        subtitle={accepted.length === 0 ? "Add your first shared goal below." : "Either of you can edit or mark complete — these belong to both of you."}
        pct={accepted.length === 0 ? 0 : Math.round((accepted.filter(g=>g.is_complete).length / accepted.length) * 100)}
      />

      {pendingForMe.length > 0 && (
        <div className="mb-6 rounded-3xl border border-lavender-deep/30 bg-gradient-soft p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-widest text-lavender-deep">Waiting for your approval</p>
          <ul className="mt-3 space-y-2">
            {pendingForMe.map(g => {
              const proposer = profiles[g.proposed_by ?? g.created_by]?.display_name ?? "Partner";
              return (
                <li key={g.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex-1">
                    <p className="font-display text-base font-semibold">{g.title}</p>
                    {g.description && <p className="mt-0.5 text-sm text-muted-foreground">{g.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Proposed by {proposer}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button onClick={() => approve(g)} className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft">Accept</button>
                    <ReasonButton label="Decline" placeholder="Why are you declining? (optional)" onSubmit={(r) => declineGoal(g, r)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {[...accepted, ...pendingMine].map((g) => {
          const creator = profiles[g.created_by]?.display_name ?? "Partner";
          const isPending = g.approval_status === "pending";
          return (
            <GoalRow
              key={g.id}
              title={g.title}
              description={g.description}
              isComplete={g.is_complete}
              meta={
                <>
                  {isPending ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lavender-deep">Awaiting partner</span>
                  ) : (
                    <><CalendarDays className="h-3 w-3" /> Added by {creator}{g.is_complete && g.completed_at && ` · Celebrated ${new Date(g.completed_at).toLocaleDateString()}`}</>
                  )}
                </>
              }
              onToggle={() => toggle(g)}
              onDelete={() => remove(g)}
              onEdit={(t, d) => editGoal(g, t, d)}
            />

          );
        })}
      </ul>

      {declined.length > 0 && (
        <details className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-widest text-muted-foreground">Recently declined ({declined.length})</summary>
          <ul className="mt-3 space-y-2">
            {declined.map(g => (
              <li key={g.id} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/30 p-3 text-sm">
                <div>
                  <p className="font-medium">{g.title}</p>
                  {g.decline_reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {g.decline_reason}</p>}
                </div>
                <button onClick={() => remove(g)} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <AddGoalForm
        atLimit={atLimit} limit={LIMIT} count={goals.length}
        title={title} setTitle={setTitle} desc={desc} setDesc={setDesc}
        busy={busy} onSubmit={addGoal}
        placeholder="e.g. Try a new restaurant together"
        limitMessage="Focus beats volume. Complete or remove one to add another."
      />
    </>
  );
}

// =================== PERSONAL GOALS PANEL ===================

function PersonalPanel({ user, month }: { user: { id: string }; month: string }) {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("personal_goals").select("*")
      .eq("owner_id", user.id).eq("month", month)
      .order("sort_order").order("created_at");
    setGoals((data as PersonalGoal[]) ?? []);
  }, [user.id, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`personal-goals-${user.id}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_goals", filter: `owner_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, month, load]);

  const completed = useMemo(() => goals.filter((g) => g.is_complete).length, [goals]);
  const pct = goals.length === 0 ? 0 : Math.round((completed / goals.length) * 100);
  const LIMIT = 5;
  const atLimit = goals.length >= LIMIT;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || atLimit) return;
    setBusy(true);
    const { error } = await supabase.from("personal_goals").insert({
      owner_id: user.id, month,
      title: title.trim(), description: desc.trim() || null,
      sort_order: goals.length,
    } as never);
    if (error) toast.error(error.message);
    else { setTitle(""); setDesc(""); }
    setBusy(false);
  }
  async function toggle(g: PersonalGoal) {
    const { error } = await supabase.from("personal_goals").update({ is_complete: !g.is_complete } as never).eq("id", g.id);
    if (error) toast.error(error.message);
  }
  async function remove(g: PersonalGoal) { await supabase.from("personal_goals").delete().eq("id", g.id); }
  async function editGoal(g: PersonalGoal, t: string, d: string | null) {
    const title = t.trim();
    if (!title) return;
    const { error } = await supabase.from("personal_goals")
      .update({ title, description: d } as never).eq("id", g.id);
    if (error) toast.error(error.message);
    else toast.success("Goal updated");
  }


  return (
    <>
      <ProgressBanner
        icon={<Lock className="h-5 w-5 text-lavender-deep" />}
        title={goals.length === 0 ? "Your private space." : `${completed} of ${goals.length} done`}
        subtitle={goals.length === 0 ? "Only you can see these. Your partner cannot." : "Only you can see and edit these goals."}
        pct={pct}
      />
      <ul className="space-y-3">
        {goals.map((g) => (
          <GoalRow
            key={g.id}
            title={g.title}
            description={g.description}
            isComplete={g.is_complete}
            meta={
              <>
                <Lock className="h-3 w-3" /> Private
                {g.is_complete && g.completed_at && ` · Done ${new Date(g.completed_at).toLocaleDateString()}`}
              </>
            }
            onToggle={() => toggle(g)}
            onDelete={() => remove(g)}
            onEdit={(t, d) => editGoal(g, t, d)}
          />

        ))}
      </ul>
      <AddGoalForm
        atLimit={atLimit} limit={LIMIT} count={goals.length}
        title={title} setTitle={setTitle} desc={desc} setDesc={setDesc}
        busy={busy} onSubmit={addGoal}
        placeholder="e.g. Read 2 books this month"
        limitMessage={`Maximum ${LIMIT} personal goals per month.`}
      />
    </>
  );
}

// =================== SHARED PIECES ===================

function ProgressBanner({ icon, title, subtitle, pct }: { icon: React.ReactNode; title: string; subtitle: string; pct: number }) {
  return (
    <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">{icon}</div>
        <div className="flex-1">
          <p className="font-display text-xl font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span className="font-display text-3xl font-semibold text-lavender-deep">{pct}%</span>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-gradient-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GoalRow({
  title, description, isComplete, meta, onToggle, onDelete, onEdit,
}: {
  title: string;
  description: string | null;
  isComplete: boolean;
  meta: React.ReactNode;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: (title: string, description: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDesc, setDraftDesc] = useState(description ?? "");

  useEffect(() => { setDraftTitle(title); setDraftDesc(description ?? ""); }, [title, description]);

  function commit() {
    if (!onEdit) { setEditing(false); return; }
    onEdit(draftTitle, draftDesc.trim() || null);
    setEditing(false);
  }

  return (
    <li className={`group rounded-2xl border p-5 shadow-soft transition ${
      isComplete ? "border-lavender-deep/30 bg-gradient-soft" : "border-border bg-card"
    }`}>
      <div className="flex items-start gap-4">
        <button
          onClick={onToggle}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            isComplete ? "border-lavender-deep bg-lavender-deep" : "border-border hover:border-lavender-deep"
          }`}
        >
          {isComplete && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
        </button>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                autoFocus value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-display text-base font-semibold focus:border-ring focus:outline-none"
              />
              <textarea
                value={draftDesc} rows={2} maxLength={500}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Details (optional)"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={commit} className="rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">Save</button>
                <button onClick={() => { setDraftTitle(title); setDraftDesc(description ?? ""); setEditing(false); }} className="rounded-full border border-border bg-background px-3 py-1 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p className={`font-display text-lg font-semibold ${isComplete ? "text-muted-foreground line-through" : ""}`}>{title}</p>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">{meta}</p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            {onEdit && (
              <button onClick={() => setEditing(true)} aria-label="Edit goal">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
            <button onClick={onDelete} aria-label="Delete goal">
              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}


function AddGoalForm({
  atLimit, limit, count, title, setTitle, desc, setDesc, busy, onSubmit, placeholder, limitMessage,
}: {
  atLimit: boolean;
  limit: number;
  count: number;
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  limitMessage: string;
}) {
  if (atLimit) {
    return (
      <div className="mt-6 rounded-3xl border border-border bg-secondary/40 p-6 text-center shadow-soft">
        <h2 className="font-display text-lg font-semibold">You've set {limit} goals this month.</h2>
        <p className="mt-1 text-sm text-muted-foreground">{limitMessage}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Add a goal</h2>
        <span className="text-xs text-muted-foreground">{count} of {limit} used</span>
      </div>
      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder} maxLength={200}
        className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
      />
      <textarea
        value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="Optional details…" maxLength={500} rows={2}
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
      />
      <button
        type="submit" disabled={busy || !title.trim()}
        className="mt-3 flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add goal
      </button>
    </form>
  );
}
