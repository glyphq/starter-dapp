// Synthetic extension fixture, real built app and installed WalletProvider.
// This regression check does not replace approval in a real wallet.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const identity =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AFXIB".replace(
    " ",
    "",
  );

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
          id: identity,
          balance: "1234567890123456789",
          validForTick: 12345,
        },
      }),
    }),
  );
  await page.addInitScript((fixtureIdentity) => {
    let attempts = 0;
    let account = null;
    const contractRequests = [];
    window.__qaContractRequests = contractRequests;
    window.qubic = {
      isQubic: true,
      async connect() {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        if (++attempts === 1) throw new Error("Fixture rejected connection");
        account = {
          identity: fixtureIdentity,
          name: "QA public identity fixture",
        };
      },
      async signMessage() {
        return { signatureHex: "ab".repeat(64) };
      },
      async getAccount() {
        return account;
      },
      async disconnect() {
        account = null;
      },
      async sendTransaction(request) {
        contractRequests.push(request);
        return {
          txId: "fixture-transaction",
          targetTick: 12350,
          txBytesBase64: "",
          txBytesHex: "",
          networkTxId: "fixture-network-transaction",
          broadcast: {},
        };
      },
      on() {
        return () => {};
      },
    };
  }, identity);
  await page.goto(process.env.QA_BASE_URL ?? "http://127.0.0.1:4174");
  await page
    .getByRole("button", { name: "Sign & Verify", exact: true })
    .click();
  const taskDialog = page.locator(".task-dialog");
  await taskDialog
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  const walletDialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Connect a wallet" }) });
  const connect = walletDialog.getByRole("button", { name: /Connect Qubic/ });
  await connect.click();
  await connect.locator(".provider-action .spinner").waitFor();
  assert.equal(await walletDialog.locator(".spinner").count(), 1);
  const rowBox = await connect.boundingBox();
  const spinnerBox = await connect.locator(".spinner").boundingBox();
  assert.ok(
    rowBox &&
      spinnerBox &&
      spinnerBox.y >= rowBox.y &&
      spinnerBox.y + spinnerBox.height <= rowBox.y + rowBox.height,
  );

  await page.waitForTimeout(1_600);
  assert.equal(await walletDialog.count(), 1);
  await page.getByText("Request not completed", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Open account details" }).count(),
    0,
  );
  await connect.click();
  await walletDialog.waitFor({ state: "detached" });
  assert.equal(await walletDialog.count(), 0);
  await page.getByText("Wallet connected.", { exact: true }).waitFor();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Wallet connected." })
    .locator(".identity-avatar svg")
    .waitFor();
  assert.equal(await page.locator(".session-feedback").count(), 0);
  assert.equal(
    await page
      .getByText("Your keys remain in your wallet.", { exact: true })
      .count(),
    0,
  );
  const messageDraft = taskDialog.locator(
    ".signatures-screen #signature-message",
  );
  await messageDraft.waitFor({ state: "attached" });
  await messageDraft.fill("Starter round-trip fixture");
  await page.screenshot({
    path: "artifacts/screenshots/sign-connected.png",
    fullPage: true,
  });
  await taskDialog
    .getByRole("button", { name: "Sign message", exact: true })
    .click();
  await page.getByText("Signature ready.", { exact: true }).waitFor();
  await taskDialog
    .getByRole("button", { name: "Verify this signature", exact: true })
    .click();
  assert.equal(
    await taskDialog.getByLabel("Signature", { exact: true }).inputValue(),
    "ab".repeat(64),
  );

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Lock QUs", exact: true }).click();
  const lockDialog = page.locator(".task-dialog");
  await lockDialog.locator("#lock-qus-amount").fill("1000000");
  await lockDialog
    .getByRole("button", { name: "Lock QUs", exact: true })
    .click();
  assert.equal(
    await lockDialog
      .getByText("Lock request approved.", { exact: true })
      .count(),
    0,
  );
  await page.getByText("Lock request approved.", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send QUs", exact: true }).click();
  const transferDialog = page.locator(".task-dialog");
  await transferDialog
    .locator("#send-qu-recipient")
    .fill("FXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAYKSC");
  await transferDialog.locator("#send-qu-amount").fill("42");
  await page.setViewportSize({ width: 390, height: 844 });
  const transferAccessibility = await new AxeBuilder({ page })
    .include(".task-dialog")
    .analyze();
  assert.equal(
    transferAccessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact),
    ).length,
    0,
  );
  assert.equal(
    await transferDialog.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "artifacts/screenshots/send-qu-connected-mobile.png",
    fullPage: true,
  });
  await transferDialog
    .getByRole("button", { name: "Send QUs", exact: true })
    .click();
  assert.equal(
    await transferDialog
      .getByText("Transfer request approved.", { exact: true })
      .count(),
    0,
  );
  await page.getByText("Transfer request approved.", { exact: true }).waitFor();
  const contractRequests = await page.evaluate(
    () => window.__qaContractRequests,
  );
  assert.deepEqual(contractRequests, [
    {
      amount: "1000000",
      destination:
        "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
      from: identity,
      inputType: 1,
    },
    {
      amount: "42",
      destination:
        "FXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAYKSC",
      from: identity,
    },
  ]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open account details" }).waitFor();
  await page.getByRole("button", { name: "Open account details" }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Account details" }) });
  await dialog.getByRole("heading", { name: "Account details" }).waitFor();
  await dialog
    .getByText("1,234,567,890,123,456,789 QU", { exact: true })
    .waitFor();
  assert.equal(await dialog.getByText(/As of tick/).count(), 0);
  assert.equal(
    await dialog
      .getByRole("button", { name: "Refresh balance", exact: true })
      .locator("svg")
      .count(),
    1,
  );
  assert.equal(await dialog.getByText(identity, { exact: true }).count(), 1);
  assert.equal(await dialog.locator(".identity-avatar svg").count(), 1);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog
    .getByRole("button", { name: "Copy identity", exact: true })
    .click();
  await page.getByText("Identity copied.", { exact: true }).waitFor();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Identity copied." })
    .locator(".identity-avatar svg")
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Copy identity", exact: true })
      .locator("svg")
      .count(),
    1,
  );
  assert.equal(
    await dialog
      .getByRole("button", { name: "Disconnect", exact: true })
      .locator("svg")
      .count(),
    1,
  );
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    identity,
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
      connectShowsSigningForm: true,
      extensionRequestsIncludeActiveSender: true,
      lockAndDirectTransferRequestsUseReviewedInputs: true,
      disconnectClearsSession: true,
      accountModalCompactBalanceAndIdentityActions: true,
      escapeRestoresFocus: true,
      spinnerInsideSelectedProvider: true,
      noConnectionSuccessBanner: true,
      transientFeedbackUsesToasts: true,
      walletToastsHaveIdentityAvatars: true,
      noRedundantKeyCustodyCopy: true,
    }),
  );
} finally {
  await browser.close();
}
