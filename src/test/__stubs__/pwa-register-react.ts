// Stub for `virtual:pwa-register/react` used during Vitest runs.
// The PWA plugin isn't loaded in test mode, so Vite cannot resolve the
// virtual module on its own. This stub satisfies static import resolution;
// `vi.mock("virtual:pwa-register/react", ...)` in src/test/setup.ts
// overrides the runtime behavior.
export function useRegisterSW(_options?: unknown) {
  return {
    needRefresh: [false, (_v: boolean) => {}] as const,
    offlineReady: [false, (_v: boolean) => {}] as const,
    updateServiceWorker: async (_reload?: boolean) => {},
  };
}
