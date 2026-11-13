// PROTOTYPE: throwaway variant switcher. Never merge to main.
import { useEffect } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}

export function PrototypeSwitcher({ variants, current, onChange }: PrototypeSwitcherProps) {
  const index = Math.max(
    variants.findIndex((v) => v.key === current),
    0
  );
  const step = (by: number) =>
    onChange(variants[(index + by + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-foreground text-background shadow-popover fixed top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-2 py-1 text-xs font-medium">
      <button type="button" aria-label="Previous variant" onClick={() => step(-1)} className="p-1">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span>
        {variants[index].key} ({variants[index].name})
      </span>
      <button type="button" aria-label="Next variant" onClick={() => step(1)} className="p-1">
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
