import { expect, test } from "@playwright/test";

const canonicalProduction = process.env.WEBSITE_BASE_URL && new URL(process.env.WEBSITE_BASE_URL).hostname === "monoskill.com";

test("generates safe commands without leaking pasted values to analytics", async ({ page, context, isMobile }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("https://api.github.com/repos/**", async (route) => {
    const url = route.request().url();
    const isMatt = url.includes("/mattpocock/skills");
    if (url.includes("/git/trees/")) {
      const count = isMatt ? 41 : 47;
      await route.fulfill({ json: {
        truncated: false,
        tree: Array.from({ length: count }, (_, index) => ({ type: "blob", path: `skills/skill-${index}/SKILL.md` }))
      } });
      return;
    }
    await route.fulfill({ json: {
      default_branch: "main",
      full_name: isMatt ? "mattpocock/skills" : "coreyhaines31/marketingskills"
    } });
  });
  await page.goto("/");
  await expect(page.locator(".skill-field span")).toHaveCount(47);
  await expect(page.locator(".skill-row")).toHaveCount(10);
  await expect(page.locator(".skill-paths")).toHaveCount(0);
  await expect(page.locator(".pressure-pipe")).toHaveCount(1);
  await expect(page.locator(".package-contents i")).toHaveCount(47);
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.evaluate(() => {
    window.__events = [];
    window.addEventListener("monoskill:analytics", (event) => window.__events.push(event.detail));
    window.__beacons = [];
    const sendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, body) => {
      body.text().then((text) => window.__beacons.push({ url, payload: JSON.parse(text) }));
      return sendBeacon(url, body);
    };
  });

  await page.locator("#source").fill("javascript:alert(private-source)");
  await expect(page.locator("#source")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#source-message")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("button", { name: "Copy command" })).toBeDisabled();

  await expect(page.getByRole("button", { name: /Try Matt Pocock/ })).toBeVisible();
  await page.getByRole("button", { name: /Try Matt Pocock/ }).click();
  await expect(page.locator("#name")).toHaveValue("mattpocock");
  await expect(page.locator("#collection-summary")).toContainText("41 skills");

  await page.getByRole("button", { name: /Try Corey Haines/ }).click();
  await expect(page.locator("#name")).toHaveValue("coreyhaines31-marketing");
  await expect(page.locator("#collection-summary")).toContainText("47 skills");
  const expected = "npx --yes monoskill@0.4.0 add 'coreyhaines31/marketingskills' --name 'coreyhaines31-marketing'";
  await expect(page.locator("#command-output")).toHaveText(expected);
  await expect(page.locator("#prompt-output")).toContainText("npx skills add statechange/monoskill --skill monoskill");
  await expect(page.locator("#prompt-output")).toContainText("--dry-run --json");
  expect(await page.evaluate(() => window.__events)).toEqual([
    { event: "source_input_completed", source_type: "github-shorthand" }
  ]);
  await page.getByRole("button", { name: "Copy command" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await page.getByRole("button", { name: "Copied" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy command" })).toBeVisible({ timeout: 2500 });

  const events = await page.evaluate(() => window.__events);
  expect(events).toEqual([
    { event: "source_input_completed", source_type: "github-shorthand" },
    { event: "copy_cli" },
    { event: "copy_cli" }
  ]);
  expect(JSON.stringify(events)).not.toContain("coreyhaines31");
  if (canonicalProduction) {
    await expect.poll(() => page.evaluate(() => window.__beacons.length)).toBeGreaterThanOrEqual(2);
    const beacons = await page.evaluate(() => window.__beacons);
    expect(beacons.every(({ url }) => url === "https://plausible.io/api/event")).toBe(true);
    expect(beacons.every(({ payload }) => !JSON.stringify(payload).includes("coreyhaines31"))).toBe(true);
    expect(beacons.every(({ payload }) => payload.domain === "monoskill.com")).toBe(true);
  } else {
    expect(await page.evaluate(() => window.__beacons)).toEqual([]);
  }
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");

  await page.getByRole("radio", { name: /Global/ }).check();
  await expect(page.locator("#command-output")).toHaveText(`${expected} --agent codex --agent claude-code --global --yes`);
  await expect(page.locator("#prompt-output")).toContainText("--global --dry-run --json");

  await page.screenshot({
    path: `artifacts/${isMobile ? "mobile" : "desktop"}-${process.env.WEBSITE_RECEIPT_SUFFIX || "local-verified"}.png`,
    fullPage: false
  });
});

test("honors reduced motion and exposes a keyboard path", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "after");
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.5).length)).toBe(47);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#source")).toBeInViewport();
  await expect(page.locator(".pipe-fill")).toBeHidden();
});

test("uses one seekable timeline to synchronize transfer, water, and package fill", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__monoskillAnimation));
  const connection = await page.locator(".convergence").evaluate((scene) => {
    const rect = (selector) => scene.querySelector(selector).getBoundingClientRect();
    const tank = rect(".context-basin");
    const pipe = rect(".pressure-pipe");
    const packageRect = rect(".pressure-package");
    return {
      pipeWidth: pipe.width,
      tankEdgeDelta: Math.abs(tank.right - pipe.left),
      packageOverlap: pipe.right - packageRect.left,
      packageCenterDelta: Math.abs((packageRect.top + packageRect.bottom) / 2 - (pipe.top + pipe.bottom) / 2)
    };
  });
  expect(connection.pipeWidth).toBeGreaterThan(4);
  expect(connection.tankEdgeDelta).toBeLessThan(3);
  expect(connection.packageOverlap).toBeGreaterThan(20);
  expect(connection.packageCenterDelta).toBeLessThan(1);
  expect(await page.evaluate(() => window.__monoskillAnimation.labels)).toEqual(["before", "during", "after", "reset"]);

  const receipt = (pose) => `artifacts/story-${testInfo.project.name}-${pose}.png`;
  await page.evaluate(() => window.__monoskillAnimation.seek("before", 0.2));
  await page.locator(".convergence").screenshot({ path: receipt("before") });

  await page.evaluate(() => window.__monoskillAnimation.seek("during", 2));
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "during");
  expect(await page.locator(".skill-field span").evaluateAll((skills) => skills.filter((skill) => Number(getComputedStyle(skill).opacity) < 0.95).length)).toBeGreaterThan(0);
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.1).length)).toBeGreaterThan(0);
  await page.locator(".convergence").screenshot({ path: receipt("during") });

  await page.evaluate(() => window.__monoskillAnimation.seek("after", 0.55));
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "after");
  await expect(page.locator(".package-count")).toHaveText("47 skills inside");
  await expect(page.locator("[data-context-count]")).toHaveText("331");
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.5).length)).toBe(47);
  await page.locator(".convergence").screenshot({ path: receipt("after") });
});

test("stacks the hero at the in-app browser width", async ({ page }) => {
  await page.setViewportSize({ width: 1003, height: 1200 });
  await page.goto("/");
  await expect(page.locator(".skill-field span")).toHaveCount(47);
  await expect(page.locator(".skill-row")).toHaveCount(10);
  await expect(page.locator(".skill-paths")).toHaveCount(0);
  expect(await page.locator(".hero").evaluate((element) => getComputedStyle(element).display)).toBe("block");
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.waitForFunction(() => Boolean(window.__monoskillAnimation));
  await page.evaluate(() => window.__monoskillAnimation.seek("before", 0.2));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-before.png" });
  await page.evaluate(() => window.__monoskillAnimation.seek("during", 2));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-during.png" });
  await page.evaluate(() => window.__monoskillAnimation.seek("after", 0.55));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-after.png" });
});

test("shows three independent live hero treatments on one review page", async ({ page }) => {
  await page.goto("/directions.html?view=all");
  await page.waitForFunction(() => Object.keys(window.__directionAnimations || {}).length === 3);

  await expect(page.locator(".direction:visible")).toHaveCount(3);
  expect(await page.evaluate(() => Object.fromEntries(
    Object.entries(window.__directionAnimations).map(([name, animation]) => [name, animation.labels])
  ))).toEqual({
    pressure: ["flooded", "release-1", "release-2", "release-3", "release-4", "release-5", "release-6", "clear", "reset"],
    press: ["crowded", "bind", "bound", "reset"],
    gravity: ["orbit", "collapse", "light", "reset"]
  });
  await expect(page.locator("body")).toHaveCSS("overflow-x", "clip");
});

test("exposes deterministic completed frames for visual review", async ({ page }) => {
  await page.goto("/directions.html?view=pressure&frame=final");
  await expect(page.locator("body")).toHaveAttribute("data-frame", "final");
  await expect(page.locator(".pressure-meter b")).toHaveText("331");
  expect(await page.locator(".pressure-skills span").evaluateAll((items) => items.filter((item) => Number(getComputedStyle(item).opacity) < 0.05).length)).toBe(47);

  await page.goto("/directions.html?view=press&frame=final");
  await expect(page.locator("body")).toHaveAttribute("data-frame", "final");
  expect(await page.locator(".press-field span").evaluateAll((items) => items.filter((item) => Number(getComputedStyle(item).opacity) < 0.05).length)).toBe(47);
  await expect(page.locator(".press-rule span:last-child")).toHaveText("331");

  await page.goto("/directions.html?view=gravity&frame=final");
  await expect(page.locator("body")).toHaveAttribute("data-frame", "final");
  expect(await page.locator(".gravity-skills span").evaluateAll((items) => items.filter((item) => Number(getComputedStyle(item).opacity) < 0.05).length)).toBe(47);
  await expect(page.locator(".gravity-result")).toBeVisible();
});

test("shows nine narrated storyboard frames with a lossless small package", async ({ page }) => {
  await page.goto("/storyboards.html");
  await expect(page.locator(".story-row")).toHaveCount(3);
  await expect(page.locator(".story-frame")).toHaveCount(9);
  await expect(page.locator('[data-pose="before"]')).toHaveCount(3);
  await expect(page.locator('[data-pose="during"]')).toHaveCount(3);
  await expect(page.locator('[data-pose="after"]')).toHaveCount(3);
  await expect(page.getByText("32,817 chars", { exact: true })).toBeVisible();
  await expect(page.getByText("331 chars", { exact: true })).toBeVisible();
  await expect(page.getByText("Pack, don’t delete.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-cell-grid]").first().locator("span")).toHaveCount(47);

  for (const story of ["pressure", "press", "gravity"]) {
    const row = page.locator(`[data-story="${story}"]`);
    const packageSelector = story === "pressure" ? ".mono-token" : story === "press" ? ".mono-book" : ".mono-seed";
    const sizes = await row.locator(packageSelector).evaluateAll((items) => items.map((item) => {
      const rect = item.getBoundingClientRect();
      return [Math.round(rect.width), Math.round(rect.height)];
    }));
    expect(new Set(sizes.map((size) => size.join("x"))).size).toBe(1);
  }
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("runs three seekable narrated animatics without enlarging the package", async ({ page }) => {
  await page.goto("/animatics.html");
  await page.waitForFunction(() => Object.keys(window.__animatics || {}).length === 3 && Object.keys(window.__animaticControls || {}).length === 3);
  await expect(page.locator(".animatic")).toHaveCount(3);

  expect(await page.evaluate(() => Object.fromEntries(Object.entries(window.__animatics).map(([name, timeline]) => [name, Object.keys(timeline.labels)])))).toEqual({
    pressure: ["before", "during", "after"],
    press: ["before", "during", "after"],
    gravity: ["before", "during", "after"]
  });

  for (const name of ["pressure", "press", "gravity"]) {
    const section = page.locator(`[data-animatic="${name}"]`);
    await page.evaluate((animationName) => window.__animaticControls[animationName].seek("after"), name);
    await expect(section.locator("[data-title]")).toContainText(name === "gravity" ? "Small center" : name === "press" ? "page can breathe" : "pressure is gone");
    await expect(section.locator(".package-cells span")).toHaveCount(47);
  }
  await expect(page.locator('[data-animatic="pressure"] [data-count]')).toHaveText("331");

  const packageSizes = await page.locator(".mono-package, .mono-book, .mono-seed").evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect();
    return [Math.round(rect.width), Math.round(rect.height)];
  }));
  expect(packageSizes.every(([width, height]) => width <= 100 && height <= 110)).toBe(true);
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
