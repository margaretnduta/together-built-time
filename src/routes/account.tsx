import { TopNav } from "@/components/top-nav";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, KeyRound, Mail, User, Phone, History, Camera, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — TwoGether" }] }),
  component: AccountPage,
});

// ---------------------------------------------------------------------------
// Validation schemas — server-side validation is enforced by:
//   - Postgres CHECK constraints on profiles (display_name length, phone format)
//   - Supabase Auth (email format, password length, HIBP leaked-password check)
//   - RLS policies that restrict every row to auth.uid()
// These schemas are the client-side mirror so users get instant feedback.
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Keep it under 60 characters"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone is too long")
    .regex(/^\+?[0-9 ()\-]{6,20}$/, "Use digits, spaces, +, -, ( )")
    .optional()
    .or(z.literal("")),
});

const emailSchema = z.object({
  new_email: z.string().trim().email("Enter a valid email").max(254),
  current_password: z.string().min(1, "Confirm your current password"),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128)
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/[a-z]/, "Add a lowercase letter")
      .regex(/[0-9]/, "Add a number"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Choose a password different from the current one",
  });

type Profile = { id: string; display_name: string; phone: string | null };
type AuditEntry = {
  id: string;
  action: string;
  summary: string | null;
  created_at: string;
};

function AccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lavender-deep" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <TopNav onSignOut={handleSignOut} />
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Settings
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit only your own details. Sensitive changes require your current password.
          </p>
        </header>

        <ProfileCard userId={user.id} />
        <EmailCard currentEmail={user.email ?? ""} />
        <PasswordCard email={user.email ?? ""} />
        <SignOutEverywhereCard onAfterSignOut={() => navigate({ to: "/auth" })} />
        <AuditLogCard userId={user.id} />
      </div>
    </main>
  );
}

// =================== PROFILE ===================
function ProfileCard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, phone")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      toast.error("Could not load your profile.");
      return;
    }
    const p = data as Profile | null;
    setProfile(p);
    setDisplayName(p?.display_name ?? "");
    setPhone(p?.phone ?? "");
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const result = profileSchema.safeParse({
      display_name: displayName,
      phone: phone || undefined,
    });
    if (!result.success) {
      const e: Record<string, string> = {};
      result.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErrors(e);
      return;
    }
    setErrors({});
    setSaving(true);
    // RLS restricts this UPDATE to the row where id = auth.uid().
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: result.data.display_name,
        phone: result.data.phone ? result.data.phone : null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      // Don't leak DB internals
      toast.error("Could not save your profile. Please try again.");
      return;
    }
    toast.success("Profile updated.");
    load();
  }

  const changed =
    !!profile &&
    (displayName !== (profile.display_name ?? "") || (phone || "") !== (profile.phone ?? ""));

  return (
    <Section
      icon={<User className="h-4 w-4" />}
      title="Profile"
      description="Visible to your partner inside the app."
    >
      <Field label="Display name" error={errors.display_name}>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          autoComplete="name"
          className={inputCls}
        />
      </Field>
      <Field label="Phone (optional)" error={errors.phone} icon={<Phone className="h-3.5 w-3.5" />}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
          autoComplete="tel"
          placeholder="+1 555 0100"
          className={inputCls}
        />
      </Field>
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving || !changed}
          className={primaryBtn}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </button>
      </div>
    </Section>
  );
}

// =================== EMAIL ===================
function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function submit() {
    const result = emailSchema.safeParse({ new_email: newEmail, current_password: currentPassword });
    if (!result.success) {
      const e: Record<string, string> = {};
      result.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErrors(e);
      return;
    }
    if (result.data.new_email.toLowerCase() === currentEmail.toLowerCase()) {
      setErrors({ new_email: "That's already your email" });
      return;
    }
    setErrors({});
    setConfirmOpen(true);
  }

  async function performChange() {
    setBusy(true);
    try {
      // Re-authenticate with current password to prevent silent takeover
      // from a hijacked session.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (reauthErr) {
        toast.error("Current password is incorrect.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        toast.error("Could not start the email change. Please try again.");
        return;
      }
      await supabase.rpc("log_account_event", {
        _action: "email.change",
        _summary: "email change requested",
      });
      toast.success(
        "Check both your old and new inboxes for a confirmation link to finish the change."
      );
      setNewEmail("");
      setCurrentPassword("");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      icon={<Mail className="h-4 w-4" />}
      title="Email"
      description={`Currently: ${currentEmail || "—"}. Changing email requires confirmation from both addresses.`}
      highRisk
    >
      <Field label="New email">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          autoComplete="email"
          className={inputCls}
        />
        {errors.new_email && <ErrorText>{errors.new_email}</ErrorText>}
      </Field>
      <Field label="Current password">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className={inputCls}
        />
        {errors.current_password && <ErrorText>{errors.current_password}</ErrorText>}
      </Field>
      <div className="flex justify-end pt-2">
        <button onClick={submit} disabled={busy} className={primaryBtn}>
          <Mail className="h-4 w-4" /> Request change
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Change email?"
          body={
            <>
              We'll email a confirmation link to <strong>{currentEmail}</strong> and{" "}
              <strong>{newEmail}</strong>. The change takes effect only after you click both links.
            </>
          }
          confirmLabel="Yes, send links"
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={performChange}
        />
      )}
    </Section>
  );
}

// =================== PASSWORD ===================
function PasswordCard({ email }: { email: string }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const result = passwordSchema.safeParse({
      current_password: cur,
      new_password: next,
      confirm,
    });
    if (!result.success) {
      const e: Record<string, string> = {};
      result.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
      setErrors(e);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      // Verify current password (required for high-risk change).
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email,
        password: cur,
      });
      if (reauthErr) {
        toast.error("Current password is incorrect.");
        return;
      }
      // Supabase enforces leaked-password (HIBP) and minimum length server-side.
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        // Map known cases, swallow internals.
        const msg = /pwned|leaked|compromised/i.test(error.message)
          ? "This password has been seen in known data breaches. Pick another."
          : "Could not update password. Please try again.";
        toast.error(msg);
        return;
      }
      await supabase.rpc("log_account_event", {
        _action: "password.change",
        _summary: "password changed",
      });
      toast.success("Password updated.");
      setCur(""); setNext(""); setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      icon={<KeyRound className="h-4 w-4" />}
      title="Password"
      description="Use 8+ characters with upper, lower, and a number. We block passwords found in known breaches."
      highRisk
    >
      <Field label="Current password">
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)}
               autoComplete="current-password" className={inputCls} />
        {errors.current_password && <ErrorText>{errors.current_password}</ErrorText>}
      </Field>
      <Field label="New password">
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
               autoComplete="new-password" className={inputCls} />
        {errors.new_password && <ErrorText>{errors.new_password}</ErrorText>}
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
               autoComplete="new-password" className={inputCls} />
        {errors.confirm && <ErrorText>{errors.confirm}</ErrorText>}
      </Field>
      <div className="flex justify-end pt-2">
        <button onClick={submit} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Update password
        </button>
      </div>
    </Section>
  );
}

// =================== SESSIONS ===================
function SignOutEverywhereCard({ onAfterSignOut }: { onAfterSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true);
    try {
      // 'global' revokes all refresh tokens for this user across every device.
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        toast.error("Could not sign out other sessions.");
        return;
      }
      await supabase.rpc("log_account_event", {
        _action: "account.signout_all",
        _summary: "signed out of all sessions",
      });
      toast.success("Signed out everywhere. You'll need to sign back in.");
      onAfterSignOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      icon={<ShieldCheck className="h-4 w-4" />}
      title="Sessions"
      description="If you suspect someone else is signed in to your account, sign every device out."
    >
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60">
          <ShieldCheck className="h-4 w-4" /> Sign out of all devices
        </button>
      </div>
      {open && (
        <ConfirmDialog
          title="Sign out everywhere?"
          body="This ends every active session on every device, including this one. You'll need to sign in again."
          confirmLabel="Yes, sign me out"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={run}
        />
      )}
    </Section>
  );
}

// =================== AUDIT LOG ===================
function AuditLogCard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("account_audit_log")
        .select("id, action, summary, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (alive) {
        setEntries((data as AuditEntry[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const labels: Record<string, string> = {
    "profile.display_name": "Display name changed",
    "profile.phone": "Phone updated",
    "email.change": "Email change requested",
    "password.change": "Password changed",
    "account.signout_all": "Signed out of all devices",
  };

  return (
    <Section
      icon={<History className="h-4 w-4" />}
      title="Recent account activity"
      description="The last 25 changes to your account. Only you can see this."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{labels[e.action] ?? e.action}</p>
                {e.summary && <p className="text-xs text-muted-foreground">{e.summary}</p>}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// =================== SHARED UI ===================
const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-base focus:border-ring focus:outline-none";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60";

function Section({
  icon, title, description, children, highRisk,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  highRisk?: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${
          highRisk ? "bg-destructive/10 text-destructive" : "bg-secondary text-lavender-deep"
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, error, icon, children,
}: { label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </span>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-destructive">{children}</p>;
}

function ConfirmDialog({
  title, body, confirmLabel, busy, onCancel, onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lg">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
