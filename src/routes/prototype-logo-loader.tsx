// PROTOTYPE: three logo loader animations, switchable via ?variant=, inside the real guest shell.
// Question: which loader replaces the spinners (App.tsx auth check, router pending)? Never merge.
import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { GuestLayout } from "@/layouts/GuestLayout";

const variants = [
  { key: "A", name: "Logo pulse" },
  { key: "B", name: "Roof-line sequence" },
  { key: "C", name: "Logo + sliding bar" },
] as const;

type VariantKey = (typeof variants)[number]["key"];

export const Route = createFileRoute("/prototype-logo-loader")({
  validateSearch: (search: Record<string, unknown>): { variant: VariantKey } => ({
    variant: variants.some((v) => v.key === search.variant) ? (search.variant as VariantKey) : "A",
  }),
  component: PrototypePage,
});

const roofPaths = [
  "M108.8 195.1 99.4 184.1 216.7 130.7 229 140z",
  "M165.1 195.1 155.7 184.1 273 130.7 285.3 140z",
  "M221.4 195.1 212 184.1 335 128.4 412.1 188 401 196.3 333.4 144.4z",
];

// Mirrors src/index.css:335 so reduced motion can be toggled without OS settings.
const css = `
@keyframes proto-pulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
@keyframes proto-roof { 0%,100% { opacity: .25 } 30%,60% { opacity: 1 } }
@keyframes proto-bar { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }
.proto-pulse { animation: proto-pulse 1.6s ease-in-out infinite }
.proto-roof path { animation: proto-roof 1.5s ease-in-out infinite; opacity: .25 }
.proto-roof path:nth-child(2) { animation-delay: .2s }
.proto-roof path:nth-child(3) { animation-delay: .4s }
.proto-bar { animation: proto-bar 1.2s ease-in-out infinite }
.proto-rm-text { display: none }
.proto-rm *, .proto-rm *::before, .proto-rm *::after {
  animation-duration: .01ms !important; animation-iteration-count: 1 !important;
}
.proto-rm .proto-rm-text { display: block }
@media (prefers-reduced-motion: reduce) { .proto-rm-text { display: block } }
`;

function LoaderA({ width }: { width: string }) {
  return (
    <svg viewBox="16 124 480 236" className="proto-pulse" style={{ width }} aria-hidden="true">
      <use href="/logo.svg#logo" />
    </svg>
  );
}

function LoaderB({ width }: { width: string }) {
  return (
    <svg viewBox="16 124 480 236" style={{ width }} aria-hidden="true">
      <g className="proto-roof" style={{ fill: "var(--brand)" }}>
        {roofPaths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <use href="/logo.svg#wordmark" />
    </svg>
  );
}

function LoaderC({ width }: { width: string }) {
  return (
    <div style={{ width }}>
      <svg viewBox="16 124 480 236" className="w-full" aria-hidden="true">
        <use href="/logo.svg#logo" />
      </svg>
      <div className="bg-muted mx-auto mt-3 h-[3px] w-2/3 overflow-hidden rounded-full">
        <div className="proto-bar bg-brand h-full w-2/5 rounded-full" />
      </div>
    </div>
  );
}

const loaders: Record<VariantKey, typeof LoaderA> = { A: LoaderA, B: LoaderB, C: LoaderC };

function Loader({ variant, width }: { variant: VariantKey; width: string }) {
  const Component = loaders[variant];
  return (
    <div role="status" className="text-foreground flex flex-col items-center">
      <Component width={width} />
      <p className="proto-rm-text text-muted-foreground mt-3 text-sm">Loading…</p>
      <span className="sr-only">Loading Okaeri Rest House</span>
    </div>
  );
}

function PrototypePage() {
  const { variant } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fullScreen, setFullScreen] = useState<"off" | "splash" | "loader">("off");

  const replayBoot = () => {
    setFullScreen("splash");
    setTimeout(() => setFullScreen("loader"), 900);
  };

  return (
    <GuestLayout pageHeader={{ title: "PROTOTYPE: logo loader" }}>
      <style>{css}</style>
      <div className={reducedMotion ? "proto-rm" : undefined}>
        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            Simulate reduced motion
          </label>
          <button type="button" className="underline" onClick={replayBoot}>
            Replay boot (splash → full-size loader)
          </button>
          <button type="button" className="underline" onClick={() => setFullScreen("loader")}>
            Full-size loader only
          </button>
        </div>

        <p className="text-muted-foreground mb-2 text-sm">Content-area size (router pending):</p>
        <div className="border-border flex min-h-96 items-center justify-center rounded-lg border border-dashed">
          <Loader variant={variant} width="8rem" />
        </div>

        {fullScreen !== "off" && (
          <div
            className="bg-background fixed inset-0 z-50 grid min-h-dvh place-items-center"
            onClick={() => setFullScreen("off")}
          >
            {fullScreen === "splash" ? (
              <svg viewBox="16 124 480 236" style={{ width: "min(60vw, 240px)" }}>
                <use href="/logo.svg#logo" />
              </svg>
            ) : (
              <Loader variant={variant} width="min(60vw, 240px)" />
            )}
            <p className="text-muted-foreground absolute bottom-16 text-xs">Click to close</p>
          </div>
        )}
      </div>

      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          void navigate({ search: { variant: key as VariantKey }, replace: true })
        }
      />
    </GuestLayout>
  );
}
