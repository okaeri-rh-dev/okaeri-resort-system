/** PROTOTYPE — one in-memory store shared by every variant, so switching keeps your edits. */
import { useSyncExternalStore } from "react";

import {
  findConflicts,
  initialBlocks,
  initialBookings,
  lateBooking,
  type Conflict,
  type ProtoBlock,
  type ProtoBooking,
} from "./model";

interface State {
  blocks: ProtoBlock[];
  bookings: ProtoBooking[];
  /** When true, the next confirm finds a booking that was not in the confirmed list. */
  raceNextConfirm: boolean;
}

let state: State = { blocks: initialBlocks, bookings: initialBookings, raceNextConfirm: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export function useProtoBlocks() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );

  return {
    ...snapshot,
    setRaceNextConfirm: (raceNextConfirm: boolean) => set({ raceNextConfirm }),
    reset: () => set({ blocks: initialBlocks, bookings: initialBookings, raceNextConfirm: false }),
    saveBlocks: (drafts: Omit<ProtoBlock, "id">[], replaceId?: string) => {
      const kept = state.blocks.filter((block) => block.id !== replaceId);
      const created = drafts.map((draft, index) => ({
        ...draft,
        id: replaceId && index === 0 ? replaceId : crypto.randomUUID(),
      }));
      set({ blocks: [...kept, ...created] });
    },
    deleteBlock: (id: string) => set({ blocks: state.blocks.filter((block) => block.id !== id) }),
    /** Rule 7: re-read the conflicts; refuse all if they differ from what the manager confirmed. */
    cancelAndSave: (
      confirmed: Conflict[],
      drafts: Omit<ProtoBlock, "id">[],
      replaceId?: string
    ): { ok: true } | { ok: false } => {
      let bookings = state.bookings;
      if (state.raceNextConfirm && !bookings.some((b) => b.id === lateBooking.id)) {
        bookings = [...bookings, lateBooking];
        set({ bookings, raceNextConfirm: false });
      }
      const unitIds =
        drafts[0].unitId === null ? null : drafts.map((draft) => draft.unitId as string);
      const current = findConflicts(bookings, unitIds, drafts[0].firstNight, drafts[0].lastNight);
      const same =
        current.length === confirmed.length &&
        current.every((c) => confirmed.some((k) => k.booking.id === c.booking.id));
      if (!same) return { ok: false };

      const cancelIds = new Set(confirmed.map((c) => c.booking.id));
      set({
        bookings: bookings.map((b) => (cancelIds.has(b.id) ? { ...b, status: "Cancelled" } : b)),
      });
      const kept = state.blocks.filter((block) => block.id !== replaceId);
      set({
        blocks: [...kept, ...drafts.map((draft) => ({ ...draft, id: crypto.randomUUID() }))],
      });
      return { ok: true };
    },
  };
}
