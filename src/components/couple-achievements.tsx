import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarHeart, CalendarDays, HeartHandshake, Trophy, Flame } from "lucide-react";

type Props = {
  userId: string;
  partnershipId: string;
  formedAt: string | null;
};

/**
 * Real-time "Couple achievements" module.
 * Replaces the old private-months pill on the dashboard with the milestones
 * that actually belong to the partnership: days together, months together,
 * important dates already lived, and couple goals checked off.
 */
export function CoupleAchievements({ userId, partnershipId, formedAt }: Props) {
  const [datesDone, setDatesDone] = useState(0);
  const [goalsDone, setGoalsDone] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const [datesRes, goalsRes, streakRes] = await Promise.all([
      supabase
        .from("important_dates")
        .select("id", { count: "exact", head: true })
        .eq("partnership_id", partnershipId)
        .eq("approval_status", "accepted")
        .eq("is_done", true),
      supabase
        .from("couple_goals")
        .select("id", { count: "exact", head: true })
        .eq("partnership_id", partnershipId)
        .eq("approval_status", "accepted")
        .eq("is_complete", true),
      supabase.rpc("get_daily_streak", { _partnership_id: partnershipId }),
    ]);
    setDatesDone(datesRes.count ?? 0);
    setGoalsDone(goalsRes.count ?? 0);
    setDailyStreak((streakRes.data as number) ?? 0);
    setLoaded(true);
  }, [partnershipId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh whenever any contributing table changes
  useEffect(() => {
    const ch = supabase
      .channel(`couple-achievements-${partnershipId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "important_dates", filter: `partnership_id=eq.${partnershipId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_goals",   filter: `partnership_id=eq.${partnershipId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_tasks",    filter: `partnership_id=eq.${partnershipId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnershipId, userId, load]);

  const days = formedAt ? Math.max(0, Math.round((Date.now() - new Date(formedAt).getTime()) / 86400000)) + 1 : 0;
  const months = Math.floor(days / 30);

  if (!loaded) return null;

  return (
    <section className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-lavender-deep" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Couple achievements
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="Days together"   value={days}        unit={days === 1 ? "day" : "days"}      tint="from-rose-200/60 to-pink-200/60" />
        <Stat icon={<HeartHandshake className="h-4 w-4" />} label="Months together" value={months}      unit={months === 1 ? "month" : "months"} tint="from-pink-200/60 to-violet-200/60" />
        <Stat icon={<CalendarHeart className="h-4 w-4" />}  label="Dates lived"     value={datesDone}   unit={datesDone === 1 ? "date" : "dates"} tint="from-amber-200/60 to-rose-200/60" />
        <Stat icon={<Trophy className="h-4 w-4" />}         label="Goals achieved"  value={goalsDone}   unit={goalsDone === 1 ? "goal" : "goals"} tint="from-violet-200/60 to-indigo-200/60" />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        <Flame className="h-3.5 w-3.5 text-lavender-deep" />
        <span><span className="font-semibold text-foreground">{dailyStreak}</span> {dailyStreak === 1 ? "day" : "days"} in a row you both completed all today tasks.</span>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, unit, tint }: { icon: React.ReactNode; label: string; value: number; unit: string; tint: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tint} opacity-50`} />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {icon}<span className="truncate">{label}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold text-lavender-deep">{value}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
