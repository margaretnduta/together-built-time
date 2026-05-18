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
    return { isIOS: false, isStandalone: false };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIOS, isStandalone };
}

export function InstallAppCta() {
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const { isIOS: ios, isStandalone } = detectPlatform();
    if (isStandalone) {
      setInstalled(true);
      return;
    }
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Only show when we can actually install: native prompt available OR iOS (needs Share→Add).
  // Otherwise the CTA is meaningless, so hide it instead of showing instructions.
  if (installed || dismissed) return null;
  if (!deferred && !isIOS) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // iOS — no programmatic install API exists. Show the minimal Share → Add steps.
    setIosOpen(true);
  };

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-50">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-glow backdrop-blur">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Download the App</p>
            <p className="truncate text-xs text-muted-foreground">Install TwoGether on your device</p>
          </div>
          <Button onClick={onClick} size="sm" className="rounded-full bg-gradient-primary">
            <Download className="h-4 w-4" />
            Install
          </Button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install on iPhone</DialogTitle>
            <DialogDescription>
              iOS doesn't allow one-tap install. Use Safari's Share menu:
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
              <span className="flex-1">Tap <Share className="mx-1 inline h-4 w-4 align-text-bottom" /> <strong>Share</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
              <span className="flex-1">Choose <strong>Add to Home Screen</strong> <Plus className="mx-1 inline h-4 w-4 align-text-bottom" />.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
