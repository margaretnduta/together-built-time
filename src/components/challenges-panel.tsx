import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Plus, Trophy, Check, X, Trash2, Loader2, Calendar, User, Users, Pencil } from "lucide-react";
import { toast } from "sonner";

type Challenge = {
  id: string;
  owner_id: string;
  partnership_id: string | null;
  partner_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_solo: boolean;
  status: "active" | "pending" | "declined" | "completed" | "archived";
};

type Profile = { id: string; display_name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChallengesPanel({
  user,
  partnershipId,
  partnerId,
  partnerName,
}: {
  user: { id: string };
  partnershipId: string;
  partnerId: string | null;
  partnerName: string;
}) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .or(`owner_id.eq.${user.id},partner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setChallenges((data as Challenge[]) ?? []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`challenges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_check_ins" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, load]);

  const active = challenges.filter((c) => c.status === "active" || c.status === "pending");
  const archived = challenges.filter((c) => c.status === "completed" || c.status === "declined" || c.status === "archived");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Streak challenges</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Build a habit, together or solo.</h2>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
        >
          <Plus className="h-4 w-4" /> {showAdd ? "Close" : "New challenge"}
        </button>
      </div>

      {showAdd && (
        <AddChallengeForm
          user={user}
          partnershipId={partnershipId}
          partnerId={partnerId}
          partnerName={partnerName}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-lavender-deep" /></div>
      ) : active.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Trophy className="mx-auto h-7 w-7 text-lavender-deep" />
          <p className="mt-3 font-display text-lg font-semibold">No active challenges yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Start one — read every day, walk, journal — and watch your streak grow.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {active.map((c) => (
            <ChallengeCard key={c.id} challenge={c} user={user} partnerName={partnerName} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Past challenges ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-3 text-sm">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(c.start_date)} → {fmtDate(c.end_date)} · {c.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AddChallengeForm({
  user, partnershipId, partnerId, partnerName, onCreated,
}: {
  user: { id: string };
  partnershipId: string;
  partnerId: string | null;
  partnerName: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 29);
    return d.toISOString().slice(0, 10);
  });
  const [invitePartner, setInvitePartner] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (endDate < startDate) { toast.error("End date must be on or after start date."); return; }
    setBusy(true);
    const payload = {
      owner_id: user.id,
      partnership_id: invitePartner ? partnershipId : null,
      partner_id: invitePartner && partnerId ? partnerId : null,
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate,
      end_date: endDate,
      is_solo: !invitePartner,
      status: invitePartner ? "pending" : "active",
    };
    const { error } = await supabase.from("challenges").insert(payload as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(invitePartner ? `Invite sent to ${partnerName}` : "Challenge started 🔥");
    setTitle(""); setDescription("");
    onCreated();
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Challenge title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Read 30 minutes a day"
          maxLength={120}
          required
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What counts as a check-in?"
          maxLength={500}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">End</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none" />
        </div>
      </div>
      {partnerId && (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
          <input type="checkbox" checked={invitePartner} onChange={(e) => setInvitePartner(e.target.checked)} className="h-4 w-4" />
          <Users className="h-4 w-4 text-lavender-deep" />
          Invite {partnerName} to do this with me
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={busy || !title.trim()}
          className="flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create challenge
        </button>
      </div>
    </form>
  );
}

function ChallengeCard({ challenge, user, partnerName }: { challenge: Challenge; user: { id: string }; partnerName: string }) {
  const [editing, setEditing] = useState(false);
  const today = todayISO();
  const isOwner = challenge.owner_id === user.id;
  const isPartnerInvitee = challenge.partner_id === user.id;
  const isPending = challenge.status === "pending";
  const isActive = challenge.status === "active";

  const [myStreak, setMyStreak] = useState(0);
  const [partnerStreak, setPartnerStreak] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [partnerCheckedToday, setPartnerCheckedToday] = useState(false);
  const [busy, setBusy] = useState(false);

  const otherParticipantId = useMemo(() => {
    if (challenge.is_solo) return null;
    return challenge.owner_id === user.id ? challenge.partner_id : challenge.owner_id;
  }, [challenge, user.id]);

  const refresh = useCallback(async () => {
    const [{ data: myS }, { data: chk }] = await Promise.all([
      supabase.rpc("get_challenge_streak", { _challenge_id: challenge.id, _user_id: user.id }),
      supabase.from("challenge_check_ins").select("id").eq("challenge_id", challenge.id).eq("user_id", user.id).eq("check_in_date", today),
    ]);
    setMyStreak(typeof myS === "number" ? myS : 0);
    setCheckedToday(((chk as unknown[]) ?? []).length > 0);

    if (otherParticipantId) {
      const [{ data: pS }, { data: pChk }] = await Promise.all([
        supabase.rpc("get_challenge_streak", { _challenge_id: challenge.id, _user_id: otherParticipantId }),
        supabase.from("challenge_check_ins").select("id").eq("challenge_id", challenge.id).eq("user_id", otherParticipantId).eq("check_in_date", today),
      ]);
      setPartnerStreak(typeof pS === "number" ? pS : 0);
      setPartnerCheckedToday(((pChk as unknown[]) ?? []).length > 0);
    }
  }, [challenge.id, user.id, otherParticipantId, today]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel(`chk-${challenge.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "challenge_check_ins", filter: `challenge_id=eq.${challenge.id}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [challenge.id, refresh]);

  async function toggleCheckIn() {
    if (!isActive) return;
    setBusy(true);
    if (checkedToday) {
      await supabase.from("challenge_check_ins").delete()
        .eq("challenge_id", challenge.id).eq("user_id", user.id).eq("check_in_date", today);
    } else {
      const { error } = await supabase.from("challenge_check_ins").insert({
        challenge_id: challenge.id, user_id: user.id, check_in_date: today,
      } as never);
      if (error) toast.error(error.message);
      else toast.success("Checked in 🔥");
    }
    setBusy(false);
    refresh();
  }

  async function acceptInvite() {
    setBusy(true);
    const { error } = await supabase.from("challenges").update({ status: "active" } as never).eq("id", challenge.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Challenge accepted 💪");
  }

  async function declineInvite() {
    setBusy(true);
    await supabase.from("challenges").update({ status: "declined" } as never).eq("id", challenge.id);
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this challenge? All check-ins will be lost.")) return;
    await supabase.from("challenges").delete().eq("id", challenge.id);
  }

  const totalDays = Math.max(1, Math.round(
    (new Date(challenge.end_date + "T00:00:00").getTime() - new Date(challenge.start_date + "T00:00:00").getTime()) / 86400000
  ) + 1);
  const elapsed = Math.min(totalDays, Math.max(0, Math.round(
    (new Date(today + "T00:00:00").getTime() - new Date(challenge.start_date + "T00:00:00").getTime()) / 86400000
  ) + 1));
  const progressPct = Math.round((elapsed / totalDays) * 100);
  const isUpcoming = today < challenge.start_date;
  const isEnded = today > challenge.end_date;

  return (
    <li className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{challenge.title}</h3>
            {challenge.is_solo ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <User className="h-3 w-3" /> Solo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                <Users className="h-3 w-3" /> With {partnerName}
              </span>
            )}
            {isPending && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-800">
                {isOwner ? "Awaiting partner" : "Invitation"}
              </span>
            )}
          </div>
          {challenge.description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{challenge.description}</p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> {fmtDate(challenge.start_date)} → {fmtDate(challenge.end_date)} · day {elapsed}/{totalDays}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((v) => !v)} aria-label="Edit challenge" className="text-muted-foreground hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={remove} aria-label="Delete challenge" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {editing && isOwner && (
        <EditChallengeForm challenge={challenge} onDone={() => setEditing(false)} />
      )}
      {!editing && (<>


      {/* Progress bar */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Pending invite controls for partner */}
      {isPending && isPartnerInvitee && (
        <div className="mt-4 flex gap-2">
          <button onClick={acceptInvite} disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft">
            <Check className="h-4 w-4" /> Accept
          </button>
          <button onClick={declineInvite} disabled={busy}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" /> Decline
          </button>
        </div>
      )}

      {/* Streak + check-in */}
      {isActive && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StreakStat label="Your streak" streak={myStreak} checkedToday={checkedToday}
            actionLabel={isUpcoming ? "Starts soon" : isEnded ? "Ended" : checkedToday ? "Checked in" : "Mark today"}
            onAction={toggleCheckIn} disabled={busy || isUpcoming || isEnded} isMe />
          {otherParticipantId && (
            <StreakStat label={`${partnerName}'s streak`} streak={partnerStreak} checkedToday={partnerCheckedToday}
              actionLabel={partnerCheckedToday ? "Checked in today" : "Not yet today"}
              onAction={() => {}} disabled isMe={false} />
          )}
        </div>
      )}
    </li>
  );
}

function StreakStat({
  label, streak, checkedToday, actionLabel, onAction, disabled, isMe,
}: {
  label: string;
  streak: number;
  checkedToday: boolean;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  isMe: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${checkedToday ? "border-lavender-deep/30 bg-gradient-soft" : "border-border bg-background"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
        <span className="font-display text-3xl font-bold">{streak}</span>
        <span className="text-xs text-muted-foreground">day{streak === 1 ? "" : "s"}</span>
      </div>
      {isMe ? (
        <button onClick={onAction} disabled={disabled}
          className={`mt-3 w-full rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
            checkedToday
              ? "border border-lavender-deep/40 bg-card text-lavender-deep hover:bg-secondary"
              : "bg-gradient-primary text-primary-foreground shadow-soft"
          }`}>
          {actionLabel}
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{actionLabel}</p>
      )}
    </div>
  );
}
