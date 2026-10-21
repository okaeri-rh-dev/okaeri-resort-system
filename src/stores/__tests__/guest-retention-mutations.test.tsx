import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { useAnonymizeGuest, useDeleteGuest } from "@/stores/useGuestStore";

vi.mock("@/hooks/useAuthToken", () => ({ getAccessToken: vi.fn(async () => "token") }));

// Spied per test: msw-setup patches fetch in beforeAll, after module-level stubs run
let fetchMock: MockInstance<typeof fetch>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("guest retention mutations", () => {
  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
  });

  it("anonymizes through the admin endpoint", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deleted_files: 2, failed_files: [] }));
    const { result } = renderHook(() => useAnonymizeGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guests/g1/anonymize", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });
    expect(result.current.data).toMatchObject({ deleted_files: 2 });
  });

  it("surfaces the server message on 409", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "anonymize_guest", message: "Guest g1 has a current or future booking" }, 409)
    );
    const { result } = renderHook(() => useAnonymizeGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("current or future booking");
  });

  it("deletes through the admin endpoint", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deleted_files: 0, failed_files: [] }));
    const { result } = renderHook(() => useDeleteGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guests/g1", {
      method: "DELETE",
      headers: { Authorization: "Bearer token" },
    });
  });
});
