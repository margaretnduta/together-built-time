import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Sparkles, CalendarHeart, Cake, Repeat, Star, X, Plus, CalendarIcon, Shirt, Clock, Pencil, Check, Ban, ListChecks } from "lucide-react";
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
  event_time: string | null;
  category: Category;
  recurrence: Recurrence;
  notes: string | null;
  dress_code: string | null;
  deliverables: string[];
  approval_status: "pending" | "accepted" | "declined" | "cancelled";
  proposed_by: string | null;
  approved_by: string[];
  decline_reason: string | null;
  declined_by: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
};

function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Deliverables are stored as plain strings. We encode the "done" state with
// a leading "[x] " or "[ ] " marker so the existing text[] column is enough.
function parseDeliverable(raw: string): { text: string; done: boolean } {
  const m = /^\[(x| )\]\s?(.*)$/.exec(raw);
  if (m) return { text: m[2], done: m[1] === "x" };
  return { text: raw, done: false };
}
function serializeDeliverable(d: { text: string; done: boolean }): string {
  return `[${d.done ? "x" : " "}] ${d.text}`;
}

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

  const accepted = useMemo(() => items.filter(i => i.approval_status === "accepted"), [items]);
  const pendingForMe = useMemo(() => items.filter(i => i.approval_status === "pending" && !(i.approved_by ?? []).includes(user.id)), [items, user.id]);
  const pendingByMe = useMemo(() => items.filter(i => i.approval_status === "pending" && i.proposed_by === user.id), [items, user.id]);
  const cancelled = useMemo(() => items.filter(i => i.approval_status === "cancelled").slice(0, 5), [items]);
  const declined = useMemo(() => items.filter(i => i.approval_status === "declined").slice(0, 5), [items]);

  const enriched = useMemo(() => {
    return accepted
      .map((it) => {
        const occ = nextOccurrence(it.date, it.recurrence);
        return { it, occ, days: daysUntil(occ) };
      })
      .sort((a, b) => a.days - b.days);
  }, [accepted]);

  const upcoming = enriched.find((e) => e.days >= 0);

  async function remove(id: string) {
    const { error } = await supabase.from("important_dates").delete().eq("id", id);
    if (error) toast.error(error.message);
  }
  async function approve(it: ImportantDate) {
    const next = Array.from(new Set([...(it.approved_by ?? []), user.id]));
    const { error } = await supabase.from("important_dates").update({ approved_by: next, approval_status: "accepted" } as never).eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success("Accepted 💞");
  }
  async function decline(it: ImportantDate, reason: string) {
    const { error } = await supabase.from("important_dates").update({
      approval_status: "declined", decline_reason: reason || null, declined_by: user.id,
    } as never).eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success("Declined — your partner will be notified.");
  }
  async function cancel(it: ImportantDate, reason: string) {
    const { error } = await supabase.from("important_dates").update({
      approval_status: "cancelled", cancellation_reason: reason || null, cancelled_by: user.id, cancelled_at: new Date().toISOString(),
    } as never).eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success("Cancelled — your partner will be notified.");
  }
  async function toggleDeliverable(it: ImportantDate, idx: number) {
    const current = it.deliverables ?? [];
    const parsed = current.map(parseDeliverable);
    parsed[idx] = { text: parsed[idx].text, done: !parsed[idx].done };
    const next = parsed.map(serializeDeliverable);
    const { error } = await supabase.from("important_dates").update({ deliverables: next } as never).eq("id", it.id);
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
                {upcoming.it.event_time && ` · ${formatTime(upcoming.it.event_time)}`}
                {upcoming.it.recurrence === "yearly" && yearsSince(upcoming.it.date, upcoming.occ) > 0 &&
                  ` · ${yearsSince(upcoming.it.date, upcoming.occ)} year${yearsSince(upcoming.it.date, upcoming.occ) === 1 ? "" : "s"}`}
              </p>
              {upcoming.it.dress_code && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <Shirt className="h-3.5 w-3.5" /> {upcoming.it.dress_code}
                </p>
              )}
            </div>
            <p className="font-display text-3xl font-semibold">{countdownLabel(upcoming.days)}</p>
          </div>
        </div>
      )}

      {/* Pending partner approval (incoming) */}
      {pendingForMe.length > 0 && (
        <div className="mb-6 rounded-3xl border border-lavender-deep/30 bg-gradient-soft p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-widest text-lavender-deep">Waiting for your approval</p>
          <ul className="mt-3 space-y-2">
            {pendingForMe.map(it => (
              <li key={it.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex-1">
                  <p className="font-display text-base font-semibold">{it.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {new Date(it.date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    {it.event_time && ` · ${formatTime(it.event_time)}`}
                    {` · ${CATEGORY_META[it.category].label}`}
                  </p>
                  {it.dress_code && <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1"><Shirt className="h-3 w-3" />{it.dress_code}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(it)} className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft">Accept</button>
                  <button onClick={() => remove(it.id)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive">Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending — your proposals (editable) */}
      {pendingByMe.length > 0 && (
        <div className="mb-6 rounded-3xl border border-border bg-card/60 p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your proposals · awaiting partner</p>
          <ul className="mt-3 space-y-2">
            {pendingByMe.map(it => (
              <EditableDateRow key={it.id} it={it} onRemove={() => remove(it.id)} />
            ))}
          </ul>
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
            No accepted dates yet. Add one above — your partner will approve it.
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
                    {it.event_time && ` · ${formatTime(it.event_time)}`}
                    {years > 0 && ` · ${years} year${years === 1 ? "" : "s"}`}
                  </p>
                  {it.dress_code && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground/80">
                      <Shirt className="h-4 w-4 text-lavender-deep" /> <span className="font-medium">Dress:</span> {it.dress_code}
                    </p>
                  )}
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
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <EditDateButton it={it} />
                    <button onClick={() => remove(it.id)} aria-label="Delete">
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =========== Inline editable row for the proposer's pending dates ===========
function EditableDateRow({ it, onRemove }: { it: ImportantDate; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      {editing ? (
        <DateEditor it={it} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-display text-base font-semibold">{it.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {new Date(it.date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              {it.event_time && ` · ${formatTime(it.event_time)}`}
              {` · ${CATEGORY_META[it.category].label}`}
            </p>
            {it.dress_code && <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1"><Shirt className="h-3 w-3" />{it.dress_code}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <Pencil className="inline h-3 w-3 mr-1" />Edit
            </button>
            <button onClick={onRemove} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive">
              Withdraw
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// Compact button that opens an inline editor in a popover-like dialog
function EditDateButton({ it }: { it: ImportantDate }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label="Edit date"><Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <DateEditor it={it} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function DateEditor({ it, onDone }: { it: ImportantDate; onDone: () => void }) {
  const [title, setTitle] = useState(it.title);
  const [date, setDate] = useState<Date | undefined>(new Date(it.date + "T00:00:00"));
  const [time, setTime] = useState<string>(it.event_time?.slice(0, 5) ?? "");
  const [dressCode, setDressCode] = useState(it.dress_code ?? "");
  const [busy, setBusy] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  async function save() {
    if (!title.trim() || !date) return;
    setBusy(true);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const { error } = await supabase.from("important_dates").update({
      title: title.trim(),
      date: iso,
      event_time: time || null,
      dress_code: dressCode.trim() || null,
    } as never).eq("id", it.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); onDone(); }
  }

  return (
    <div className="space-y-2">
      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Date"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCalOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <Clock className="h-3.5 w-3.5 shrink-0 text-lavender-deep" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="flex-1 bg-transparent text-xs focus:outline-none" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2">
        <Shirt className="h-3.5 w-3.5 shrink-0 text-lavender-deep" />
        <input type="text" value={dressCode} onChange={(e) => setDressCode(e.target.value)} placeholder="Dress code (optional)" maxLength={200} className="flex-1 bg-transparent text-xs focus:outline-none" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onDone} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs">Cancel</button>
        <button onClick={save} disabled={busy} className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
          {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <Check className="inline h-3 w-3 mr-1" />}Save
        </button>
      </div>
    </div>
  );
}

function AddDateForm({ user, partnership }: { user: { id: string }; partnership: Partnership }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<Category>("anniversary");
  const [recurrence, setRecurrence] = useState<Recurrence>("yearly");
  const [notes, setNotes] = useState("");
  const [dressCode, setDressCode] = useState("");
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
      event_time: time || null,
      category,
      recurrence,
      notes: notes.trim() || null,
      dress_code: dressCode.trim() || null,
      proposed_by: user.id,
      approved_by: [user.id],
      approval_status: "pending",
    } as never);
    if (error) toast.error(error.message);
    else {
      setTitle(""); setDate(undefined); setTime(""); setNotes(""); setDressCode("");
      setCategory("anniversary"); setRecurrence("yearly");
      toast.success("Sent for partner approval 💌");
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

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5">
        <Clock className="h-4 w-4 shrink-0 text-lavender-deep" />
        <input
          type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none"
          aria-label="Time (optional)"
        />
        <span className="text-xs text-muted-foreground">optional</span>
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

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5">
        <Shirt className="h-4 w-4 shrink-0 text-lavender-deep" />
        <input
          type="text" value={dressCode} onChange={(e) => setDressCode(e.target.value)}
          placeholder="Dress code / attire (optional)" maxLength={200}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
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
        Propose date
      </button>
    </form>
  );
}
