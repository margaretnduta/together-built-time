import { Link } from "@tanstack/react-router";
import { Heart, LogOut } from "lucide-react";

interface TopNavProps {
  onSignOut: () => void;
}

const links = [
  { to: "/app", label: "Today" },
  { to: "/goals", label: "Goals" },
  { to: "/reflections", label: "Reflections" },
  { to: "/dates", label: "Dates" },
] as const;

const linkBase =
  "shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-4";
const linkActive =
  "shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm bg-secondary text-foreground sm:px-4";

export function TopNav({ onSignOut }: TopNavProps) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-display text-base font-semibold sm:text-lg"
          aria-label="TwoGether home"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary">
            <Heart className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="hidden xs:inline sm:inline">TwoGether</span>
        </Link>

        {/* Nav scrolls horizontally on tiny screens without ever forcing the
            page to scroll — the parent `flex-1 min-w-0` clips overflow. */}
        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={linkBase}
              activeProps={{ className: linkActive }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={onSignOut}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
