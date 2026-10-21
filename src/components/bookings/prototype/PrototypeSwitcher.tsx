/** PROTOTYPE — floating variant switcher. Hidden in production builds. */
import { useEffect } from "react";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { useProtoSearch } from "./search";
import { useProtoStore } from "./store-context";

const VARIANT_NAMES = { 1: "Agenda", 2: "Views + side pane", 3: "Cabin timeline" } as const;
type VariantKey = keyof typeof VARIANT_NAMES;
const KEYS = [1, 2, 3] as const;

export function PrototypeSwitcher() {
  const { search, setSearch } = useProtoSearch();
  const { bookings, changedCount, reset } = useProtoStore();
  const current = search.v;

  const step = (delta: number) => {
    const index = (KEYS.indexOf(current) + delta + KEYS.length) % KEYS.length;
    setSearch({ v: KEYS[index] as VariantKey, sel: undefined, panel: undefined });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], [role=dialog]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-foreground text-background shadow-popover expanded:bottom-4 fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 text-xs">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => step(-1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="font-medium whitespace-nowrap tabular-nums">
        V{current} {VARIANT_NAMES[current]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => step(1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
      <span className="medium:inline hidden whitespace-nowrap tabular-nums opacity-70">
        · {bookings.length} bookings · {changedCount} changed ·
      </span>
      <button
        type="button"
        onClick={() => setSearch({ d: search.d === "quiet" ? "full" : "quiet" })}
        className="rounded-full px-2 py-1 whitespace-nowrap hover:opacity-70"
      >
        Data: {search.d === "quiet" ? "nobody in-house" : "full"}
      </button>
      <button
        type="button"
        aria-label="Reset prototype data"
        onClick={reset}
        className="rounded-full p-2 hover:opacity-70"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
