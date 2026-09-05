import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:4174";
const browser = await chromium.launch({ headless: true });
const failures = [];
const observations = [];

for (const viewport of [
  { name: "desktop-dark", width: 1440, height: 900, theme: "dark" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
  { name: "desktop-light", width: 1440, height: 900, theme: "light" },
  { name: "mobile-light", width: 390, height: 844, theme: "light" },
]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: viewport.theme });
  const page = await context.newPage();
  const errors = [];
  const relayRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "relay.glyphq.org") relayRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).length);
  if (brokenImages) failures.push({ viewport: viewport.name, brokenImages });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  await mkdir(`artifacts/screenshots/${viewport.name}`, { recursive: true });
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/home.png`, fullPage: true });
  if (overflow || serious.length || errors.length) failures.push({ viewport: viewport.name, overflow, serious, errors });
  observations.push({ viewport: viewport.name, screen: "home", overflow, seriousAccessibilityIssues: serious.length, runtimeErrors: errors.length });

  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("dialog").evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true });
    await Promise.all(animations
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})));
  });
  const dialogResults = await new AxeBuilder({ page }).analyze();
  const dialogSerious = dialogResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  const dialogVisible = await page.getByRole("dialog").isVisible();
  if (new URL(baseUrl).protocol === "http:") {
    const dialog = page.getByRole("dialog");
    const glyphChoices = await dialog.getByRole("button", { name: /Glyph Wallet/ }).count();
    const extensionDisabled = await dialog.getByRole("button", { name: "Qubic Extension unavailable", exact: true }).isDisabled();
    const setupDetails = await dialog.getByText(/Setup required|Requires a public HTTPS|NEXT_PUBLIC|Install and enable/).count();
    observations.push({ viewport: viewport.name, screen: "minimal-connectors", glyphChoices, extensionDisabled, setupDetails, relayRequestCount: relayRequests.length });
    if (glyphChoices !== 0 || !extensionDisabled || setupDetails !== 0 || relayRequests.length !== 0) failures.push({ viewport: viewport.name, glyphChoices, extensionDisabled, setupDetails });
  }
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/connectors.png`, fullPage: true });
  if (!dialogVisible || dialogSerious.length) {
    failures.push({ viewport: `${viewport.name}-dialog`, dialogVisible, serious: dialogSerious });
  }
  observations.push({ viewport: viewport.name, screen: "connector-dialog", visible: dialogVisible, seriousAccessibilityIssues: dialogSerious.length });

  await page.keyboard.press("Escape");
  const dialogClosed = await page.getByRole("dialog").count() === 0;
  const focusRestored = await page.getByRole("button", { name: "Connect wallet", exact: true }).evaluate((element) => element === document.activeElement);
  observations.push({ viewport: viewport.name, check: "dialog-keyboard-dismiss", dialogClosed, focusRestored });
  if (!dialogClosed || !focusRestored) failures.push({ viewport: viewport.name, dialogClosed, focusRestored });
  await page.getByRole("navigation", { name: "Reference flows" }).getByRole("button", { name: /RandomLottery/ }).click();
  await page.getByRole("heading", { name: "RandomLottery" }).waitFor();
  const ticketPrice = page.getByText("Live ticket price");
  const buyButton = page.getByRole("button", { name: "Review ticket" });
  const contractResults = await new AxeBuilder({ page }).analyze();
  const contractSerious = contractResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/contract-call.png`, fullPage: true });
  observations.push({ viewport: viewport.name, screen: "RandomLottery", ticketPriceVisible: await ticketPrice.isVisible(), reviewDisabledWithoutGlyph: await buyButton.isDisabled(), seriousAccessibilityIssues: contractSerious.length });
  if (!(await ticketPrice.isVisible()) || !(await buyButton.isDisabled()) || contractSerious.length) {
    failures.push({
      viewport: `${viewport.name}-contract-call`,
      ticketPriceVisible: await ticketPrice.isVisible(),
      reviewDisabledWithoutGlyph: await buyButton.isDisabled(),
      serious: contractSerious,
    });
  }

  await page.getByRole("navigation", { name: "Reference flows" }).getByRole("button", { name: /Sign & Verify/ }).click();
  await page.getByRole("heading", { name: "Sign & Verify" }).waitFor();
  const walletRequired = await page.getByText("Wallet required", { exact: true }).isVisible();
  const signingControls = await page.getByRole("button", { name: /^(Sign message|Verify signature)$/ }).count();
  const signingResults = await new AxeBuilder({ page }).analyze();
  const signingSerious = signingResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  observations.push({ viewport: viewport.name, screen: "Sign & Verify", walletRequired, signingControls, seriousAccessibilityIssues: signingSerious.length });
  if (!walletRequired || signingControls !== 0 || signingSerious.length) {
    failures.push({ viewport: `${viewport.name}-signing-gate`, walletRequired, signingControls, serious: signingSerious });
  }
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/sign-verify.png`, fullPage: true });
  if (errors.length) failures.push({ viewport: `${viewport.name}-runtime`, errors });
  const targetTheme = viewport.theme === "dark" ? "light" : "dark";
  await page.getByRole("button", { name: `Switch to ${targetTheme} theme` }).click();
  await page.reload({ waitUntil: "networkidle" });
  const persistedTheme = await page.locator("html").getAttribute("data-theme");
  observations.push({ viewport: viewport.name, check: "theme-persistence", expected: targetTheme, actual: persistedTheme });
  if (persistedTheme !== targetTheme) failures.push({ viewport: viewport.name, persistedTheme });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ observations, failures }, null, 2));
if (failures.length) process.exit(1);
