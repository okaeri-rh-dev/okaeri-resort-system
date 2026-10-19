// @vitest-environment node
/* eslint-disable design/no-restricted-syntax -- the snippets are deliberate violations */
/**
 * Pins each design lint rule to a failing and a passing snippet, so a plugin
 * upgrade or config edit can't quietly turn a rule off. Snippets lint through
 * the real eslint.config.js at a src/ path that eslint-suppressions.json can't match.
 */

import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const SNIPPET_PATH = "src/__design_lint__/Snippet.tsx";

let eslint: ESLint;

beforeAll(() => {
  process.env.ESLINT_TYPE_AWARE = "off";
  eslint = new ESLint({ cwd: process.cwd() });
});

async function lint(code: string, overrideConfig?: Linter.Config): Promise<Linter.LintMessage[]> {
  const linter = overrideConfig ? new ESLint({ cwd: process.cwd(), overrideConfig }) : eslint;
  const [result] = await linter.lintText(code, { filePath: SNIPPET_PATH });
  // A snippet that doesn't parse would pass every "accepts" case
  expect(result.messages.filter((message) => message.fatal)).toEqual([]);
  return result.messages;
}

async function ruleIds(code: string, overrideConfig?: Linter.Config): Promise<string[]> {
  return (await lint(code, overrideConfig)).map((message) => message.ruleId ?? "fatal");
}

describe("better-tailwindcss reads the v4 @theme setup", () => {
  // Palette and unknown-class rules turn on in a later slice; this proves the plugin
  // as configured here (entryPoint src/index.css) can enforce them.
  const laterSliceRules: Linter.Config = {
    files: ["src/**/*.tsx"],
    rules: {
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: [{ pattern: "^(?:.*:)?(?:bg|text|border)-(?:slate|red|blue)-\\d+$" }] },
      ],
      "better-tailwindcss/no-unknown-classes": "error",
    },
  };

  it("flags a palette class inside cn() and cva()", async () => {
    const messages = await lint(
      `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("bg-red-500", { variants: { tone: { quiet: "text-slate-700" } } });
export const Box = () => <div className={cn(variants(), "text-blue-600")} />;
`,
      laterSliceRules
    );

    const flagged = messages
      .filter((message) => message.ruleId === "better-tailwindcss/no-restricted-classes")
      .map((message) => message.message);
    expect(flagged).toEqual([
      'Restricted class: "bg-red-500".',
      'Restricted class: "text-slate-700".',
      'Restricted class: "text-blue-600".',
    ]);
  });

  it("flags an unknown class and accepts classes defined in @theme", async () => {
    const messages = await lint(
      `import { cn } from "@/lib/utils";
export const Box = () => <div className={cn("bg-background text-foreground", "card-elevated")} />;
`,
      laterSliceRules
    );

    expect(
      messages
        .filter((message) => message.ruleId === "better-tailwindcss/no-unknown-classes")
        .map((message) => message.message)
    ).toEqual(["Unknown class detected: card-elevated"]);
  });
});

describe("arbitrary colours", () => {
  const rule = "better-tailwindcss/no-restricted-classes";

  it.each([
    "bg-[#0066cc]",
    "hover:text-[oklch(0.5_0.1_200)]",
    "border-[rgb(0,0,0)]/50",
    "fill-[color:var(--brand)]",
    "[color:red]",
    "md:[background-color:#fff]",
  ])("flags %s", async (className) => {
    expect(await ruleIds(`export const A = () => <div className="${className}" />;`)).toContain(
      rule
    );
  });

  it.each(["bg-primary", "text-muted-foreground/80", "w-[320px]", "grid-cols-[1fr_auto]"])(
    "accepts %s",
    async (className) => {
      expect(
        await ruleIds(`export const A = () => <div className="${className}" />;`)
      ).not.toContain(rule);
    }
  );
});

describe("design/no-restricted-syntax", () => {
  const rule = "design/no-restricted-syntax";

  it.each([
    ["transition-all in className", `<div className="p-2 transition-all" />`],
    ["transition-all in cn()", `<div className={cn("p-2", "transition-all duration-150")} />`],
    ["transition-all in a template literal", "<div className={`p-2 ${x} transition-all`} />"],
    ["transition-all behind a variant", `<div className="hover:transition-all" />`],
    ["important transition-all", `<div className="transition-all!" />`],
    ["a focus: ring", `<button className="focus:ring-2" />`],
    ["a stacked focus: outline", `<button className="dark:focus:outline-none" />`],
    ["an <img> without width or height", `<img src="/logo.png" alt="Okaeri" />`],
    ["an <img> with only a width", `<img src="/logo.png" alt="Okaeri" width={120} />`],
  ])("flags %s", async (_name, jsx) => {
    expect(
      await ruleIds(
        `import { cn } from "@/lib/utils";\nconst x = "";\nexport const A = () => ${jsx};`
      )
    ).toContain(rule);
  });

  it.each([
    ["transition-colors", `<div className="transition-colors duration-150" />`],
    ["a focus-visible: ring", `<button className="focus-visible:ring-2 group-focus:ring-1" />`],
    [
      "an <img> with width and height",
      `<img src="/logo.png" alt="Okaeri" width={120} height={40} />`,
    ],
  ])("accepts %s", async (_name, jsx) => {
    expect(await ruleIds(`export const A = () => ${jsx};`)).not.toContain(rule);
  });

  it("leaves the guardrail no-restricted-syntax selectors in place", async () => {
    expect(
      await ruleIds(`export const A = () => <div dangerouslySetInnerHTML={{ __html: "" }} />;`)
    ).toContain("no-restricted-syntax");
  });
});

describe("jsx-a11y recommended with the shadcn component map", () => {
  const a11yRules = async (jsx: string) =>
    (await ruleIds(`export const A = () => ${jsx};`)).filter((id) => id.startsWith("jsx-a11y/"));

  it.each([
    ["a clickable <div>", `<div onClick={() => {}}>Open</div>`],
    ["Button as a button", `<Button aria-checked>Save</Button>`],
    ["Label as a label", `<Label>Guest name</Label>`],
    ["router Link as an anchor", `<Link to="/admin/bookings" />`],
  ])("flags %s", async (_name, jsx) => {
    expect(await a11yRules(jsx)).not.toEqual([]);
  });

  it.each([
    ["a native button", `<button onClick={() => {}}>Open</button>`],
    ["Button with a supported aria prop", `<Button aria-pressed>Save</Button>`],
    ["Label tied to its control", `<Label htmlFor="guest-name">Guest name</Label>`],
    ["router Link with to and content", `<Link to="/admin/bookings">Bookings</Link>`],
    ["an unmapped component", `<Badge aria-checked />`],
  ])("accepts %s", async (_name, jsx) => {
    expect(await a11yRules(jsx)).toEqual([]);
  });
});
