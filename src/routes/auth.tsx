import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Loader2, MailCheck, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    verify: typeof s.verify === "string" ? s.verify : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — TwoGether" },
      { name: "description", content: "Sign in to your TwoGether partnership." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { verify } = Route.useSearch();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // If non-null, we render the "Check your email" verification screen instead
  // of the form. Set after signup, or after a login attempt against an
  // unconfirmed account.
  const [pendingEmail, setPendingEmail] = useState<string | null>(verify ?? null);

  useEffect(() => {
    if (loading) return;
    // Only treat a fully-confirmed account as "logged in" — unconfirmed users
    // must finish the email verification flow before we route into /app.
    if (user && (user.email_confirmed_at || (user as { confirmed_at?: string }).confirmed_at)) {
      navigate({ to: "/app" });
    } else if (user && !pendingEmail) {
      // Signed-in but unconfirmed: surface the verify screen.
      setPendingEmail(user.email ?? null);
    }
  }, [user, loading, navigate, pendingEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const minDuration = new Promise((r) => setTimeout(r, 600));
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        await minDuration;
        if (error && !/already|registered|exists/i.test(error.message)) throw error;
        // With email confirmation required, signUp returns no session.
        // Show the "check your email" screen for both new and existing emails
        // (don't leak which one it was).
        setPendingEmail(email);
        // If Supabase did return a session (e.g. auto-confirm got re-enabled),
        // sign the user out so they can't bypass verification.
        if (data?.session) await supabase.auth.signOut();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        await minDuration;
        if (error) {
          // Unconfirmed account → guide them to verify instead of leaking
          // "wrong password".
          if (/confirm|verif/i.test(error.message)) {
            setPendingEmail(email);
            // Auto-resend so they get a fresh link right away.
            await resendConfirmation(email);
            return;
          }
          toast.error("Invalid email or password.");
          return;
        }
        // Defensive: if somehow we got a session for an unconfirmed user,
        // gate it manually.
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u && !u.email_confirmed_at) {
          setPendingEmail(email);
          await resendConfirmation(email);
          return;
        }
        navigate({ to: "/app" });
      }
    } catch (err: unknown) {
      await minDuration;
      console.error("[auth]", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendConfirmation(target?: string) {
    const addr = target ?? pendingEmail ?? email;
    if (!addr) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      console.error("[auth:resend]", error);
      // Mirror sign-up semantics: don't leak whether the address exists.
      toast.success("If that account needs verification, we just sent a new link.");
    } else {
      toast.success("Verification email sent. Check your inbox.");
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/app`,
    });
    if (result.error) toast.error("Google sign-in failed");
  }

  return (
    <main className="min-h-screen bg-gradient-hero px-6 py-12">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 font-display text-lg font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
            <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" />
          </div>
          TwoGether
        </Link>

        {pendingEmail ? (
          <VerifyEmailCard
            email={pendingEmail}
            onResend={() => resendConfirmation()}
            onBack={async () => {
              await supabase.auth.signOut();
              setPendingEmail(null);
            }}
          />
        ) : (
          <div className="rounded-3xl border border-border bg-card/90 p-8 shadow-glow backdrop-blur">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Start your partnership"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to continue." : "Create your account, then invite the one person."}
            </p>

            <button
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-secondary"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Field label="Your name">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex"
                    className="input"
                    required
                  />
                </Field>
              )}
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="input"
                  required
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:scale-[1.01] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="font-semibold text-lavender-deep hover:underline"
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 0.75rem;
          font-size: 16px;
          color: var(--color-foreground);
          transition: border-color 0.15s;
        }
        .input:focus { outline: none; border-color: var(--color-ring); }
      `}</style>
    </main>
  );
}

function VerifyEmailCard({
  email,
  onResend,
  onBack,
}: {
  email: string;
  onResend: () => Promise<void>;
  onBack: () => void | Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      await onResend();
      setCooldown(45);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card/90 p-8 shadow-glow backdrop-blur">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-soft">
        <MailCheck className="h-7 w-7 text-primary-foreground" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Confirm your email
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a verification link to{" "}
        <span className="font-medium text-foreground break-all">{email}</span>. Click it to activate your
        account — the link expires in 24 hours.
      </p>

      <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-4 text-xs text-muted-foreground">
        Don't see it? Check your spam folder, or wait a minute before requesting another link.
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={sending || cooldown > 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:scale-[1.01] disabled:opacity-60"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
      </button>

      <button
        type="button"
        onClick={() => void onBack()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Use a different email
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.04l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .95 4.96L3.97 7.29C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
