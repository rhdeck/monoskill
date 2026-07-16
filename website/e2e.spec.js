import { expect, test } from "@playwright/test";

const canonicalProduction = process.env.WEBSITE_BASE_URL && new URL(process.env.WEBSITE_BASE_URL).hostname === "monoskill.statechange.ai";

test("generates safe commands without leaking pasted values to analytics", async ({ page, context, isMobile }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
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
  const expected = "npx --yes github:rhdeck/monoskill#82fff64 add 'coreyhaines31/marketingskills' --name 'corey-marketing'";
  await expect(page.locator("#command-output")).toHaveText(expected);
  await expect(page.locator("#prompt-output")).toContainText("npx skills add rhdeck/monoskill --skill monoskill");
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
    expect(beacons.every(({ payload }) => payload.domain === "monoskill.statechange.ai")).toBe(true);
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
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#source")).toBeInViewport();
  const duration = await page.locator(".fragments span").first().evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(0.001);
});
