import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ArrowLeft, Lock, Unlock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — TwoGether" },
      { name: "description", content: "What TwoGether is, the problem it solves, and who it's built for." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="absolute top-0 z-20 flex w-full items-center justify-between px-6 py-6 md:px-12">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
            <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" />
          </div>
          TwoGether
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-foreground/80 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero pb-16 pt-32 md:pb-24 md:pt-40">
        <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-blush-deep/40 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -right-20 top-72 h-96 w-96 rounded-full bg-lavender/40 blur-3xl animate-pulse-glow" />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-lavender-deep" /> About TwoGether
          </span>
          <h1 className="mt-7 font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Built for two people who <span className="bg-gradient-primary bg-clip-text text-transparent">choose each other daily.</span>
          </h1>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <div className="space-y-16">
          {/* The Problem */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-semibold">The Problem</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Modern life fragments attention. Work, notifications, endless feeds — they all pull two people apart without anyone choosing to disconnect. Couples who genuinely want to prioritize each other struggle to make that priority visible in the day-to-day. There is no shared signal for "I showed up today" and no clear moment when both partners are truly free to be present together.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Existing apps try to solve this with chat, shared calendars, or reminders. But more communication tools do not create more connection. What is missing is a simple, honest mechanism: a gate that only opens when both people have done what they said they would do.
            </p>
          </div>

          {/* The Solution */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Unlock className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-semibold">The Solution</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              TwoGether is a quiet productivity space for exactly two people. Each partner writes their own daily tasks. Each partner marks their own work complete. When both finish, the engagement gate opens. That is the signal: you have both earned your time together.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              There is no chat. No social feed. No leaderboard. Just a private loop of commitment and reward. Weekly reflections unlock after seven days of showing up. Monthly goals keep long-term growth visible to both. The product is built on radical honesty — you cannot fake completion, and you cannot see details that are not yours to see.
            </p>
          </div>

          {/* Who It's For */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Heart className="h-5 w-5" fill="currentColor" />
            </div>
            <h2 className="font-display text-2xl font-semibold">Who It's For</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              TwoGether is for committed couples who already prioritize each other and want a simple, honest way to make that priority visible. It is for partners who believe time together should be earned, not extracted. Who want less noise and more intention. Who are building something — individually and together — and want a shared rhythm to support that.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              If you are looking for a relationship app with quizzes, chat features, or advice content, this is not it. TwoGether is a tool. The connection is between you and your partner. We just hold the gate.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Start your partnership <Sparkles className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2 font-display font-semibold text-foreground">
            <Heart className="h-4 w-4 text-lavender-deep" fill="currentColor" /> TwoGether
          </div>
          <p>© {new Date().getFullYear()} TwoGether. Built for two.</p>
        </div>
      </footer>
    </main>
  );
}
