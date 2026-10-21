/** PROTOTYPE — the in-memory store's context, filled by ProtoStoreProvider. */
import { createContext, useContext } from "react";

import type { ProtoBooking } from "./fixture";

export interface ProtoStore {
  bookings: ProtoBooking[];
  changedCount: number;
  confirm: (id: string) => void;
  checkIn: (id: string) => void;
  checkOut: (id: string) => void;
  verify: (id: string, cabins: string[]) => void;
  reject: (id: string) => void;
  recordPayment: (id: string) => void;
  cancel: (id: string) => void;
  reset: () => void;
}

export const StoreContext = createContext<ProtoStore | null>(null);

export function useProtoStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useProtoStore needs ProtoStoreProvider");
  return store;
}
