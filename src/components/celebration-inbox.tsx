import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, PartyPopper, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Celebration = {
  id: string;
  partnership_id: string;
  honoree_id: string;
  celebrant_id: string;
  month: string;
  goal_count: number;
  message: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

type Profile = { id: string; display_name: string };

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function CelebrationInbox({
  userId,
  partnershipId,
  partnerName,
}: {
  userId: string;
  partnershipId: string;
  partnerName: string;
}) {
  const [items, setItems] = useState<Celebration[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("celebrations")
      .select("*")
      .eq("partnership_id", partnershipId)
      .order("created_at", { ascending: false });
    setItems((data as Celebration[]) ?? []);

    const ids = Array.from(new Set((data as Celebration[] | null ?? []).flatMap((c) => [c.honoree_id, c.celebrant_id])));
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map: Record<string, Profile> = {};
      (p as Profile[] | null)?.forEach((row) => (map[row.id] = row));
      setProfiles(map);
    }
  }, [partnershipId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`celebrations-${partnershipId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "celebrations", filter: `partnership_id=eq.${partnershipId}` },
        (payload) => {
          load();
          // Notify the partner when a new celebration arrives where THEY are the celebrant
          if (payload.eventType === "INSERT") {
            const row = payload.new as Celebration;
            if (row.celebrant_id === userId) {
              toast.success(`🎉 ${partnerName} completed all their private goals — go celebrate them!`);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnershipId, userId, partnerName, load]);

  async function sendCelebration(c: Celebration) {
    setBusyId(c.id);
    const message = (drafts[c.id] ?? "").trim() || null;
    const { error } = await supabase
      .from("celebrations")
      .update({ message, acknowledged_at: new Date().toISOString() } as never)
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else toast.success("Celebration sent 💖");
    setBusyId(null);
  }

  // For the current user: pending celebrations TO send (you are the celebrant, not yet acknowledged)
  const toSend = items.filter((c) => c.celebrant_id === userId && !c.acknowledged_at);
  // Celebrations you RECEIVED (you are honoree) that the partner acknowledged with a message
  const received = items.filter((c) => c.honoree_id === userId && c.acknowledged_at);

  if (toSend.length === 0 && received.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {toSend.map((c) => {
        const honoreeName = profiles[c.honoree_id]?.display_name ?? partnerName;
        return (
          <div
            key={c.id}
            className="rounded-3xl border border-lavender-deep/40 bg-gradient-soft p-6 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card">
                <PartyPopper className="h-5 w-5 text-lavender-deep" />
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">
                  {honoreeName} finished all {c.goal_count} private goal{c.goal_count === 1 ? "" : "s"} for {monthLabel(c.month)}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send them some love. They worked for this — and only you can see this prompt.
                </p>
                <textarea
                  value={drafts[c.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  placeholder="Say something kind (optional)…"
                  maxLength={400}
                  rows={2}
                  className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
                />
                <button
                  onClick={() => sendCelebration(c)}
                  disabled={busyId === c.id}
                  className="mt-3 flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
                >
                  {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Send celebration
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {received.map((c) => {
        const fromName = profiles[c.celebrant_id]?.display_name ?? partnerName;
        return (
          <div
            key={c.id}
            className="rounded-3xl border border-lavender-deep/40 bg-gradient-primary p-6 text-primary-foreground shadow-soft"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest opacity-80">
                  {fromName} is celebrating you — {monthLabel(c.month)}
                </p>
                {c.message ? (
                  <p className="mt-2 font-display text-xl leading-snug">"{c.message}"</p>
                ) : (
                  <p className="mt-2 font-display text-xl leading-snug">
                    All {c.goal_count} private goal{c.goal_count === 1 ? "" : "s"} done. {fromName} sees you. 💖
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
