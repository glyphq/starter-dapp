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
    .getByRole("button", { name: /^(Sign & Verify|QEarn|QUtil)$/ })
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
  await page.getByRole("button", { name: "QEarn", exact: true }).click();
  const qearnScreen = page
    .locator(".task-dialog")
    .locator(".contract-examples-screen");
  await qearnScreen
    .getByRole("heading", { name: "QEarn", exact: true })
    .waitFor();
  const qearnContractSelector = qearnScreen.locator(
    "#starter-contract-selector",
  );
  const qearnActionSelector = qearnScreen.locator(
    "#starter-contract-action-selector",
  );
  const contractOptions = await qearnContractSelector.evaluate(
    (element) => element.options.length,
  );
  const qearnActionOptions = await qearnActionSelector.evaluate(
    (element) => element.options.length,
  );
  const runQearnStats = qearnScreen.getByRole("button", {
    name: "Run Protocol stats",
    exact: true,
  });
  const qearnStatsVisible = await runQearnStats.isVisible();
  const qearnWalletActions = await qearnScreen
    .getByRole("button", { name: "Connect wallet", exact: true })
    .count();
  const taskDialogBox = await page.locator(".task-dialog").boundingBox();
  const qearnScreenBox = await qearnScreen.boundingBox();
  const qearnContractBox = await qearnContractSelector.boundingBox();
  const qearnActionBox = await qearnActionSelector.boundingBox();
  const selectorsFullWidth =
    qearnScreenBox !== null &&
    qearnContractBox !== null &&
    qearnActionBox !== null &&
    Math.abs(qearnContractBox.width - qearnScreenBox.width) < 4 &&
    Math.abs(qearnActionBox.width - qearnScreenBox.width) < 4;
  const qearnResults = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  const qearnSerious = qearnResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/qearn.png`,
    fullPage: true,
  });
  await qearnActionSelector.selectOption("qearn-lock");
  const qearnProcedureConnect = await qearnScreen
    .getByRole("button", { name: "Connect wallet", exact: true })
    .count();
  const qearnProcedureInputs = await qearnScreen.locator("input").count();
  observations.push({
    viewport: viewport.name,
    screen: "qearn",
    contractOptions,
    actionOptions: qearnActionOptions,
    runQueryVisible: qearnStatsVisible,
    walletActions: qearnWalletActions,
    procedureConnect: qearnProcedureConnect,
    procedureInputs: qearnProcedureInputs,
    selectorsFullWidth,
    modalWidth: taskDialogBox?.width ?? 0,
    seriousAccessibilityIssues: qearnSerious.length,
  });
  if (
    contractOptions !== 2 ||
    qearnActionOptions !== 2 ||
    !qearnStatsVisible ||
    qearnWalletActions !== 0 ||
    qearnProcedureConnect !== 1 ||
    qearnProcedureInputs !== 0 ||
    !selectorsFullWidth ||
    (taskDialogBox && taskDialogBox.width > 480) ||
    qearnSerious.length
  ) {
    failures.push({
      viewport: `${viewport.name}-qearn`,
      contractOptions,
      qearnActionOptions,
      runQueryVisible: qearnStatsVisible,
      walletActions: qearnWalletActions,
      qearnProcedureConnect,
      qearnProcedureInputs,
      selectorsFullWidth,
      modalWidth: taskDialogBox?.width ?? 0,
      serious: qearnSerious,
    });
  }

  await page.keyboard.press("Escape");
  await page.locator(".task-dialog").waitFor({ state: "detached" });
  const qearnButton = page.getByRole("button", {
    name: "QEarn",
    exact: true,
  });
  await page.waitForFunction(
    (button) => button === document.activeElement,
    await qearnButton.elementHandle(),
  );
  const qearnFocusRestored = await page
    .getByRole("button", { name: "QEarn", exact: true })
    .evaluate((element) => element === document.activeElement);
  if (!qearnFocusRestored)
    failures.push({
      viewport: `${viewport.name}-qearn-focus`,
      qearnFocusRestored,
    });
  await page.getByRole("button", { name: "QUtil", exact: true }).click();
  const qutilScreen = page
    .locator(".task-dialog")
    .locator(".contract-examples-screen");
  await qutilScreen
    .getByRole("heading", { name: "QUtil", exact: true })
    .waitFor();
  const qutilActionSelector = qutilScreen.locator(
    "#starter-contract-action-selector",
  );
  const qutilActionOptions = await qutilActionSelector.evaluate(
    (element) => element.options.length,
  );
  const runQutilFees = qutilScreen.getByRole("button", {
    name: "Run Protocol fees",
    exact: true,
  });
  const qutilFeesVisible = await runQutilFees.isVisible();
  await qutilActionSelector.selectOption("q-util-vote");
  const qutilProcedureConnect = await qutilScreen
    .getByRole("button", { name: "Connect wallet", exact: true })
    .count();
  const qutilProcedureInputs = await qutilScreen.locator("input").count();
  observations.push({
    viewport: viewport.name,
    screen: "q-util",
    actionOptions: qutilActionOptions,
    runQueryVisible: qutilFeesVisible,
    procedureConnect: qutilProcedureConnect,
    procedureInputs: qutilProcedureInputs,
  });
  if (
    qutilActionOptions !== 2 ||
    !qutilFeesVisible ||
    qutilProcedureConnect !== 1 ||
    qutilProcedureInputs !== 0
  ) {
    failures.push({
      viewport: `${viewport.name}-q-util`,
      qutilActionOptions,
      runQueryVisible: qutilFeesVisible,
      qutilProcedureConnect,
      qutilProcedureInputs,
    });
  }
  await page.screenshot({
    path: `artifacts/screenshots/${viewport.name}/q-util.png`,
    fullPage: true,
  });
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
