import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The content width of an element, kept current by one `ResizeObserver`. `null` until the first
 * measurement. Private to the kit: panes adapt inside patterns, and product code never reads width.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
