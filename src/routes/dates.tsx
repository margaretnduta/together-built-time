import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Heart, Loader2, LogOut, Sparkles, CalendarHeart, Cake, Repeat, Star, X, Plus, CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { StreakBar } from "@/components/streak-bar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dates")({
  head: () => ({ meta: [{ title: "Important Dates — TwoGether" }] }),
  component: DatesPage,
});

type Partnership = { id: string; partner_a_id: string; partner_b_id: string | null; status: string };
type Category = "anniversary" | "birthday" | "ritual" | "other";
type Recurrence = "none" | "yearly" | "monthly";
type ImportantDate = {
  id: string;
  partnership_id: string;
  created_by: string;
  title: string;
  date: string;
  category: Category;
  recurrence: Recurrence;
  notes: string | null;
};

function DatesPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [loadingP, setLoadingP] = useState(true);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const loadPartnership = useCallback(async () => {
    if (!user) return;
    setLoadingP(true);
    const { data } = await supabase
      .from("partnerships").select("*")
      .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
      .eq("status", "active").maybeSingle();
    setPartnership(data as Partnership | null);
    setLoadingP(false);
  }, [user]);

  useEffect(() => { loadPartnership(); }, [loadPartnership]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (loading || loadingP || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-lavender-deep" /></div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <TopNav onSignOut={signOut} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        {!partnership ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
            <Sparkles className="mx-auto h-8 w-8 text-lavender-deep" />
            <h1 className="mt-4 font-display text-3xl font-semibold">Form a partnership first.</h1>
            <p className="mt-3 text-muted-foreground">Important dates live between the two of you.</p>
            <Link to="/app" className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft">
              Go to setup
            </Link>
          </div>
        ) : (
          <>
            <StreakBar userId={user.id} partnershipId={partnership.id} />
            <DatesView user={user} partnership={partnership} />
          </>
        )}
      </div>
    </main>
  );
}


// Compute next occurrence of a date given its recurrence.
function nextOccurrence(iso: string, rec: Recurrence): Date {
  const base = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (rec === "none") return base;

  const next = new Date(base);
  if (rec === "yearly") {
    next.setFullYear(today.getFullYear());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
  } else if (rec === "monthly") {
    next.setFullYear(today.getFullYear());
    next.setMonth(today.getMonth());
    if (next < today) next.setMonth(today.getMonth() + 1);
  }
  return next;
}

function daysUntil(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function countdownLabel(n: number) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return `${Math.abs(n)} days ago`;
  if (n < 30) return `In ${n} days`;
  const months = Math.round(n / 30);
  if (months < 12) return `In ${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(n / 365);
  return `In ${years} year${years === 1 ? "" : "s"}`;
}

function yearsSince(iso: string, occurrence: Date) {
  const base = new Date(iso + "T00:00:00");
  return occurrence.getFullYear() - base.getFullYear();
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  anniversary: { label: "Anniversary", icon: CalendarHeart, tint: "from-rose-200/70 to-pink-200/70" },
  birthday:    { label: "Birthday",    icon: Cake,          tint: "from-amber-200/70 to-pink-200/70" },
  ritual:      { label: "Ritual",      icon: Repeat,        tint: "from-violet-200/70 to-indigo-200/70" },
  other:       { label: "Other",       icon: Star,          tint: "from-slate-200/70 to-violet-200/70" },
};

function DatesView({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [items, setItems] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("important_dates").select("*").eq("partnership_id", partnership.id);
    setItems((data as ImportantDate[]) ?? []);
    setLoading(false);
  }, [partnership.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`dates-${partnership.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "important_dates", filter: `partnership_id=eq.${partnership.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnership.id, load]);

  const enriched = useMemo(() => {
    return items
      .map((it) => {
        const occ = nextOccurrence(it.date, it.recurrence);
        return { it, occ, days: daysUntil(occ) };
      })
      .sort((a, b) => a.days - b.days);
  }, [items]);

  const upcoming = enriched.find((e) => e.days >= 0);

  async function remove(id: string) {
    const { error } = await supabase.from("important_dates").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">The days that matter</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Important Dates</h1>
        </div>
      </div>

      {/* Next-up hero */}
      {upcoming && (
        <div className="mb-8 overflow-hidden rounded-3xl border border-lavender-deep/30 bg-gradient-primary p-6 text-primary-foreground shadow-soft">
          <p className="text-xs uppercase tracking-widest opacity-80">Coming up next</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-semibold leading-tight">{upcoming.it.title}</p>
              <p className="mt-1 text-sm opacity-90">
                {upcoming.occ.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                {upcoming.it.recurrence === "yearly" && yearsSince(upcoming.it.date, upcoming.occ) > 0 &&
                  ` · ${yearsSince(upcoming.it.date, upcoming.occ)} year${yearsSince(upcoming.it.date, upcoming.occ) === 1 ? "" : "s"}`}
              </p>
            </div>
            <p className="font-display text-3xl font-semibold">{countdownLabel(upcoming.days)}</p>
          </div>
        </div>
      )}

      {/* Add form */}
      <AddDateForm user={user} partnership={partnership} />

      {/* List */}
      <ul className="mt-6 space-y-3">
        {loading && (
          <li className="rounded-2xl bg-secondary/30 p-6 text-center text-sm text-muted-foreground">Loading…</li>
        )}
        {!loading && enriched.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No dates yet. Add the first one above.
          </li>
        )}
        {enriched.map(({ it, occ, days }) => {
          const meta = CATEGORY_META[it.category];
          const Icon = meta.icon;
          const years = it.recurrence === "yearly" ? yearsSince(it.date, occ) : 0;
          return (
            <li key={it.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${meta.tint} opacity-30`} />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card shadow-soft">
                  <Icon className="h-5 w-5 text-lavender-deep" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-display text-lg font-semibold">{it.title}</p>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">{meta.label}</span>
                    {it.recurrence !== "none" && (
                      <span className="text-xs text-muted-foreground">· {it.recurrence}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {occ.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                    {years > 0 && ` · ${years} year${years === 1 ? "" : "s"}`}
                  </p>
                  {it.notes && <p className="mt-2 text-sm text-foreground/80">{it.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    days < 0 ? "bg-secondary text-muted-foreground" :
                    days <= 7 ? "bg-lavender-deep text-primary-foreground" :
                    "bg-secondary text-foreground"
                  )}>
                    {countdownLabel(days)}
                  </span>
                  <button onClick={() => remove(it.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete">
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AddDateForm({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [category, setCategory] = useState<Category>("anniversary");
  const [recurrence, setRecurrence] = useState<Recurrence>("yearly");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setBusy(true);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const { error } = await supabase.from("important_dates").insert({
      partnership_id: partnership.id,
      created_by: user.id,
      title: title.trim(),
      date: iso,
      category,
      recurrence,
      notes: notes.trim() || null,
    } as never);
    if (error) toast.error(error.message);
    else {
      setTitle(""); setDate(undefined); setNotes("");
      setCategory("anniversary"); setRecurrence("yearly");
      toast.success("Date saved 💖");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold">Add a date</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Our first date" maxLength={120}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-left",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {date ? date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Pick a date"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setOpen(false); }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
              const Icon = CATEGORY_META[c].icon;
              const active = c === category;
              return (
                <button
                  key={c} type="button" onClick={() => setCategory(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    active ? "bg-gradient-primary text-primary-foreground shadow-soft" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {CATEGORY_META[c].label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">Repeats</p>
          <div className="flex flex-wrap gap-1.5">
            {(["yearly", "monthly", "none"] as Recurrence[]).map((r) => {
              const active = r === recurrence;
              return (
                <button
                  key={r} type="button" onClick={() => setRecurrence(r)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition",
                    active ? "bg-gradient-primary text-primary-foreground shadow-soft" : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "none" ? "One-time" : r}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes (where, why it matters…)" maxLength={500} rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
      />

      <button
        type="submit" disabled={busy || !title.trim() || !date}
        className="mt-3 flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Save date
      </button>
    </form>
  );
}
