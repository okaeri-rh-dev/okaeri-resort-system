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

describe("palette classes and font-mono", () => {
  const rule = "better-tailwindcss/no-restricted-classes";

  it("flags palette classes inside cn() and cva()", async () => {
    const messages = await lint(
      `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("bg-red-500", { variants: { tone: { quiet: "text-slate-700" } } });
export const Box = () => <div className={cn(variants(), "text-blue-600")} />;
`
    );

    expect(
      messages.filter((message) => message.ruleId === rule).map((message) => message.message)
    ).toEqual([
      expect.stringContaining('"bg-red-500"'),
      expect.stringContaining('"text-slate-700"'),
      expect.stringContaining('"text-blue-600"'),
    ]);
  });

  it.each([
    "text-white",
    "bg-black/50",
    "hover:bg-emerald-50",
    "dark:border-zinc-800",
    "ring-offset-gray-100",
    "from-amber-400",
    "divide-y divide-neutral-200",
    "fill-taupe-300",
    "font-mono",
    "md:font-mono",
  ])("flags %s", async (className) => {
    expect(await ruleIds(`export const A = () => <div className="${className}" />;`)).toContain(
      rule
    );
  });

  it.each([
    "bg-success text-success-foreground",
    "bg-availability-high text-foreground",
    "bg-sidebar text-sidebar-foreground",
    "bg-overlay shadow-card rounded-xl",
    "font-display font-sans",
    "border-transparent text-current",
    "font-medium",
  ])("accepts %s", async (className) => {
    expect(await ruleIds(`export const A = () => <div className="${className}" />;`)).not.toContain(
      rule
    );
  });
});

describe("unknown classes", () => {
  const rule = "better-tailwindcss/no-unknown-classes";

  it("flags a class Tailwind can't resolve", async () => {
    const messages = await lint(
      `import { cn } from "@/lib/utils";
export const Box = () => <div className={cn("bg-background text-foreground", "card-elevated")} />;
`
    );

    expect(
      messages.filter((message) => message.ruleId === rule).map((message) => message.message)
    ).toEqual(["Unknown class detected: card-elevated"]);
  });

  it("accepts the Hearth token utilities and dark: variants", async () => {
    expect(
      await ruleIds(
        `export const A = () => <div className="bg-brand text-brand-foreground dark:bg-card shadow-popover" />;`
      )
    ).not.toContain(rule);
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

describe("arbitrary text sizes", () => {
  const rule = "better-tailwindcss/no-restricted-classes";

  it("names the class and the 12px floor", async () => {
    const messages = await lint(`export const A = () => <div className="text-[10px]" />;`);

    expect(
      messages.filter((message) => message.ruleId === rule).map((message) => message.message)
    ).toEqual([expect.stringMatching(/"text-\[10px\]".*text-xs/)]);
  });

  it.each([
    "text-[0.8rem]",
    "md:text-[11px]",
    "text-[clamp(7px,2cqi,10px)]",
    "text-[length:var(--size)]",
    "text-[calc(1rem+2px)]",
    "text-[9px]/4",
    "text-[2em]!",
  ])("flags %s", async (className) => {
    expect(await ruleIds(`export const A = () => <div className="${className}" />;`)).toContain(
      rule
    );
  });

  it.each(["text-xs", "text-sm/6", "md:text-4xl", "text-muted-foreground", "text-balance"])(
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
