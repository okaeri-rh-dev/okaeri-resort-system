/**
 * The weekend rate applies to Friday and Saturday nights: a Fri→Sun stay has
 * two weekend nights. Shared by the booking form, the quote APIs and booking
 * creation so they price the same stay the same way.
 */
export function isWeekendNight(night: Date): boolean {
  const dayOfWeek = night.getDay();
  return dayOfWeek === 5 || dayOfWeek === 6;
}
