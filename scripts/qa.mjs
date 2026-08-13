import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:4174";
const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  await mkdir(`artifacts/screenshots/${viewport.name}`, { recursive: true });
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/home.png`, fullPage: true });
  if (overflow || serious.length || errors.length) failures.push({ viewport: viewport.name, overflow, serious, errors });

  await page.getByRole("button", { name: "Connect wallet" }).click();
  const dialogResults = await new AxeBuilder({ page }).analyze();
  const dialogSerious = dialogResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  const dialogVisible = await page.getByRole("dialog").isVisible();
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/connectors.png`, fullPage: true });
  if (!dialogVisible || dialogSerious.length) {
    failures.push({ viewport: `${viewport.name}-dialog`, dialogVisible, serious: dialogSerious });
  }

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Buy ticket" }).click();
  await page.getByRole("heading", { name: "Buy ticket" }).waitFor();
  const ticketCount = page.getByRole("textbox", { name: "Tickets" });
  const approvalButton = page.getByRole("button", { name: "Request Glyph approval" });
  const contractResults = await new AxeBuilder({ page }).analyze();
  const contractSerious = contractResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/contract-call.png`, fullPage: true });
  if (!(await ticketCount.isVisible()) || !(await approvalButton.isDisabled()) || contractSerious.length) {
    failures.push({
      viewport: `${viewport.name}-contract-call`,
      ticketInputVisible: await ticketCount.isVisible(),
      approvalDisabledWithoutGlyph: await approvalButton.isDisabled(),
      serious: contractSerious,
    });
  }

  await page.getByRole("button", { name: "Sign & Verify" }).click();
  await page.getByRole("heading", { name: "Sign & Verify" }).waitFor();
  await page.screenshot({ path: `artifacts/screenshots/${viewport.name}/sign-verify.png`, fullPage: true });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ failures }, null, 2));
if (failures.length) process.exit(1);
