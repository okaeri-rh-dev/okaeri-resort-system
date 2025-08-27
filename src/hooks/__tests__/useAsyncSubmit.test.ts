import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsyncSubmit } from "../useAsyncSubmit";

// Mock the uiStore
vi.mock("@/stores/uiStore", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useAsyncSubmit", () => {
  it("should handle successful submission", async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    const mockOnSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAsyncSubmit(mockSubmit, {
        successMessage: "Success!",
        onSuccess: mockOnSuccess,
      })
    );

    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.handleSubmit({ test: "data" });
    });

    expect(mockSubmit).toHaveBeenCalledWith({ test: "data" });
    expect(mockOnSuccess).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle submission errors", async () => {
    const mockSubmit = vi.fn().mockRejectedValue(new Error("Test error"));
    const mockOnError = vi.fn();

    const { result } = renderHook(() =>
      useAsyncSubmit(mockSubmit, {
        errorMessage: "Error!",
        onError: mockOnError,
      })
    );

    await act(async () => {
      await result.current.handleSubmit({ test: "data" });
    });

    expect(mockSubmit).toHaveBeenCalledWith({ test: "data" });
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    expect(result.current.isLoading).toBe(false);
  });

  it("should set loading state during submission", async () => {
    let resolveSubmit: () => void;
    const mockSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    const { result } = renderHook(() => useAsyncSubmit(mockSubmit));

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.handleSubmit({ test: "data" });
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSubmit();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  it("should use default messages when not provided", () => {
    const mockSubmit = vi.fn();

    const { result } = renderHook(() => useAsyncSubmit(mockSubmit));

    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.reset).toBeDefined();
  });
});
