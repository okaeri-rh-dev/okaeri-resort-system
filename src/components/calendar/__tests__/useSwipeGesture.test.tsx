/**
 * Component Tests for useSwipeGesture Hook
 *
 * Tests the swipe gesture detection hook for mobile navigation.
 *
 * Test Coverage:
 * - Touch event handling: touchstart, touchmove, touchend
 * - Swipe detection: Left and right swipes
 * - Distance threshold: Minimum swipe distance
 * - Callback invocation: Correct callbacks triggered
 * - Cleanup: Event listener removal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeGesture } from "../useSwipeGesture";
import { act } from "react";

describe("useSwipeGesture", () => {
  beforeEach(() => {
    // Tests create their own TouchEvent instances inline
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Swipe Left Detection", () => {
    it("should detect left swipe when distance exceeds threshold", () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          onSwipeRight,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Start at x=150
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        // Move to x=50 (left swipe of 100px)
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        // End touch
        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it("should not detect left swipe if distance below threshold", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Start at x=100
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );

        // Move to x=70 (left swipe of only 30px)
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 70, clientY: 100 } as Touch],
          })
        );

        // End touch
        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("should respect custom minimum swipe distance", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          minSwipeDistance: 100, // Higher threshold
        })
      );

      act(() => {
        // Swipe 75px (below threshold)
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 75, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });
  });

  describe("Swipe Right Detection", () => {
    it("should detect right swipe when distance exceeds threshold", () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          onSwipeRight,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Start at x=50
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        // Move to x=150 (right swipe of 100px)
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        // End touch
        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("should not detect right swipe if distance below threshold", () => {
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeRight,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Start at x=100
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );

        // Move to x=130 (right swipe of only 30px)
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 130, clientY: 100 } as Touch],
          })
        );

        // End touch
        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });
  });

  describe("Default Threshold", () => {
    it("should use 50px as default minimum swipe distance", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          // No minSwipeDistance provided
        })
      );

      act(() => {
        // Swipe exactly 50px
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      // Should NOT trigger because 50px is not > 50px threshold
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("should trigger with 51px swipe using default threshold", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
        })
      );

      act(() => {
        // Swipe 51px (just over default threshold)
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 49, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe("Vertical Movement", () => {
    it("should ignore vertical swipes (Y-axis movement)", () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          onSwipeRight,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Vertical swipe (only Y changes)
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 100, clientY: 50 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 100, clientY: 150 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      // Should not trigger horizontal swipe callbacks
      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it("should detect horizontal swipe even with some vertical movement", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          minSwipeDistance: 50,
        })
      );

      act(() => {
        // Diagonal swipe (mostly horizontal)
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 120 } as Touch], // 100px horizontal, 20px vertical
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      // Should still detect horizontal swipe
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Cleanup", () => {
    it("should remove event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = renderHook(() =>
        useSwipeGesture({
          onSwipeLeft: vi.fn(),
          onSwipeRight: vi.fn(),
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("touchend", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it("should not trigger callbacks after unmount", () => {
      const onSwipeLeft = vi.fn();

      const { unmount } = renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
        })
      );

      unmount();

      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should not trigger if touchstart is missing", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
        })
      );

      act(() => {
        // Skip touchstart, go straight to touchmove
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("should not trigger if touchmove is missing", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
        })
      );

      act(() => {
        // Only touchstart and touchend
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it("should handle multiple swipes in sequence", () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          onSwipeRight,
          minSwipeDistance: 50,
        })
      );

      // First swipe left
      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);

      // Second swipe right
      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1); // Still 1
      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it("should reset state after each swipe", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          minSwipeDistance: 50,
        })
      );

      // First swipe
      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      // Try incomplete second swipe (should not use data from first)
      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 0, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      // Should only trigger once (from first complete swipe)
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe("Callback Options", () => {
    it("should work with only onSwipeLeft callback", () => {
      const onSwipeLeft = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          // No onSwipeRight
        })
      );

      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });

    it("should work with only onSwipeRight callback", () => {
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeRight,
          // No onSwipeLeft
        })
      );

      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it("should work with both callbacks", () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      renderHook(() =>
        useSwipeGesture({
          onSwipeLeft,
          onSwipeRight,
        })
      );

      // Swipe left
      act(() => {
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [{ clientX: 150, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(
          new TouchEvent("touchmove", {
            touches: [{ clientX: 50, clientY: 100 } as Touch],
          })
        );

        document.dispatchEvent(new TouchEvent("touchend"));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
      expect(onSwipeRight).not.toHaveBeenCalled();
    });
  });
});
