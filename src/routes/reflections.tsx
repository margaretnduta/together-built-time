import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Loader2, LogOut, Sparkles, Lock, Check, BookOpen } from "lucide-react";
import { StreakBar } from "@/components/streak-bar";
import { toast } from "sonner";

export const Route = createFileRoute("/reflections")({
  head: () => ({ meta: [{ title: "Reflections — TwoGether" }] }),
  component: ReflectionsPage,
});

type Partnership = {
  id: string;
  partner_a_id: string;
  partner_b_id: string | null;
  status: string;
};

type Reflection = {
  id: string;
  partnership_id: string;
  owner_id: string;
  week_start: string;
  went_well: string | null;
  was_hard: string | null;
  appreciation_for_partner: string | null;
  submitted_at: string | null;
};

type Profile = { id: string; display_name: string };

// Week starts on Monday
function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function weekISO(d = new Date()) {
  return mondayOf(d).toISOString().slice(0, 10);
}
function shiftWeek(iso: string, deltaWeeks: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekISO(d);
}
function weekLabel(iso: string) {
  const start = new Date(iso);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, fmt)} – ${end.toLocaleDateString(undefined, fmt)}`;
}

function ReflectionsPage() {
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        {!partnership ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
            <Sparkles className="mx-auto h-8 w-8 text-lavender-deep" />
            <h1 className="mt-4 font-display text-3xl font-semibold">Form a partnership first.</h1>
            <p className="mt-3 text-muted-foreground">Reflections are a weekly ritual between you and your partner.</p>
            <Link
              to="/app"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
            >
              Go to setup
            </Link>
          </div>
        ) : (
          <>
            <StreakBar userId={user.id} partnershipId={partnership.id} />
            <ReflectionsView user={user} partnership={partnership} />
          </>
        )}
      </div>
    </main>
  );
}

function TopBar({ onSignOut }: { onSignOut: () => void }) {
  const linkCls = "rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground";
  const activeCls = "rounded-full px-4 py-1.5 text-sm bg-secondary text-foreground";
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
          <Link to="/app" className={linkCls} activeProps={{ className: activeCls }}>Today</Link>
          <Link to="/goals" className={linkCls} activeProps={{ className: activeCls }}>Goals</Link>
          <Link to="/reflections" className={linkCls} activeProps={{ className: activeCls }}>Reflections</Link>
          <Link to="/dates" className={linkCls} activeProps={{ className: activeCls }}>Dates</Link>
          <button
            onClick={onSignOut}
            className="ml-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function ReflectionsView({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [week, setWeek] = useState(weekISO());
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingR, setLoadingR] = useState(true);

  const partnerId = useMemo(
    () => (partnership.partner_a_id === user.id ? partnership.partner_b_id! : partnership.partner_a_id),
    [partnership, user.id]
  );

  const load = useCallback(async () => {
    setLoadingR(true);
    const { data } = await supabase
      .from("weekly_reflections")
      .select("*")
      .eq("partnership_id", partnership.id)
      .eq("week_start", week);
    setReflections((data as Reflection[]) ?? []);
    setLoadingR(false);
  }, [partnership.id, week]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ids = [user.id, partnerId].filter(Boolean) as string[];
    supabase.from("profiles").select("id, display_name").in("id", ids).then(({ data }) => {
      const map: Record<string, Profile> = {};
      (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
      setProfiles(map);
    });
  }, [user.id, partnerId]);

  useEffect(() => {
    const ch = supabase
      .channel(`reflections-${partnership.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_reflections", filter: `partnership_id=eq.${partnership.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnership.id, load]);

  const myReflection = reflections.find((r) => r.owner_id === user.id) ?? null;
  const partnerReflection = reflections.find((r) => r.owner_id === partnerId) ?? null;
  const mySubmitted = !!myReflection?.submitted_at;
  const partnerSubmitted = !!partnerReflection?.submitted_at;
  const bothSubmitted = mySubmitted && partnerSubmitted;

  const isCurrent = week === weekISO();
  const myName = profiles[user.id]?.display_name ?? "You";
  const partnerName = profiles[partnerId]?.display_name ?? "Partner";

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Weekly reflection</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{weekLabel(week)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeek(shiftWeek(week, -1))} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary">← Prev</button>
          {!isCurrent && (
            <button onClick={() => setWeek(weekISO())} className="rounded-full bg-secondary px-3 py-1.5 text-sm transition hover:bg-accent">This week</button>
          )}
          <button onClick={() => setWeek(shiftWeek(week, 1))} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary">Next →</button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mb-8 flex items-center gap-4 rounded-3xl border p-6 shadow-soft transition ${
        bothSubmitted ? "border-lavender-deep/30 bg-gradient-primary text-primary-foreground" : "border-border bg-card"
      }`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bothSubmitted ? "bg-white/20" : "bg-secondary"}`}>
          {bothSubmitted ? <BookOpen className="h-5 w-5" /> : <Lock className="h-5 w-5 text-lavender-deep" />}
        </div>
        <div className="flex-1">
          <p className={`font-display text-xl font-semibold ${bothSubmitted ? "" : "text-foreground"}`}>
            {bothSubmitted ? "Reflections shared" : mySubmitted ? `Waiting on ${partnerName}` : partnerSubmitted ? `${partnerName} is ready` : "Take a moment to reflect"}
          </p>
          <p className={`text-sm ${bothSubmitted ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {bothSubmitted
              ? "You can both see each other's reflections now."
              : "Your reflection stays private until you both submit."}
          </p>
        </div>
      </div>

      {loadingR ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-lavender-deep" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <MyReflectionCard
            user={user}
            partnership={partnership}
            week={week}
            reflection={myReflection}
            myName={myName}
            onChanged={load}
          />
          <PartnerReflectionCard
            reflection={partnerReflection}
            partnerName={partnerName}
            bothSubmitted={bothSubmitted}
            partnerSubmitted={partnerSubmitted}
          />
        </div>
      )}
    </div>
  );
}

function MyReflectionCard({
  user, partnership, week, reflection, myName, onChanged,
}: {
  user: { id: string };
  partnership: Partnership;
  week: string;
  reflection: Reflection | null;
  myName: string;
  onChanged: () => void;
}) {
  const [wentWell, setWentWell] = useState("");
  const [wasHard, setWasHard] = useState("");
  const [appreciation, setAppreciation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setWentWell(reflection?.went_well ?? "");
    setWasHard(reflection?.was_hard ?? "");
    setAppreciation(reflection?.appreciation_for_partner ?? "");
  }, [reflection]);

  const submitted = !!reflection?.submitted_at;
  const canSubmit = wentWell.trim() || wasHard.trim() || appreciation.trim();

  async function saveDraft() {
    setBusy(true);
    const payload = {
      partnership_id: partnership.id,
      owner_id: user.id,
      week_start: week,
      went_well: wentWell.trim() || null,
      was_hard: wasHard.trim() || null,
      appreciation_for_partner: appreciation.trim() || null,
    };
    const { error } = await supabase.from("weekly_reflections").upsert(payload as never, {
      onConflict: "partnership_id,week_start,owner_id",
    });
    if (error) toast.error(error.message);
    else { toast.success("Draft saved."); onChanged(); }
    setBusy(false);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    const payload = {
      partnership_id: partnership.id,
      owner_id: user.id,
      week_start: week,
      went_well: wentWell.trim() || null,
      was_hard: wasHard.trim() || null,
      appreciation_for_partner: appreciation.trim() || null,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("weekly_reflections").upsert(payload as never, {
      onConflict: "partnership_id,week_start,owner_id",
    });
    if (error) toast.error(error.message);
    else { toast.success("Submitted. Locked in."); onChanged(); }
    setBusy(false);
  }

  return (
    <section className={`rounded-3xl border p-6 shadow-soft ${submitted ? "border-lavender-deep/30 bg-gradient-soft" : "border-border bg-card"}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">You</p>
          <h2 className="mt-0.5 font-display text-xl font-semibold">{myName}</h2>
        </div>
        {submitted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender-deep px-3 py-1 text-xs font-semibold text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} /> Submitted
          </span>
        )}
      </div>

      <Field
        label="What went well this week?"
        value={wentWell}
        onChange={setWentWell}
        disabled={submitted}
        placeholder="A win, a moment, a small joy…"
      />
      <Field
        label="What was hard?"
        value={wasHard}
        onChange={setWasHard}
        disabled={submitted}
        placeholder="Be honest. This is for both of you."
      />
      <Field
        label="One thing you appreciated about your partner"
        value={appreciation}
        onChange={setAppreciation}
        disabled={submitted}
        placeholder="Something specific. They'll see it."
      />

      {!submitted && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Submit reflection
          </button>
          <button
            onClick={saveDraft}
            disabled={busy}
            className="rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-60"
          >
            Save draft
          </button>
        </div>
      )}
      {submitted && (
        <p className="mt-4 text-xs text-muted-foreground">
          Locked in. Reflections are final once submitted — that's the point.
        </p>
      )}
    </section>
  );
}

function PartnerReflectionCard({
  reflection, partnerName, bothSubmitted, partnerSubmitted,
}: {
  reflection: Reflection | null;
  partnerName: string;
  bothSubmitted: boolean;
  partnerSubmitted: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your partner</p>
          <h2 className="mt-0.5 font-display text-xl font-semibold">{partnerName}</h2>
        </div>
        {partnerSubmitted && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender-deep px-3 py-1 text-xs font-semibold text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} /> Submitted
          </span>
        )}
      </div>

      {!bothSubmitted ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary/40 px-6 py-12 text-center">
          <Lock className="h-6 w-6 text-lavender-deep" />
          <p className="mt-3 font-display text-base font-semibold">
            {partnerSubmitted ? `${partnerName} has submitted.` : `${partnerName} hasn't submitted yet.`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Their reflection unlocks when you both submit.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ReadField label="What went well" value={reflection?.went_well} />
          <ReadField label="What was hard" value={reflection?.was_hard} />
          <ReadField label="What they appreciated about you" value={reflection?.appreciation_for_partner} highlight />
        </div>
      )}
    </section>
  );
}

function Field({
  label, value, onChange, disabled, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="mt-4">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        maxLength={1000}
        className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}

function ReadField({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1.5 whitespace-pre-wrap rounded-xl p-3 text-sm ${
        highlight ? "bg-gradient-soft text-foreground" : "bg-secondary/40 text-foreground"
      } ${!value ? "italic text-muted-foreground" : ""}`}>
        {value || "(left blank)"}
      </p>
    </div>
  );
}
