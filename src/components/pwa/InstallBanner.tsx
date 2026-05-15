import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

export function InstallBanner() {
  const installPromptEvent = useInstallPromptStore((s) => s.installPromptEvent);
  const dismissalState = useInstallPromptStore((s) => s.dismissalState);
  const triggerInstall = useInstallPromptStore((s) => s.triggerInstall);
  const snoozeForDays = useInstallPromptStore((s) => s.snoozeForDays);
  const dismissPermanently = useInstallPromptStore((s) => s.dismissPermanently);

  if (dismissalState !== "visible") return null;

  const hasNativePrompt = installPromptEvent !== null;
  const ios = !hasNativePrompt && isIosSafari();

  if (!hasNativePrompt && !ios) return null;

  return (
    <div
      role="region"
      aria-label="Install Okaeri app"
      className="bg-primary/5 border-primary/20 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 sm:px-6"
    >
      <Download className="text-primary h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Okaeri for quick access</p>
        {ios ? (
          <p className="text-muted-foreground text-xs sm:text-sm">
            Tap the <span aria-label="Share">Share</span> button in Safari, then choose "Add to Home
            Screen".
          </p>
        ) : (
          <p className="text-muted-foreground text-xs sm:text-sm">
            Add Okaeri to your home screen for an app-like experience.
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {hasNativePrompt && (
          <Button size="sm" onClick={() => void triggerInstall()}>
            Install
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => snoozeForDays(7)}>
          Maybe later
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => dismissPermanently()}
          aria-label="Don't show again"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Don't show again</span>
        </Button>
      </div>
    </div>
  );
}
