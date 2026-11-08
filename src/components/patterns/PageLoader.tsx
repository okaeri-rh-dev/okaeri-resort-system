import { useContext } from "react";

import { LogoLoader } from "./LogoLoader";
import { ShellContentContext } from "./shell-content";

/**
 * The wait for a whole page: the logo loader, centred. Inside `AppShell`'s content area it is
 * the content-size loader and the rail stays put; anywhere else it fills the screen at the
 * splash's size. It is the router's default pending view and the fallback for lazy pages.
 * In-page widgets use skeletons instead.
 *
 * @example
 * ```tsx
 * createRouter({ routeTree, defaultPendingComponent: PageLoader });
 * <Suspense fallback={<PageLoader />}>…</Suspense>
 * ```
 */
export function PageLoader() {
  return useContext(ShellContentContext) ? (
    <div className="grid min-h-[50dvh] place-items-center">
      <LogoLoader size="content" />
    </div>
  ) : (
    // Same box as the index.html splash, so the splash turns into the loader without moving
    <div className="grid min-h-dvh place-items-center">
      <LogoLoader />
    </div>
  );
}
