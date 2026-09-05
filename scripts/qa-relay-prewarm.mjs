// Synthetic HTTPS/relay fixture around the real production app and SDK.
// Native launches are counted and blocked. No wallet or live relay is contacted.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let registrations = 0;
  await page.route("https://starter.example/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await fetch(
      `${process.env.QA_BASE_URL ?? "http://127.0.0.1:4174"}${url.pathname}${url.search}`,
    );
    await route.fulfill({
      status: response.status,
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.route(/\/v2\/(register|result)\//, async (route) => {
    const registration = route.request().url().includes("/register/");
    if (registration) registrations++;
    await route.fulfill({
      status: registration ? 200 : 404,
      body: "{}",
      contentType: "application/json",
    });
  });
  await page.addInitScript(() => {
    window.qaLaunches = 0;
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.protocol === "glyph:") {
        window.qaLaunches++;
        return;
      }
      return original.call(this);
    };
  });
  await page.goto("https://starter.example/");
  assert.equal(registrations, 0, "No registration before chooser intent");
  const prepared = page.waitForResponse(
    (response) =>
      response.url().includes("/v2/register/") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await prepared;
  assert.equal(
    await page.evaluate(() => window.qaLaunches),
    0,
    "Preparation must not launch",
  );
  await page
    .getByRole("button", { name: "Connect Glyph Wallet", exact: true })
    .click();
  await page.waitForFunction(() => window.qaLaunches === 1);
  assert.equal(
    registrations,
    1,
    "Prepared session is reused by first provider click",
  );
  console.log(
    JSON.stringify({
      fixture: "synthetic HTTPS and relay, blocked native launch",
      backgroundRegistration: true,
      noAutomaticLaunch: true,
      oneProviderClickLaunches: true,
      registrations,
    }),
  );
} finally {
  await browser.close();
}
