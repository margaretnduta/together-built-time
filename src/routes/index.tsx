import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Circle, Sparkles, Heart, Lock, Unlock, Target, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TwoGether — Earn your time together" },
      { name: "description", content: "A productivity platform for committed couples. Show up for yourself, unlock time with your partner. Daily tasks, weekly reflections, monthly goals — built on radical honesty." },
      { property: "og:title", content: "TwoGether — Earn your time together" },
      { property: "og:description", content: "Show up for yourself. Unlock time with your partner. A productivity platform built for two." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Nav() {
  return (
    <nav className="absolute top-0 z-20 flex w-full items-center justify-between px-6 py-6 md:px-12">
      <div className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
          <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" />
        </div>
        TwoGether
      </div>
      <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <a href="#how" className="transition hover:text-foreground">How it works</a>
        <a href="#mechanics" className="transition hover:text-foreground">The mechanics</a>
        <a href="#principles" className="transition hover:text-foreground">Principles</a>
      </div>
      <Link
        to="/auth"
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
      >
        Get started
      </Link>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero pb-24 pt-32 md:pb-40 md:pt-44">
      {/* Soft floating orbs */}
      <div className="pointer-events-none absolute -left-20 top-32 h-72 w-72 rounded-full bg-blush-deep/40 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -right-10 top-60 h-96 w-96 rounded-full bg-lavender/40 blur-3xl animate-pulse-glow" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-lavender-deep" /> For two, on purpose
        </span>

        <h1 className="mt-8 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Earn your<br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">time together.</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          TwoGether is a quiet productivity space for two committed people.
          Show up for your own day, watch each other do the same, and unlock
          intentional time together when you both have.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/auth"
            className="rounded-full bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Start your partnership
          </Link>
          <a
            href="#how"
            className="rounded-full border border-border bg-card/70 px-7 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-card"
          >
            See how it works
          </a>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Two accounts. One partnership. No third party.
        </p>

        {/* Status preview card */}
        <div className="mx-auto mt-20 max-w-3xl">
          <StatusPreview />
        </div>
      </div>
    </section>
  );
}

function StatusPreview() {
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-6 text-left shadow-glow backdrop-blur md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Monday, today</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          <Unlock className="h-3 w-3" /> Ready for engagement
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PartnerCard name="Alex" pct={100} tasks={[
          { label: "Morning run", done: true },
          { label: "Deep work block", done: true },
          { label: "Review finances", done: true },
        ]} />
        <PartnerCard name="Jordan" pct={100} tasks={[
          { label: "Read 30 pages", done: true },
          { label: "Journaling", done: true },
          { label: "Evening walk", done: true },
        ]} />
      </div>
    </div>
  );
}

function PartnerCard({ name, pct, tasks }: { name: string; pct: number; tasks: { label: string; done: boolean }[] }) {
  return (
    <div className="rounded-2xl bg-secondary/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold">{name}'s day</span>
        <span className="text-xs font-medium text-lavender-deep">{pct}%</span>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.label} className="flex items-center gap-2.5 text-sm">
            {t.done ? (
              <Check className="h-4 w-4 text-lavender-deep" strokeWidth={3} />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={t.done ? "text-foreground" : "text-muted-foreground"}>{t.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Invite the one person",
      body: "Create an account, send a single invite by code or email. Once accepted, you're locked in as a partnership of two. Nothing else, no one else.",
    },
    {
      n: "02",
      title: "Write your own day",
      body: "Each morning, list your daily tasks. They're yours. Only you can mark them done — no proxy completion, no fudged numbers.",
    },
    {
      n: "03",
      title: "Watch each other show up",
      body: "Your partner sees the title of every task and whether it's complete. Real-time, transparent, honest. The details stay yours.",
    },
    {
      n: "04",
      title: "Unlock time together",
      body: "When both of you finish your day, the engagement gate opens. That's when intentional conversation, connection, and intimate time begin.",
    },
  ];

  return (
    <section id="how" className="bg-background px-6 py-28 md:px-12 md:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-widest text-lavender-deep">How it works</span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            A simple loop, built on showing up.
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-8 md:p-10">
              <div className="font-display text-sm font-semibold text-lavender-deep">{s.n}</div>
              <h3 className="mt-3 font-display text-2xl font-semibold">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Mechanics() {
  const items = [
    {
      icon: Lock,
      tag: "Daily",
      title: "The engagement gate",
      body: "Two states. 'Doing something constructive' while tasks remain. 'Ready for engagement' the moment you finish. When both partners hit ready, the gate opens.",
    },
    {
      icon: CalendarDays,
      tag: "Weekly",
      title: "Reflection unlocked",
      body: "Complete every day of the week together and Sunday opens a private reflection space. How was your week? Did you meet in person? A reset for the next.",
    },
    {
      icon: Target,
      tag: "Monthly",
      title: "Goals you can see",
      body: "Up to four personal goals each, three shared. Visible to both. The month becomes a living document of what you're each building and what you're building together.",
    },
  ];

  return (
    <section id="mechanics" className="bg-gradient-soft px-6 py-28 md:px-12 md:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-lavender-deep">The mechanics</span>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Three rhythms. One relationship.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.title} className="group rounded-3xl border border-border bg-card p-8 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-lavender-deep">{it.tag}</div>
              <h3 className="mt-2 font-display text-2xl font-semibold">{it.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Principles() {
  const principles = [
    { title: "Radical honesty.", body: "No fake completions. No fudged numbers. The status is the truth — that's what makes the trust real." },
    { title: "Two, never more.", body: "Your data is scoped to your partnership. No cross-couple visibility, no social feed, no leaderboard." },
    { title: "Earn, not extract.", body: "Time together is the reward for both of you showing up, not a feature to log. Connection stays sacred." },
    { title: "Less is the point.", body: "No chat. No notifications buffet. You already have texting. This app is for the gate, not the noise." },
  ];

  return (
    <section id="principles" className="bg-foreground px-6 py-28 text-background md:px-12 md:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-widest text-lavender">Principles</span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Built for serious couples.
          </h2>
          <p className="mt-4 text-lg text-background/70">
            TwoGether assumes you already prioritize each other.
            It just makes that visible, daily.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-3xl bg-background/10 md:grid-cols-2">
          {principles.map((p) => (
            <div key={p.title} className="bg-foreground p-8 md:p-10">
              <h3 className="font-display text-xl font-semibold text-background">{p.title}</h3>
              <p className="mt-2 leading-relaxed text-background/70">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-background px-6 py-28 md:px-12 md:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[120%] -translate-x-1/2 rounded-full bg-blush-deep/40 blur-3xl" />
      <div className="relative mx-auto max-w-3xl text-center">
        <Heart className="mx-auto h-10 w-10 text-lavender-deep" fill="currentColor" />
        <h2 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          The version of you<br />you both deserve.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Start your partnership today. Invite the one person.
        </p>
        <div className="mt-10">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Create your account <Sparkles className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2 font-display font-semibold text-foreground">
          <Heart className="h-4 w-4 text-lavender-deep" fill="currentColor" /> TwoGether
        </div>
        <p>© {new Date().getFullYear()} TwoGether. Built for two.</p>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <HowItWorks />
      <Mechanics />
      <Principles />
      <FinalCta />
      <Footer />
    </main>
  );
}
