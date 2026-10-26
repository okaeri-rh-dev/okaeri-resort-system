/** PROTOTYPE — floating switcher: variant, role preview, and the "list changed" race. Hidden in production. */
import { useEffect } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ProtoRole } from "./model";
import { useProtoBlocks } from "./use-proto-blocks";
import { variants } from "./variants";

type VariantKey = (typeof variants)[number]["key"];

export function PrototypeSwitcher({
  variantKey,
  role,
  onChange,
}: {
  variantKey: VariantKey;
  role: ProtoRole;
  onChange: (next: { variant?: VariantKey; role?: ProtoRole }) => void;
}) {
  const store = useProtoBlocks();
  const index = variants.findIndex((v) => v.key === variantKey);
  const step = (delta: number) =>
    onChange({ variant: variants[(index + delta + variants.length) % variants.length].key });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-foreground text-background shadow-popover fixed top-2 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 text-xs">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => step(-1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="font-medium whitespace-nowrap">
        {variants[index].key} {variants[index].name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => step(1)}
        className="rounded-full p-2 hover:opacity-70"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
      <select
        aria-label="Preview as"
        value={role}
        onChange={(event) => onChange({ role: event.target.value as ProtoRole })}
        className="bg-foreground rounded px-1 py-0.5"
      >
        <option value="manager">as manager</option>
        <option value="staff">as staff</option>
      </select>
      <label className="flex items-center gap-1 px-1 whitespace-nowrap">
        <input
          type="checkbox"
          checked={store.raceNextConfirm}
          onChange={(event) => store.setRaceNextConfirm(event.target.checked)}
        />
        race next confirm
      </label>
      <button
        type="button"
        onClick={store.reset}
        className="rounded-full px-2 py-1 hover:opacity-70"
      >
        Reset
      </button>
    </div>
  );
}
