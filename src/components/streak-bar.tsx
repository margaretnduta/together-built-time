import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, HeartHandshake, Lock } from "lucide-react";

type Props = {
  partnershipId?: string | null;
  userId: string;
};

export function StreakBar({ partnershipId, userId }: Props) {
  const [daily, setDaily] = useState(0);
  const [couple, setCouple] = useState(0);
  const [personal, setPersonal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const calls: Promise<unknown>[] = [
      supabase.rpc("get_personal_streak").then(({ data }) => setPersonal((data as number) ?? 0)),
    ];
    if (partnershipId) {
      calls.push(
        supabase.rpc("get_daily_streak", { _partnership_id: partnershipId })
          .then(({ data }) => setDaily((data as number) ?? 0)),
        supabase.rpc("get_monthly_couple_streak", { _partnership_id: partnershipId })
          .then(({ data }) => setCouple((data as number) ?? 0)),
      );
    }
    await Promise.all(calls);
    setLoaded(true);
  }, [partnershipId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when any of the underlying tables change
  useEffect(() => {
    const ch = supabase.channel(`streaks-${userId}-${partnershipId ?? "none"}`);
    if (partnershipId) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "daily_tasks", filter: `partnership_id=eq.${partnershipId}` }, () => load());
      ch.on("postgres_changes", { event: "*", schema: "public", table: "couple_goals", filter: `partnership_id=eq.${partnershipId}` }, () => load());
    }
    ch.on("postgres_changes", { event: "*", schema: "public", table: "personal_goals", filter: `owner_id=eq.${userId}` }, () => load());
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, partnershipId, load]);

  if (!loaded) return null;

  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      <StreakPill
        icon={<Flame className="h-4 w-4" />}
        label="Daily together"
        value={daily}
        unit={daily === 1 ? "day" : "days"}
        tint="from-rose-200/60 to-orange-200/60"
        disabled={!partnershipId}
      />
      <StreakPill
        icon={<HeartHandshake className="h-4 w-4" />}
        label="Couple months"
        value={couple}
        unit={couple === 1 ? "month" : "months"}
        tint="from-pink-200/60 to-violet-200/60"
        disabled={!partnershipId}
      />
      <StreakPill
        icon={<Lock className="h-4 w-4" />}
        label="Your private"
        value={personal}
        unit={personal === 1 ? "month" : "months"}
        tint="from-violet-200/60 to-indigo-200/60"
      />
    </div>
  );
}

function StreakPill({
  icon, label, value, unit, tint, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tint: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tint} opacity-50`} />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold text-lavender-deep">{value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
