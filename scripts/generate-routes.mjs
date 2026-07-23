// Generates src/routeTree.gen.ts (the TanStack Router route tree) without a full
// vite build. The file is gitignored and normally produced by the tanstackRouter()
// vite plugin during dev/build — but CI type-checks a clean checkout where it does
// not exist yet, so `tsc` fails to resolve `@/routeTree.gen`. Run this before
// type-check in CI. Uses @tanstack/router-generator (already a dep of the plugin,
// version-matched), so no extra dependency and the output matches the real build.
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
// Mirror the plugin's inline config (vite.config.ts: quoteStyle "double"); all
// paths come from getConfig defaults (src/routes -> src/routeTree.gen.ts).
const config = getConfig({ quoteStyle: "double" }, root);

await new Generator({ config, root }).run();

console.log(`✓ Generated ${config.generatedRouteTree}`);
