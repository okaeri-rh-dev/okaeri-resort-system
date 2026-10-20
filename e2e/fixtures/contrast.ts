import type { Locator, Page } from "@playwright/test";

export interface ContrastFailure {
  text: string;
  ratio: number;
  required: number;
  color: string;
  background: string;
}

/**
 * Every visible text run on the page whose contrast against its painted background is below
 * WCAG AA (4.5:1, or 3:1 for large text). Text over a gradient or image is skipped, as are
 * disabled controls. Colours are resolved through a canvas, so OKLCH tokens are measured as
 * the browser paints them.
 */
export async function findLowContrastText(page: Page, root = "body"): Promise<ContrastFailure[]> {
  return page.evaluate((rootSelector) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No 2d canvas context");

    const toRgba = (cssColor: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = cssColor;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };

    const over = (
      top: [number, number, number, number],
      bottom: [number, number, number]
    ): [number, number, number] => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
    ];

    const luminance = ([r, g, b]: [number, number, number]) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const paintedBackground = (element: Element): [number, number, number] | null => {
      const layers: [number, number, number, number][] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none") return null;
        const layer = toRgba(style.backgroundColor);
        if (layer[3] > 0) layers.push(layer);
        if (layer[3] === 1) break;
      }
      let base: [number, number, number] = [255, 255, 255];
      for (const layer of layers.reverse()) base = over(layer, base);
      return base;
    };

    const failures: {
      text: string;
      ratio: number;
      required: number;
      color: string;
      background: string;
    }[] = [];
    const rootElement = document.querySelector(rootSelector);
    if (!rootElement) return failures;

    for (const element of Array.from(rootElement.querySelectorAll("*"))) {
      const text = Array.from(element.childNodes as NodeListOf<ChildNode>)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!text) continue;
      if (element.closest("[disabled], [aria-disabled='true'], [aria-hidden='true'], svg"))
        continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== "visible" || Number(style.opacity) === 0) continue;

      const background = paintedBackground(element);
      if (!background) continue;
      const foreground = over(toRgba(style.color), background);
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a
      );
      const ratio = (lighter + 0.05) / (darker + 0.05);
      const fontSize = parseFloat(style.fontSize);
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700);
      const required = isLarge ? 3 : 4.5;
      if (ratio < required) {
        failures.push({
          text: text.slice(0, 60),
          ratio: Math.round(ratio * 100) / 100,
          required,
          color: style.color,
          background: `rgb(${background.map(Math.round).join(", ")})`,
        });
      }
    }
    return failures;
  }, root);
}

/** The colour painted behind an element: its own and its ancestors' fills, composited. */
function paintedFill(locator: Locator): Promise<[number, number, number]> {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No 2d canvas context");
    const layers: number[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      if (a > 0) layers.push([r, g, b, a / 255]);
      if (a === 255) break;
    }
    let base: [number, number, number] = [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse()) {
      base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
    }
    return base;
  });
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The contrast ratio between two elements' painted fills, such as a tinted cell and its grid. */
export async function fillContrast(target: Locator, backdrop: Locator): Promise<number> {
  const [lighter, darker] = [
    relativeLuminance(await paintedFill(target)),
    relativeLuminance(await paintedFill(backdrop)),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
