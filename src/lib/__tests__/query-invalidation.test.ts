import { afterEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "@/lib/query-client";
import {
  afterBookingPaymentChange,
  afterExpenseChange,
  invalidateAvailability,
} from "@/lib/query-invalidation";
import { accountKeys, expenseKeys, unitKeys } from "@/lib/query-keys";

const invalidatedKeys = () => {
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
};

describe("query invalidation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes account balances after a payment change", () => {
    const keys = invalidatedKeys();
    afterBookingPaymentChange();
    expect(keys()).toContainEqual(accountKeys.all);
  });

  it("refreshes expenses and account balances after an expense change", () => {
    const keys = invalidatedKeys();
    afterExpenseChange();
    expect(keys()).toContainEqual(expenseKeys.all);
    expect(keys()).toContainEqual(accountKeys.all);
  });

  it("refreshes each cabin's state tonight after a booking or block change", () => {
    const keys = invalidatedKeys();
    invalidateAvailability();
    expect(keys()).toContainEqual(unitKeys.allStates());
  });
});
