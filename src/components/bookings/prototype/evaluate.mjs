// PROTOTYPE — runs the plan's 5 evaluation tasks on V1-V3 at laptop and phone width and prints taps per task.
// Needs the dev stack from the plan doc on :5174 and the local seed user. Run: node src/components/bookings/prototype/evaluate.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:5174/admin/prototype/bookings";
const day = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const results = [];
let step = "";
const browser = await browser_launch();
async function browser_launch() {
  return chromium.launch();
}

function rowOf(page, name) {
  return page.locator("li, tr").filter({ hasText: name }).first();
}
async function detailShows(page, name) {
  return page
    .getByRole("heading", { name, level: 2 })
    .first()
    .waitFor({ timeout: 3000 })
    .then(
      () => true,
      () => false
    );
}
async function toastShows(page, text) {
  return page
    .getByText(text)
    .first()
    .waitFor({ timeout: 3000 })
    .then(
      () => true,
      () => false
    );
}

const tasks = {
  async "1a find upcoming guest (Bea)"(page, v) {
    let taps = 0;
    await page.getByPlaceholder(/Search name/).fill("Bea");
    taps++;
    if (v === 3) {
      // Bea arrives in 10 days: inside the default 14-day range
    }
    await rowOf(page, "Bea Fernandez")
      .getByRole("button", { name: /Bea Fernandez/ })
      .first()
      .click();
    taps++;
    return { taps, ok: await detailShows(page, "Bea Fernandez") };
  },
  async "1b find past guest (Nora)"(page, v) {
    let taps = 0;
    await page.getByPlaceholder(/Search name/).fill("Nora");
    taps++;
    if (v === 1) {
      await page.getByRole("button", { name: /Show past/ }).click();
      taps++;
    }
    if (v === 2) {
      await page.getByRole("tab", { name: /Past/ }).click();
      taps++;
    }
    if (v === 3) {
      for (let i = 0; i < 8 && !(await rowOf(page, "Nora Medina").isVisible()); i++) {
        await page.getByRole("button", { name: "Earlier" }).click();
        taps++;
        await page.waitForTimeout(400);
      }
    }
    await rowOf(page, "Nora Medina")
      .getByRole("button", { name: /Nora Medina/ })
      .first()
      .click();
    taps++;
    return { taps, ok: await detailShows(page, "Nora Medina") };
  },
  async "2 who arrives this week"(page, v) {
    // Truth: active bookings with check-in in [today, today+7)
    const truth = [
      "Paolo Garcia",
      "Ma. Concepcion",
      "Ramon Aquino",
      "Andrea Lim",
      "Reyes family",
      "Tess Villanueva",
      "Carlo Navarro",
    ];
    let taps = 0;
    let scope = page.locator("main");
    if (v === 1) scope = page.getByRole("region", { name: "Arriving this week" });
    if (v === 3) {
      await page.getByRole("button", { name: "7 days" }).click();
      taps++;
      await page.getByRole("button", { name: "Today" }).click();
      taps++;
    }
    const text = await scope.innerText();
    const seen = truth.filter((n) => text.includes(n));
    return {
      taps,
      ok: seen.length === truth.length,
      note: `${seen.length}/7 arrivals in the place a user looks first`,
    };
  },
  async "3 check in (Paolo)"(page) {
    let taps = 0;
    await rowOf(page, "Paolo Garcia").getByRole("button", { name: "Check in" }).click();
    taps++;
    return { taps, ok: await toastShows(page, "Checked in: Paolo Garcia") };
  },
  async "4 verify pending (Andrea)"(page) {
    let taps = 0;
    await rowOf(page, "Andrea Lim").getByRole("button", { name: "Verify payment" }).click();
    taps++;
    await page.getByRole("button", { name: "Verify and assign" }).click();
    taps++;
    return { taps, ok: await toastShows(page, "Payment verified: Andrea Lim") };
  },
  async "5 start 2-cabin booking (day +6)"(page, v) {
    let taps = 0;
    if (v === 3) {
      step = "tap empty day";
      await page.getByRole("button", { name: `New booking, Cabin 1, ${day(6)}` }).click();
      taps++;
    } else {
      await page.getByRole("button", { name: "New booking" }).first().click();
      taps++;
      await page.getByLabel("Check-in").fill(day(6));
      taps++;
      await page.getByLabel("Check-out").fill(day(7));
      taps++;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Cabin 1/ })
        .click();
      taps++;
    }
    step = "add Cabin 3";
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Cabin 3/ })
      .click();
    taps++;
    step = "continue";
    await page.getByRole("button", { name: "Continue with 2 cabins" }).click();
    taps++;
    return { taps, ok: await toastShows(page, "Prototype stops here: 2 cabin(s)") };
  },
};

for (const [width, vp] of [
  ["laptop", { width: 1366, height: 900 }],
  ["phone", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  await page.goto("http://localhost:5174/admin/login");
  await page.getByLabel(/email/i).fill("staff@okaeri.test");
  await page
    .getByLabel(/password/i)
    .first()
    .fill("test-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin\/(?!login)/, { timeout: 15000 });
  for (const v of [1, 2, 3]) {
    for (const [task, run] of Object.entries(tasks)) {
      await page.goto(`${BASE}?v=${v}`);
      await page.locator("h1").first().waitFor({ timeout: 15000 });
      let r;
      step = "";
      try {
        r = await run(page, v);
      } catch (e) {
        r = { taps: "-", ok: false, note: `failed at "${step}": ${e.message.split("\n")[0]}` };
      }
      results.push({ width, v, task, ...r });
    }
  }
  await context.close();
}
await browser.close();
for (const r of results)
  console.log(
    [r.width, `V${r.v}`, r.task, `taps=${r.taps}`, r.ok ? "OK" : "FAIL", r.note ?? ""].join(" | ")
  );
