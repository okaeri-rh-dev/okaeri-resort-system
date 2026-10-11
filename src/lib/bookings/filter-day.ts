import { isManilaDay, manilaDayOf, type ManilaDay } from "./stay";

// Booking list filters were persisted as ISO instants before they became days
export const filterDay = (value: string): ManilaDay =>
  isManilaDay(value) ? value : manilaDayOf(value);
