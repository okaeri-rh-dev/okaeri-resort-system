import { Download, X } from "lucide-react";

import { Button } from "@/components/patterns";
import { useCanShowInstallBanner, useInstallPromptStore } from "@/stores/useInstallPromptStore";

export function InstallBanner() {
  const installPromptEvent = useInstallPromptStore((s) => s.installPromptEvent);
  const dismissalState = useInstallPromptStore((s) => s.dismissalState);
  const triggerInstall = useInstallPromptStore((s) => s.triggerInstall);
  const snoozeForDays = useInstallPromptStore((s) => s.snoozeForDays);
  const dismissPermanently = useInstallPromptStore((s) => s.dismissPermanently);
  const canShowInstallBanner = useCanShowInstallBanner();

  if (dismissalState !== "visible" || !canShowInstallBanner) return null;

  const hasNativePrompt = installPromptEvent !== null;
  const showIosSteps = !hasNativePrompt;

  return (
    <div
      role="region"
      aria-label="Install Okaeri app"
      className="bg-primary/5 border-primary/20 medium:px-6 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3"
    >
      <Download className="text-primary h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Okaeri for quick access</p>
        {showIosSteps ? (
          <p className="text-muted-foreground medium:text-sm text-xs">
            Tap the <span aria-label="Share">Share</span> button in Safari, then choose "Add to Home
            Screen".
          </p>
        ) : (
          <p className="text-muted-foreground medium:text-sm text-xs">
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
          <span className="medium:not-sr-only medium:ml-1 sr-only">Don't show again</span>
        </Button>
      </div>
    </div>
  );
}
