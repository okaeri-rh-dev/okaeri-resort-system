// PROTOTYPE: throwaway. Lives on branch prototype/contact-channels only.
import { useEffect } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  current: string;
  onVariantChange: (key: string) => void;
  dataSets: string[];
  currentDataSet: string;
  onDataSetChange: (key: string) => void;
}

export function PrototypeSwitcher({
  variants,
  current,
  onVariantChange,
  dataSets,
  currentDataSet,
  onDataSetChange,
}: PrototypeSwitcherProps) {
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current)
  );
  const step = (delta: number) =>
    onVariantChange(variants[(index + delta + variants.length) % variants.length].key);

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

  if (!import.meta.env.DEV) return null;

  return (
    <div
      data-prototype-switcher
      className="bg-foreground text-background shadow-popover fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-2 py-1 text-xs"
    >
      <button type="button" aria-label="Previous variant" onClick={() => step(-1)} className="p-1">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="font-semibold whitespace-nowrap">
        {variants[index].key} ({variants[index].name})
      </span>
      <button type="button" aria-label="Next variant" onClick={() => step(1)} className="p-1">
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
      <span className="opacity-60">data</span>
      {dataSets.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDataSetChange(key)}
          className={`rounded-full px-2 py-0.5 ${key === currentDataSet ? "bg-background text-foreground" : ""}`}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
