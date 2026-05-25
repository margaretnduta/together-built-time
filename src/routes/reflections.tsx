import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Sparkles, Lock, Check, BookOpen, Pencil, Eye, EyeOff } from "lucide-react";
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
  visibility: "private" | "shared";
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
      <TopNav onSignOut={signOut} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
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

      <PreviousReflections
        userId={user.id}
        partnershipId={partnership.id}
        currentWeek={week}
        onJump={(iso) => setWeek(iso)}
        myName={myName}
        partnerName={partnerName}
        partnerId={partnerId}
      />
    </div>
  );
}

function PreviousReflections({
  userId, partnershipId, currentWeek, onJump, myName, partnerName, partnerId,
}: {
  userId: string;
  partnershipId: string;
  currentWeek: string;
  onJump: (iso: string) => void;
  myName: string;
  partnerName: string;
  partnerId: string;
}) {
  const [items, setItems] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("weekly_reflections")
      .select("*")
      .eq("partnership_id", partnershipId)
      .not("submitted_at", "is", null)
      .lt("week_start", currentWeek)
      .order("week_start", { ascending: false })
      .limit(40);
    setItems((data as Reflection[]) ?? []);
    setLoading(false);
  }, [partnershipId, currentWeek]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`reflections-history-${partnershipId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "weekly_reflections", filter: `partnership_id=eq.${partnershipId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnershipId, load]);

  // Group by week_start so each row pairs my + partner's reflection.
  const grouped = useMemo(() => {
    const map = new Map<string, { mine?: Reflection; partner?: Reflection }>();
    for (const r of items) {
      const entry = map.get(r.week_start) ?? {};
      if (r.owner_id === userId) entry.mine = r;
      else if (r.owner_id === partnerId) entry.partner = r;
      map.set(r.week_start, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [items, userId, partnerId]);

  return (
    <section className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-lavender-deep" />
        <h3 className="font-display text-lg font-semibold">Previous reflections</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Browse what you've shared over time.</p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-lavender-deep" /></div>
      ) : grouped.length === 0 ? (
        <p className="rounded-2xl bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
          No past reflections yet. They'll show up here once you submit your first one.
        </p>
      ) : (
        <ul className="space-y-2">
          {grouped.map(([wk, { mine, partner }]) => (
            <li key={wk}>
              <details className="rounded-2xl border border-border bg-background">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-display text-base font-semibold">{weekLabel(wk)}</p>
                    <p className="text-xs text-muted-foreground">
                      {mine ? `${myName} ✓` : `${myName} —`} · {partner ? `${partnerName} ✓` : `${partnerName} —`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onJump(wk); }}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-secondary"
                  >
                    Open week
                  </button>
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  <PreviousReflectionPreview label={myName} reflection={mine} />
                  <PreviousReflectionPreview label={partnerName} reflection={partner} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviousReflectionPreview({ label, reflection }: { label: string; reflection: Reflection | undefined }) {
  if (!reflection) {
    return (
      <div className="rounded-xl bg-secondary/30 p-3 text-xs italic text-muted-foreground">
        {label} did not submit this week.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-secondary/30 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {reflection.went_well && <p><span className="font-medium">Went well:</span> {reflection.went_well}</p>}
      {reflection.was_hard && <p className="mt-1"><span className="font-medium">Was hard:</span> {reflection.was_hard}</p>}
      {reflection.appreciation_for_partner && <p className="mt-1"><span className="font-medium">Appreciation:</span> {reflection.appreciation_for_partner}</p>}
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
  const [visibility, setVisibility] = useState<"private" | "shared">("shared");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setWentWell(reflection?.went_well ?? "");
    setWasHard(reflection?.was_hard ?? "");
    setAppreciation(reflection?.appreciation_for_partner ?? "");
    setVisibility(reflection?.visibility ?? "shared");
    setEditing(false);
  }, [reflection]);

  const submitted = !!reflection?.submitted_at;
  const canSubmit = wentWell.trim() || wasHard.trim() || appreciation.trim();

  // Saturday gate (locally): allow writing only on Saturdays, for the current week.
  const today = new Date();
  const isSaturday = today.getDay() === 6;
  const isCurrentWeek = week === weekISO();
  const writeAllowed = isSaturday && isCurrentWeek;
  const locked = !writeAllowed && !submitted;
  const inputsDisabled = (submitted && !editing) || locked;

  async function persist(opts: { submit?: boolean; vis?: "private" | "shared" } = {}) {
    setBusy(true);
    const payload: Record<string, unknown> = {
      partnership_id: partnership.id,
      owner_id: user.id,
      week_start: week,
      went_well: wentWell.trim() || null,
      was_hard: wasHard.trim() || null,
      appreciation_for_partner: appreciation.trim() || null,
      visibility: opts.vis ?? visibility,
    };
    if (opts.submit) payload.submitted_at = new Date().toISOString();
    const { error } = await supabase.from("weekly_reflections").upsert(payload as never, {
      onConflict: "partnership_id,week_start,owner_id",
    });
    if (error) toast.error(error.message);
    else {
      if (opts.submit) toast.success("Submitted.");
      else if (opts.vis) toast.success(opts.vis === "shared" ? "Now shared with partner." : "Now private.");
      else toast.success("Saved.");
      onChanged();
      setEditing(false);
    }
    setBusy(false);
  }

  async function toggleVisibility() {
    const next = visibility === "shared" ? "private" : "shared";
    setVisibility(next);
    await persist({ vis: next });
  }

  return (
    <section className={`rounded-3xl border p-6 shadow-soft ${submitted ? "border-lavender-deep/30 bg-gradient-soft" : "border-border bg-card"}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">You</p>
          <h2 className="mt-0.5 font-display text-xl font-semibold">{myName}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {submitted && (
            <button
              onClick={toggleVisibility}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold transition hover:bg-secondary disabled:opacity-60"
              title={visibility === "shared" ? "Shared with partner — click to make private" : "Private — click to share"}
            >
              {visibility === "shared" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {visibility === "shared" ? "Shared" : "Private"}
            </button>
          )}
          {submitted && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender-deep px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
              <Check className="h-3 w-3" strokeWidth={3} /> Submitted
            </span>
          )}
        </div>
      </div>

      {locked && (
        <div className="mb-4 rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-sm">
          <p className="font-semibold">Reflections open on Saturdays.</p>
          <p className="mt-1 text-muted-foreground">
            {isCurrentWeek
              ? "Come back this Saturday to write your weekly reflection."
              : "You can only write reflections during the current week, on Saturday."}
          </p>
        </div>
      )}

      <Field label="What went well this week?" value={wentWell} onChange={setWentWell} disabled={inputsDisabled} placeholder="A win, a moment, a small joy…" />
      <Field label="What was hard?" value={wasHard} onChange={setWasHard} disabled={inputsDisabled} placeholder="Be honest. This is for both of you." />
      <Field label="One thing you appreciated about your partner" value={appreciation} onChange={setAppreciation} disabled={inputsDisabled} placeholder="Something specific. They'll see it." />

      {!submitted && writeAllowed && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => persist({ submit: true })}
            disabled={busy || !canSubmit}
            className="flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Submit reflection
          </button>
          <button onClick={() => persist()} disabled={busy} className="rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-60">
            Save draft
          </button>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={visibility === "shared"} onChange={(e) => setVisibility(e.target.checked ? "shared" : "private")} className="h-3.5 w-3.5" />
            Share with partner after both submit
          </label>
        </div>
      )}

      {submitted && !editing && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-secondary"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <p className="text-xs text-muted-foreground">You can refine your words — submission timestamp is preserved.</p>
        </div>
      )}

      {submitted && editing && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => persist()} disabled={busy} className="flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save changes
          </button>
          <button onClick={() => { setEditing(false); setWentWell(reflection?.went_well ?? ""); setWasHard(reflection?.was_hard ?? ""); setAppreciation(reflection?.appreciation_for_partner ?? ""); }} className="rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-medium transition hover:bg-accent">
            Cancel
          </button>
        </div>
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
