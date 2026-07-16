import { expect, test } from "@playwright/test";

test("generates safe commands without leaking pasted values to analytics", async ({ page, context, isMobile }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.evaluate(() => {
    window.__events = [];
    window.addEventListener("monoskill:analytics", (event) => window.__events.push(event.detail));
  });

  await page.locator("#source").fill("javascript:alert(private-source)");
  await expect(page.locator("#source")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#source-message")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("button", { name: "Copy command" })).toBeDisabled();

  await page.getByRole("button", { name: /Corey Haines/ }).click();
  const expected = "npx monoskill build 'coreyhaines31/marketingskills' --name 'corey-marketing'";
  await expect(page.locator("#command-output")).toHaveText(expected);
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
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");

  await page.screenshot({
    path: `artifacts/${isMobile ? "mobile" : "desktop"}-verified.png`,
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
