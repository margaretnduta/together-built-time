import { useEffect, useMemo, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  body: string;
  at: number; // timestamp ms
  href?: string;
};

type Partnership = {
  id: string;
  partner_a_id: string;
  partner_b_id: string | null;
  status: string;
};

const LS_KEY = "tg.notifs.v1";
const LS_SEEN = "tg.notifs.seen.v1";

function loadStored(): { items: Notif[]; seenAt: number } {
  if (typeof window === "undefined") return { items: [], seenAt: 0 };
  try {
    const items = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Notif[];
    const seenAt = Number(localStorage.getItem(LS_SEEN) ?? "0");
    return { items: items.slice(0, 30), seenAt };
  } catch {
    return { items: [], seenAt: 0 };
  }
}

function persist(items: Notif[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 30))); } catch { /* ignore */ }
}
function persistSeen(t: number) {
  try { localStorage.setItem(LS_SEEN, String(t)); } catch { /* ignore */ }
}

function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [items, setItems] = useState<Notif[]>(() => loadStored().items);
  const [seenAt, setSeenAt] = useState<number>(() => loadStored().seenAt);
  const [open, setOpen] = useState(false);
  // partner readiness gate (so we don't toast on every percentage change)
  const [partnerNearToasted, setPartnerNearToasted] = useState(false);
  const [partnerFullToasted, setPartnerFullToasted] = useState(false);

  const partnerId = useMemo(() => {
    if (!partnership || !user) return null;
    return partnership.partner_a_id === user.id ? partnership.partner_b_id : partnership.partner_a_id;
  }, [partnership, user]);

  const push = useCallback((n: Omit<Notif, "id" | "at">) => {
    setItems((prev) => {
      const next: Notif[] = [{ ...n, id: crypto.randomUUID(), at: Date.now() }, ...prev].slice(0, 30);
      persist(next);
      return next;
    });
    toast(n.title, { description: n.body });
  }, []);

  // Load active partnership
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("partnerships")
        .select("id, partner_a_id, partner_b_id, status")
        .or(`partner_a_id.eq.${user.id},partner_b_id.eq.${user.id}`)
        .eq("status", "active")
        .maybeSingle();
      setPartnership(data as Partnership | null);
    })();
  }, [user]);

  // Subscribe to partner-driven events
  useEffect(() => {
    if (!user || !partnership || !partnerId) return;
    const pid = partnership.id;

    const ch = supabase
      .channel(`notif-${pid}-${user.id}`)
      // Dashboard / task events from partner
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_tasks", filter: `partnership_id=eq.${pid}` },
        async (payload) => {
          const row = (payload.new ?? payload.old) as { owner_id?: string } | null;
          if (!row?.owner_id || row.owner_id === user.id) return;
          if (payload.eventType === "INSERT") {
            push({ title: "Shared dashboard updated", body: "Your partner added a new task for today.", href: "/app" });
          }
          // Re-evaluate partner readiness
          const today = new Date().toISOString().slice(0, 10);
          const { data } = await supabase
            .from("daily_tasks")
            .select("is_complete")
            .eq("partnership_id", pid)
            .eq("owner_id", partnerId)
            .eq("task_date", today);
          const list = (data as { is_complete: boolean }[] | null) ?? [];
          if (list.length === 0) return;
          const done = list.filter((t) => t.is_complete).length;
          const pct = Math.round((done / list.length) * 100);
          if (pct === 100 && !partnerFullToasted) {
            setPartnerFullToasted(true);
            setPartnerNearToasted(true);
            push({ title: "Your partner is ready for engagement 💞", body: "All their tasks are complete.", href: "/app" });
          } else if (pct >= 75 && pct < 100 && !partnerNearToasted) {
            setPartnerNearToasted(true);
            push({ title: "You are almost ready for engagement", body: `Partner is at ${pct}% — they're nearly done.`, href: "/app" });
          } else if (pct < 75) {
            setPartnerNearToasted(false);
            setPartnerFullToasted(false);
          }
        }
      )
      // Proposals from partner — couple goals
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "couple_goals", filter: `partnership_id=eq.${pid}` },
        (payload) => {
          const row = payload.new as { created_by?: string; approval_status?: string; title?: string };
          if (row.created_by && row.created_by !== user.id && row.approval_status === "pending") {
            push({ title: "New goal proposal", body: `Your partner proposed: "${row.title}"`, href: "/goals" });
          }
        }
      )
      // Couple goal updates (declines, edits, completions by partner)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "couple_goals", filter: `partnership_id=eq.${pid}` },
        (payload) => {
          const oldRow = (payload.old ?? {}) as { approval_status?: string; is_complete?: boolean; title?: string };
          const row = payload.new as { title?: string; approval_status?: string; declined_by?: string; decline_reason?: string; is_complete?: boolean; completed_by?: string };
          if (row.approval_status === "declined" && oldRow.approval_status !== "declined" && row.declined_by && row.declined_by !== user.id) {
            push({ title: "Goal declined", body: `Partner declined "${row.title}"${row.decline_reason ? `: ${row.decline_reason}` : ""}`, href: "/goals" });
          } else if (row.is_complete && !oldRow.is_complete && row.completed_by && row.completed_by !== user.id) {
            push({ title: "Goal celebrated 🎉", body: `Partner marked "${row.title}" done.`, href: "/goals" });
          }
        }
      )
      // Proposals from partner — important dates
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "important_dates", filter: `partnership_id=eq.${pid}` },
        (payload) => {
          const row = payload.new as { created_by?: string; approval_status?: string; title?: string };
          if (row.created_by && row.created_by !== user.id && row.approval_status === "pending") {
            push({ title: "New date proposal", body: `Your partner proposed: "${row.title}"`, href: "/dates" });
          }
        }
      )
      // Date updates — edits, declines, cancellations
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "important_dates", filter: `partnership_id=eq.${pid}` },
        (payload) => {
          const oldRow = (payload.old ?? {}) as { approval_status?: string; date?: string; event_time?: string | null; title?: string };
          const row = payload.new as {
            created_by?: string; title?: string; approval_status?: string;
            decline_reason?: string; declined_by?: string;
            cancellation_reason?: string; cancelled_by?: string;
            date?: string; event_time?: string | null;
          };
          // Decline
          if (row.approval_status === "declined" && oldRow.approval_status !== "declined" && row.declined_by && row.declined_by !== user.id) {
            push({ title: "Date declined", body: `Partner declined "${row.title}"${row.decline_reason ? `: ${row.decline_reason}` : ""}`, href: "/dates" });
            return;
          }
          // Cancel
          if (row.approval_status === "cancelled" && oldRow.approval_status !== "cancelled" && row.cancelled_by && row.cancelled_by !== user.id) {
            push({ title: "Date cancelled", body: `Partner cancelled "${row.title}"${row.cancellation_reason ? `: ${row.cancellation_reason}` : ""}`, href: "/dates" });
            return;
          }
          // Time/date edit
          const timeChanged = oldRow.date !== row.date || (oldRow.event_time ?? null) !== (row.event_time ?? null);
          if (row.created_by && row.created_by !== user.id && timeChanged) {
            push({ title: "Date updated", body: `Partner changed timing for "${row.title}".`, href: "/dates" });
            return;
          }
          if (row.created_by && row.created_by !== user.id && oldRow.title !== row.title) {
            push({ title: "Proposal updated", body: `Partner edited: "${row.title}"`, href: "/dates" });
          }
        }
      )
      // Celebrations (partner completed all personal goals)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "celebrations", filter: `partnership_id=eq.${pid}` },
        (payload) => {
          const row = payload.new as { honoree_id?: string; goal_count?: number };
          if (row.honoree_id && row.honoree_id !== user.id) {
            push({ title: "Celebrate your partner 🎉", body: `They completed all ${row.goal_count} personal goals this month.`, href: "/goals" });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, partnership, partnerId, push, partnerNearToasted, partnerFullToasted]);

  const unread = items.filter((n) => n.at > seenAt).length;

  function markSeen() {
    const t = Date.now();
    setSeenAt(t);
    persistSeen(t);
  }

  function clearAll() {
    setItems([]);
    persist([]);
    markSeen();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) markSeen(); }}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-primary px-1 text-[10px] font-bold text-primary-foreground shadow-soft">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </li>
          )}
          {items.map((n) => {
            const content = (
              <>
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{timeAgo(n.at)}</p>
              </>
            );
            return (
              <li key={n.id} className="border-b border-border/50 last:border-0">
                {n.href ? (
                  <Link to={n.href} onClick={() => setOpen(false)} className="block px-4 py-3 transition hover:bg-secondary/50">{content}</Link>
                ) : (
                  <div className="px-4 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
