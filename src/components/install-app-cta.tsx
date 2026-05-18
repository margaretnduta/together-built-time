import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform() {
  if (typeof window === "undefined") {
    return { isIOS: false, isAndroid: false, isStandalone: false };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIOS, isAndroid, isStandalone };
}

export function InstallAppCta() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { isMobileOrTablet, isIOS: ios, isStandalone } = detectPlatform();
    if (isStandalone || !isMobileOrTablet) return;
    setShow(true);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => setShow(false);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!show) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setShow(false);
      setDeferred(null);
      return;
    }
    // No native prompt available (iOS, or Android that hasn't fired yet) → show instructions
    setOpen(true);
  };

  return (
    <>
      {/* Floating CTA — mobile only, dismissible */}
      <div className="fixed inset-x-3 bottom-3 z-50 lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-glow backdrop-blur">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Download the App</p>
            <p className="truncate text-xs text-muted-foreground">Install TwoGether on your home screen</p>
          </div>
          <Button onClick={onClick} size="sm" className="rounded-full bg-gradient-primary">
            <Download className="h-4 w-4" />
            Install
          </Button>
          <button
            onClick={() => setShow(false)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install TwoGether</DialogTitle>
            <DialogDescription>
              Add the app to your home screen to launch it like a native app.
            </DialogDescription>
          </DialogHeader>
          {isIOS ? (
            <ol className="mt-2 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
                <span className="flex-1">Tap the <Share className="mx-1 inline h-4 w-4 align-text-bottom" /> <strong>Share</strong> button in Safari's toolbar.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
                <span className="flex-1">Scroll and choose <strong>Add to Home Screen</strong> <Plus className="mx-1 inline h-4 w-4 align-text-bottom" />.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">3</span>
                <span className="flex-1">Tap <strong>Add</strong>. TwoGether will appear on your home screen.</span>
              </li>
            </ol>
          ) : (
            <ol className="mt-2 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
                <span className="flex-1">Open your browser's menu (⋮).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
                <span className="flex-1">Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">3</span>
                <span className="flex-1">Confirm to install. The app will appear in your launcher.</span>
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
