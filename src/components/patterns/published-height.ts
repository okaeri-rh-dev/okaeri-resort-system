import { useCallback, useContext } from "react";

import { CompactWindowContext } from "./window-size";

/**
 * Returns a ref that writes the element's rendered height to `variable` on the document root while
 * `enabled`, and removes it when the element unmounts or `enabled` turns false.
 */
export function usePublishedHeight(variable: string, enabled: boolean) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!enabled || !element) return;
      const root = document.documentElement;
      const publish = () => root.style.setProperty(variable, `${element.offsetHeight}px`);
      publish();
      const observer = new ResizeObserver(publish);
      observer.observe(element);
      return () => {
        observer.disconnect();
        root.style.removeProperty(variable);
      };
    },
    [variable, enabled]
  );
}

/**
 * Ref for a page's own fixed bottom bar (the one that sits above the admin bottom bar). On a compact
 * window it publishes the bar's height to `--page-bottom-bar-height`, so toasts stack above the bar
 * instead of covering it. Pass `false` when the bar is not at the screen foot (in a sheet, say).
 *
 * @example
 * <div ref={usePageBottomBarRef()} className="fixed inset-x-0 bottom-(--admin-bottom-bar-height)">…</div>
 */
export function usePageBottomBarRef(isPageBar = true) {
  const isCompact = useContext(CompactWindowContext);
  return usePublishedHeight("--page-bottom-bar-height", isCompact && isPageBar);
}
