import { expect, test } from "@playwright/test";

const canonicalProduction = process.env.WEBSITE_BASE_URL && new URL(process.env.WEBSITE_BASE_URL).hostname === "monoskill.com";

test("generates safe commands without leaking pasted values to analytics", async ({ page, context, isMobile }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.locator(".skill-field span")).toHaveCount(47);
  await expect(page.locator(".skill-row")).toHaveCount(10);
  await expect(page.locator(".skill-paths")).toHaveCount(0);
  await expect(page.locator(".transfer-funnel")).toHaveCount(1);
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

  await page.getByRole("button", { name: /Corey Haines/ }).click();
  const expected = "npx --yes monoskill@0.3.2 add 'coreyhaines31/marketingskills' --name 'corey-marketing'";
  await expect(page.locator("#command-output")).toHaveText(expected);
  await expect(page.locator("#prompt-output")).toContainText("npx skills add statechange/monoskill --skill monoskill");
  await expect(page.locator("#prompt-output")).toContainText("--dry-run --json");
  expect(await page.evaluate(() => window.__events)).toEqual([]);
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
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "settled");
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.5).length)).toBe(47);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#source")).toBeInViewport();
  await expect(page.locator(".transfer-funnel")).toBeHidden();
});

test("uses one seekable timeline to synchronize transfer, water, and package fill", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__monoskillAnimation));
  expect(await page.evaluate(() => window.__monoskillAnimation.labels)).toEqual([
    "flooded",
    "transfer-01", "transfer-02", "transfer-03", "transfer-04", "transfer-05",
    "transfer-06", "transfer-07", "transfer-08", "transfer-09", "transfer-10",
    "packed", "settled", "reset"
  ]);

  const receipt = (pose) => `artifacts/story-${testInfo.project.name}-${pose}.png`;
  await page.evaluate(() => window.__monoskillAnimation.seek("flooded"));
  await page.locator(".convergence").screenshot({ path: receipt("flooded") });

  await page.evaluate(() => window.__monoskillAnimation.seek("transfer-06", 0.48));
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "transfer-06");
  await expect(page.locator(".package-count")).toHaveText("25 / 47 packed");
  expect(await page.locator(".skill-field span").evaluateAll((skills) => skills.filter((skill) => Number(getComputedStyle(skill).opacity) < 0.05).length)).toBe(25);
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.5).length)).toBe(25);
  await page.evaluate(() => window.__monoskillAnimation.seek("transfer-06", 0.72));
  await page.locator(".convergence").screenshot({ path: receipt("transfer") });

  await page.evaluate(() => window.__monoskillAnimation.seek("settled", 0.8));
  await expect(page.locator(".convergence")).toHaveAttribute("data-animation-step", "settled");
  await expect(page.locator(".package-count")).toHaveText("47 skills inside");
  expect(await page.locator(".package-contents i").evaluateAll((cells) => cells.filter((cell) => Number(getComputedStyle(cell).opacity) > 0.5).length)).toBe(47);
  await page.locator(".convergence").screenshot({ path: receipt("settled") });
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
  await page.evaluate(() => window.__monoskillAnimation.seek("flooded"));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-flooded.png" });
  await page.evaluate(() => window.__monoskillAnimation.seek("transfer-06", 0.72));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-transfer.png" });
  await page.evaluate(() => window.__monoskillAnimation.seek("settled", 0.8));
  await page.locator(".convergence").screenshot({ path: "artifacts/story-in-app-1003-settled.png" });
});
