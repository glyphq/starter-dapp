import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:4174";
const browser = await chromium.launch({ headless: true });
const failures = [];
const observations = [];

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const relayRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "relay.glyphq.org") relayRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
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
    const originGuidance = await page.getByText("Glyph requires a public HTTPS origin.", { exact: false }).isVisible();
    const glyphChoices = await page.getByRole("button", { name: /Glyph Wallet/ }).count();
    observations.push({ viewport: viewport.name, screen: "local-connector-choice", originGuidance, glyphChoices, relayRequestCount: relayRequests.length });
    if (!originGuidance || glyphChoices !== 0 || relayRequests.length !== 0) {
      failures.push({ viewport: `${viewport.name}-local-origin`, originGuidance, glyphChoices, relayRequestCount: relayRequests.length });
    }
  }
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/connectors.png`, fullPage: true });
  if (!dialogVisible || dialogSerious.length) {
    failures.push({ viewport: `${viewport.name}-dialog`, dialogVisible, serious: dialogSerious });
  }
  observations.push({ viewport: viewport.name, screen: "connector-dialog", visible: dialogVisible, seriousAccessibilityIssues: dialogSerious.length });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "RandomLottery" }).click();
  await page.getByRole("heading", { name: "RandomLottery" }).waitFor();
  const ticketPrice = page.getByText("Live ticket price");
  const buyButton = page.getByRole("button", { name: "Buy ticket" });
  const contractResults = await new AxeBuilder({ page }).analyze();
  const contractSerious = contractResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/contract-call.png`, fullPage: true });
  observations.push({ viewport: viewport.name, screen: "RandomLottery", ticketPriceVisible: await ticketPrice.isVisible(), buyDisabledWithoutGlyph: await buyButton.isDisabled(), seriousAccessibilityIssues: contractSerious.length });
  if (!(await ticketPrice.isVisible()) || !(await buyButton.isDisabled()) || contractSerious.length) {
    failures.push({
      viewport: `${viewport.name}-contract-call`,
      ticketPriceVisible: await ticketPrice.isVisible(),
      buyDisabledWithoutGlyph: await buyButton.isDisabled(),
      serious: contractSerious,
    });
  }

  await page.getByRole("button", { name: "Sign & Verify" }).click();
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
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ observations, failures }, null, 2));
if (failures.length) process.exit(1);
