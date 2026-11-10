import { manilaDayOf, nightsBetween } from "@/lib/bookings";
import type { BookingUnit } from "@/types/multi-unit-booking";

import { isWeekendNight } from "./weekend-night";

interface CabinRates {
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  base_occupancy: number;
}

type UnitRates = Pick<CabinRates, "base_rate" | "base_occupancy"> & {
  weekend_rate?: number | null;
  extra_person_rate?: number | null;
};

/** The same rates the server stores: global pricing config first, then the unit's own. */
export function cabinRates(unit: UnitRates, config?: CabinRates): CabinRates {
  const baseRate = config?.base_rate ?? unit.base_rate;
  return {
    base_rate: baseRate,
    weekend_rate: config?.weekend_rate ?? unit.weekend_rate ?? baseRate,
    extra_person_rate: config?.extra_person_rate ?? unit.extra_person_rate ?? 0,
    base_occupancy: config?.base_occupancy ?? unit.base_occupancy,
  };
}

export function priceCabin(
  rates: CabinRates,
  checkIn: string,
  checkOut: string,
  numGuests: number
): BookingUnit["pricing"] {
  const checkInDate = new Date(checkIn);
  const nights = nightsBetween(manilaDayOf(checkIn), manilaDayOf(checkOut));

  let baseTotal = 0;
  let weekendSurcharge = 0;
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + i);
    baseTotal += rates.base_rate;
    if (isWeekendNight(currentDate) && rates.weekend_rate > rates.base_rate) {
      weekendSurcharge += rates.weekend_rate - rates.base_rate;
    }
  }

  const extraPersons = Math.max(0, numGuests - rates.base_occupancy);
  const extraPersonFee = extraPersons * rates.extra_person_rate * nights;

  return {
    nights,
    base_total: baseTotal,
    weekend_surcharge: weekendSurcharge,
    extra_person_fee: extraPersonFee,
    unit_total: baseTotal + weekendSurcharge + extraPersonFee,
  };
}
