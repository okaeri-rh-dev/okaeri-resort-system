import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_SYNC_DEBOUNCE_MS } from "@/components/documents/constants";
import { useDocumentStore } from "@/stores/useDocumentStore";

import { useDocumentForm } from "../useDocumentForm";

describe("useDocumentForm store sync", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
    useDocumentStore.getState().resetForm();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a pending edit to the store when the form unmounts before the debounce", () => {
    const { result, unmount } = renderHook(() => useDocumentForm());

    act(() => result.current.form.setValue("recipient.name", "Maria Santos"));
    act(() => vi.advanceTimersByTime(FORM_SYNC_DEBOUNCE_MS - 1));
    expect(useDocumentStore.getState().formData.recipient.name).toBe("");

    unmount();

    expect(useDocumentStore.getState().formData.recipient.name).toBe("Maria Santos");
  });

  it("writes the store once for several edits within the debounce", () => {
    const { result } = renderHook(() => useDocumentForm());
    const storeWrites = vi.fn();
    const unsubscribe = useDocumentStore.subscribe(storeWrites);

    for (const name of ["M", "Ma", "Mar", "Mari", "Maria"]) {
      act(() => result.current.form.setValue("recipient.name", name));
      act(() => vi.advanceTimersByTime(FORM_SYNC_DEBOUNCE_MS / 3));
    }
    expect(storeWrites).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(FORM_SYNC_DEBOUNCE_MS));

    expect(storeWrites).toHaveBeenCalledTimes(1);
    expect(useDocumentStore.getState().formData.recipient.name).toBe("Maria");
    unsubscribe();
  });
});
