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
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: viewport.theme,
  });
  const page = await context.newPage();
  const errors = [];
  const relayRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "relay.glyphq.org")
      relayRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const brokenImages = await page
    .locator("img")
    .evaluateAll(
      (images) =>
        images.filter((image) => !image.complete || image.naturalWidth === 0)
          .length,
    );
  if (brokenImages) failures.push({ viewport: viewport.name, brokenImages });
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await mkdir(`artifacts/screenshots/${viewport.name}`, { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/home.png`,
    fullPage: true,
  });
  if (overflow || serious.length || errors.length)
    failures.push({ viewport: viewport.name, overflow, serious, errors });
  observations.push({
    viewport: viewport.name,
    screen: "home",
    overflow,
    seriousAccessibilityIssues: serious.length,
    runtimeErrors: errors.length,
  });

  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("dialog").evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true });
    await Promise.all(
      animations
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const dialogResults = await new AxeBuilder({ page }).analyze();
  const dialogSerious = dialogResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  const dialogVisible = await page.getByRole("dialog").isVisible();
  if (new URL(baseUrl).protocol === "http:") {
    const dialog = page.getByRole("dialog");
    const glyphChoices = await dialog
      .getByRole("button", { name: /Glyph Wallet/ })
      .count();
    const extensionDisabled = await dialog
      .getByRole("button", { name: "Qubic Extension unavailable", exact: true })
      .isDisabled();
    const setupDetails = await dialog
      .getByText(
        /Setup required|Requires a public HTTPS|NEXT_PUBLIC|Install and enable/,
      )
      .count();
    observations.push({
      viewport: viewport.name,
      screen: "minimal-connectors",
      glyphChoices,
      extensionDisabled,
      setupDetails,
      relayRequestCount: relayRequests.length,
    });
    if (
      glyphChoices !== 0 ||
      !extensionDisabled ||
      setupDetails !== 0 ||
      relayRequests.length !== 0
    )
      failures.push({
        viewport: viewport.name,
        glyphChoices,
        extensionDisabled,
        setupDetails,
      });
  }
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/connectors.png`,
    fullPage: true,
  });
  if (!dialogVisible || dialogSerious.length) {
    failures.push({
      viewport: `${viewport.name}-dialog`,
      dialogVisible,
      serious: dialogSerious,
    });
  }
  observations.push({
    viewport: viewport.name,
    screen: "connector-dialog",
    visible: dialogVisible,
    seriousAccessibilityIssues: dialogSerious.length,
  });

  await page.keyboard.press("Escape");
  const dialogClosed = (await page.getByRole("dialog").count()) === 0;
  const focusRestored = await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .evaluate((element) => element === document.activeElement);
  observations.push({
    viewport: viewport.name,
    check: "dialog-keyboard-dismiss",
    dialogClosed,
    focusRestored,
  });
  if (!dialogClosed || !focusRestored)
    failures.push({ viewport: viewport.name, dialogClosed, focusRestored });
  const taskButtons = await page
    .getByRole("button", { name: /^(Sign & Verify|Lock QUs|Send QUs)$/ })
    .count();
  const heroFullBleed = await page
    .locator(".starter-hero")
    .evaluate(
      (element) =>
        Math.round(element.getBoundingClientRect().width) ===
          window.innerWidth && element.getBoundingClientRect().top <= 0,
    );
  observations.push({
    viewport: viewport.name,
    screen: "hero-actions",
    taskButtons,
    heroFullBleed,
  });
  if (taskButtons !== 3 || !heroFullBleed)
    failures.push({
      viewport: `${viewport.name}-hero-actions`,
      taskButtons,
      heroFullBleed,
    });

  await page.getByRole("button", { name: "Lock QUs", exact: true }).click();
  const lockScreen = page.locator(".task-dialog .procedure-screen");
  await lockScreen
    .getByRole("heading", { name: "Lock QUs", exact: true })
    .waitFor();
  const lockDialogBox = await page.locator(".task-dialog").boundingBox();
  const lockConnect = await lockScreen
    .getByRole("button", { name: "Connect wallet", exact: true })
    .count();
  const lockInputs = await lockScreen.locator("input").count();
  const lockSelectors = await lockScreen.locator("select").count();
  const lockResults = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  const lockSerious = lockResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/lock-qus.png`,
    fullPage: true,
  });
  observations.push({
    viewport: viewport.name,
    screen: "Lock QUs",
    connectActions: lockConnect,
    formInputs: lockInputs,
    selectors: lockSelectors,
    modalWidth: lockDialogBox?.width ?? 0,
    seriousAccessibilityIssues: lockSerious.length,
  });
  if (
    lockConnect !== 1 ||
    lockInputs !== 0 ||
    lockSelectors !== 0 ||
    (lockDialogBox && lockDialogBox.width > 480) ||
    lockSerious.length
  ) {
    failures.push({
      viewport: `${viewport.name}-lock-qus`,
      lockConnect,
      lockInputs,
      lockSelectors,
      modalWidth: lockDialogBox?.width ?? 0,
      serious: lockSerious,
    });
  }

  await page.keyboard.press("Escape");
  await page.locator(".task-dialog").waitFor({ state: "detached" });
  const lockButton = page.getByRole("button", {
    name: "Lock QUs",
    exact: true,
  });
  await page.waitForFunction(
    (button) => button === document.activeElement,
    await lockButton.elementHandle(),
  );
  const lockFocusRestored = await lockButton.evaluate(
    (element) => element === document.activeElement,
  );
  if (!lockFocusRestored)
    failures.push({
      viewport: `${viewport.name}-lock-qus-focus`,
      lockFocusRestored,
    });

  await page.getByRole("button", { name: "Send QUs", exact: true }).click();
  const transferScreen = page.locator(".task-dialog .procedure-screen");
  await transferScreen
    .getByRole("heading", { name: "Send QUs", exact: true })
    .waitFor();
  const transferDialogBox = await page.locator(".task-dialog").boundingBox();
  const transferConnect = await transferScreen
    .getByRole("button", { name: "Connect wallet", exact: true })
    .count();
  const transferInputs = await transferScreen.locator("input").count();
  const transferSelectors = await transferScreen.locator("select").count();
  const transferResults = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  const transferSerious = transferResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/send-qu.png`,
    fullPage: true,
  });
  observations.push({
    viewport: viewport.name,
    screen: "Send QUs",
    connectActions: transferConnect,
    formInputs: transferInputs,
    selectors: transferSelectors,
    modalWidth: transferDialogBox?.width ?? 0,
    seriousAccessibilityIssues: transferSerious.length,
  });
  if (
    transferConnect !== 1 ||
    transferInputs !== 0 ||
    transferSelectors !== 0 ||
    (transferDialogBox && transferDialogBox.width > 480) ||
    transferSerious.length
  ) {
    failures.push({
      viewport: `${viewport.name}-send-qu`,
      transferConnect,
      transferInputs,
      transferSelectors,
      modalWidth: transferDialogBox?.width ?? 0,
      serious: transferSerious,
    });
  }
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Sign & Verify", exact: true })
    .click();
  const signaturesDialog = page.locator(".task-dialog");
  await signaturesDialog
    .getByRole("heading", { name: "Sign & Verify", exact: true })
    .waitFor();
  const walletRequired = await signaturesDialog
    .getByRole("button", { name: "Connect wallet", exact: true })
    .isVisible();
  const messageInputs = await signaturesDialog
    .getByLabel("Message", { exact: true })
    .count();
  const signingControls = await signaturesDialog
    .getByRole("button", { name: /^(Sign message|Verify signature)$/ })
    .count();
  const disconnectedActions = await signaturesDialog
    .locator(".task-action-stack")
    .getByRole("button")
    .count();
  const signingResults = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  const signingSerious = signingResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  observations.push({
    viewport: viewport.name,
    screen: "Sign & Verify",
    walletRequired,
    messageInputs,
    signingControls,
    disconnectedActions,
    seriousAccessibilityIssues: signingSerious.length,
  });
  if (
    !walletRequired ||
    messageInputs !== 0 ||
    signingControls !== 0 ||
    disconnectedActions !== 1 ||
    signingSerious.length
  ) {
    failures.push({
      viewport: `${viewport.name}-signing-gate`,
      walletRequired,
      messageInputs,
      signingControls,
      disconnectedActions,
      serious: signingSerious,
    });
  }
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/sign-verify.png`,
    fullPage: true,
  });
  if (errors.length)
    failures.push({ viewport: `${viewport.name}-runtime`, errors });
  await page.keyboard.press("Escape");
  const targetTheme = viewport.theme === "dark" ? "light" : "dark";
  await page
    .getByRole("button", { name: `Switch to ${targetTheme} theme` })
    .click();
  await page.reload({ waitUntil: "networkidle" });
  const persistedTheme = await page.locator("html").getAttribute("data-theme");
  observations.push({
    viewport: viewport.name,
    check: "theme-persistence",
    expected: targetTheme,
    actual: persistedTheme,
  });
  if (persistedTheme !== targetTheme)
    failures.push({ viewport: viewport.name, persistedTheme });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ observations, failures }, null, 2));
if (failures.length) process.exit(1);
