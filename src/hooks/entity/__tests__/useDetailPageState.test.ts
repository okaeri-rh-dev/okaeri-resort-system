// src/hooks/entity/__tests__/useDetailPageState.test.ts

import { useNavigate, useSearch } from "@tanstack/react-router";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDetailPageState } from "../useDetailPageState";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  useSearch: vi.fn(),
  useNavigate: vi.fn(),
}));

describe("useDetailPageState", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  describe("Tab state management", () => {
    it("returns default tab when no search param", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("details");
    });

    it("returns tab from search params", () => {
      vi.mocked(useSearch).mockReturnValue({ tab: "payments" });

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("payments");
    });

    it("handles audit tab from search params", () => {
      vi.mocked(useSearch).mockReturnValue({ tab: "audit" });

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("audit");
    });

    it("handles history tab from search params", () => {
      vi.mocked(useSearch).mockReturnValue({ tab: "history" });

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("history");
    });
  });

  describe("setActiveTab", () => {
    it("navigates with new tab value", () => {
      vi.mocked(useSearch).mockReturnValue({ tab: "details" });

      const { result } = renderHook(() => useDetailPageState());

      act(() => {
        result.current.setActiveTab("payments");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        search: expect.any(Function),
        replace: true,
      });

      // Test the search function that was passed
      const searchFn = mockNavigate.mock.calls[0][0].search;
      const previousSearch = { tab: "details", someOtherParam: "value" };
      const newSearch = searchFn(previousSearch);

      expect(newSearch).toEqual({
        tab: "payments",
        someOtherParam: "value",
      });
    });

    it("preserves other search params when changing tab", () => {
      vi.mocked(useSearch).mockReturnValue({
        tab: "details",
        showRelated: true,
        filter: "active",
      });

      const { result } = renderHook(() => useDetailPageState());

      act(() => {
        result.current.setActiveTab("audit");
      });

      const searchFn = mockNavigate.mock.calls[0][0].search;
      const previousSearch = { tab: "details", showRelated: true, filter: "active" };
      const newSearch = searchFn(previousSearch);

      expect(newSearch).toEqual({
        tab: "audit",
        showRelated: true,
        filter: "active",
      });
    });

    it("uses replace navigation to avoid history pollution", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result } = renderHook(() => useDetailPageState());

      act(() => {
        result.current.setActiveTab("payments");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        search: expect.any(Function),
        replace: true,
      });
    });

    it("handles multiple tab changes", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result } = renderHook(() => useDetailPageState());

      act(() => {
        result.current.setActiveTab("payments");
      });

      act(() => {
        result.current.setActiveTab("audit");
      });

      act(() => {
        result.current.setActiveTab("details");
      });

      expect(mockNavigate).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge cases", () => {
    it("handles empty search object", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("details");
    });

    it("handles tab property undefined", () => {
      vi.mocked(useSearch).mockReturnValue({ tab: undefined });

      const { result } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("details");
    });

    it("accepts invalid tab value (no runtime validation)", () => {
      // Testing invalid tab value
      vi.mocked(useSearch).mockReturnValue({ tab: "invalid" });

      const { result } = renderHook(() => useDetailPageState());

      // Hook doesn't validate at runtime, TypeScript prevents this at compile time
      expect(result.current.activeTab).toBe("invalid");
    });
  });

  describe("Type safety", () => {
    it("ensures type-safe tab values", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result } = renderHook(() => useDetailPageState());

      // Valid tab values should work
      act(() => {
        result.current.setActiveTab("details");
        result.current.setActiveTab("payments");
        result.current.setActiveTab("audit");
        result.current.setActiveTab("history");
      });

      // TypeScript will prevent invalid tab values at compile time
      // Invalid tab value would be caught at compile time:
      // result.current.setActiveTab("invalid");
    });
  });

  describe("Integration with navigation", () => {
    it("maintains state across re-renders", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result, rerender } = renderHook(() => useDetailPageState());

      const initialSetActiveTab = result.current.setActiveTab;

      rerender();

      // Function reference should be stable
      expect(result.current.setActiveTab).toBe(initialSetActiveTab);
    });

    it("responds to external search param changes", () => {
      vi.mocked(useSearch).mockReturnValue({});

      const { result, rerender } = renderHook(() => useDetailPageState());

      expect(result.current.activeTab).toBe("details");

      // Simulate external navigation changing the search param
      vi.mocked(useSearch).mockReturnValue({ tab: "audit" });

      rerender();

      expect(result.current.activeTab).toBe("audit");
    });
  });
});
