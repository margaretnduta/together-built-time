import { Link } from "@tanstack/react-router";
import { CalendarHeart, ClipboardList, Heart, History, Home, LogOut, Menu, Target, UserRound } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/notifications-bell";

interface TopNavProps {
  onSignOut: () => void;
}

const links = [
  { to: "/app", label: "Today" },
  { to: "/goals", label: "Goals" },
  { to: "/reflections", label: "Reflections" },
  { to: "/dates", label: "Dates" },
  { to: "/history", label: "History" },
  { to: "/account", label: "Account" },
] as const;


const linkBase =
  "shrink-0 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground";
const linkActive =
  "shrink-0 rounded-full px-4 py-1.5 text-sm bg-secondary text-foreground";

export function TopNav({ onSignOut }: TopNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-display text-base font-semibold sm:text-lg"
            aria-label="TwoGether home"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary">
              <Heart className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" />
            </div>
            <span className="hidden sm:inline">TwoGether</span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 md:flex">
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

          <div className="flex-1 md:hidden" />

          {/* Notifications bell - visible on all sizes */}
          <NotificationsBell />

          <button
            onClick={onSignOut}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground md:flex"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* Mobile hamburger — now on the right */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-6">
                <SheetTitle className="flex items-center gap-2 font-display text-lg">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary">
                    <Heart className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" />
                  </div>
                  TwoGether
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {links.map((l) => (
                  <SheetClose asChild key={l.to}>
                    <Link
                      to={l.to}
                      className="rounded-xl px-4 py-3 text-base font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      activeProps={{ className: "rounded-xl px-4 py-3 text-base font-medium bg-gradient-primary text-primary-foreground shadow-soft" }}
                    >
                      {l.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="absolute inset-x-0 bottom-0 border-t border-border p-4">
                <button
                  onClick={() => { setOpen(false); onSignOut(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Mobile bottom navigation — sibling of header so fixed positioning
          anchors to the viewport (header's backdrop-blur would otherwise
          create a containing block and trap it inside). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[9999] border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 transform-gpu md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          WebkitTransform: "translateZ(0)",
        }}
        aria-label="Primary"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {bottomLinks.map(({ to, label, Icon }) => (
            <li key={to} className="flex">
              <Link
                to={to}
                className="flex w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
                activeProps={{
                  className:
                    "flex w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium text-primary",
                }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}


const bottomLinks = [
  { to: "/app", label: "Today", Icon: Home },
  { to: "/goals", label: "Goals", Icon: Target },
  { to: "/reflections", label: "Reflections", Icon: ClipboardList },
  { to: "/dates", label: "Dates", Icon: CalendarHeart },
  { to: "/history", label: "History", Icon: History },
  { to: "/account", label: "Account", Icon: UserRound },
] as const;
