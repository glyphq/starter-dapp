// Synthetic extension fixture, real built app and installed WalletProvider.
// This regression check does not replace approval in a real wallet.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/balances/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balance: {
          id: "A".repeat(60),
          balance: "1234567890123456789",
          validForTick: 12345,
        },
      }),
    }),
  );
  await page.addInitScript(() => {
    let attempts = 0;
    let account = null;
    window.qubic = {
      isQubic: true,
      async connect() {
        if (++attempts === 1) throw new Error("Fixture rejected connection");
        account = {
          identity: "A".repeat(60),
          name: "QA public identity fixture",
        };
      },
      async getAccount() {
        return account;
      },
      async disconnect() {
        account = null;
      },
      on() {
        return () => {};
      },
    };
  });
  await page.goto(process.env.QA_BASE_URL ?? "http://127.0.0.1:4174");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  const connect = page.getByRole("button", { name: /Connect Qubic/ });
  await connect.click();
  await page
    .getByText(
      "Connection was not completed. Check your wallet, then try again.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(
    await page.getByRole("button", { name: "Open account details" }).count(),
    0,
  );
  await connect.click();
  await page.getByRole("button", { name: "Open account details" }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Open account details" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Account details" }).waitFor();
  await dialog
    .getByText("1,234,567,890,123,456,789 QU", { exact: true })
    .waitFor();
  assert.equal(
    await dialog.getByText("A".repeat(60), { exact: true }).count(),
    1,
  );
  assert.equal(await dialog.locator(".identity-avatar svg").count(), 1);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog
    .getByRole("button", { name: "Copy identity", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "A".repeat(60),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  assert.equal(
    accessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact),
    ).length,
    0,
  );
  assert.equal(
    await dialog.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "artifacts/screenshots/account-dialog-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Open account details",
  );
  await page.getByRole("button", { name: "Open account details" }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("glyph-starter-connector")),
    null,
  );
  console.log(
    JSON.stringify({
      fixture: "synthetic extension through real WalletProvider",
      rejectionKeepsChooserOpen: true,
      retryConnects: true,
      disconnectClearsSession: true,
      accountModalIdentityAvatarAndExactBalance: true,
      escapeRestoresFocus: true,
    }),
  );
} finally {
  await browser.close();
}
