// Synthetic extension fixture, real built app and installed WalletProvider.
// This regression check does not replace approval in a real wallet.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
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
    await page
      .getByRole("button", { name: "Open connected identity menu" })
      .count(),
    0,
  );
  await connect.click();
  await page
    .getByRole("button", { name: "Open connected identity menu" })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByRole("button", { name: "Open connected identity menu" })
    .click();
  await page.getByRole("menuitem", { name: "Disconnect", exact: true }).click();
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
    }),
  );
} finally {
  await browser.close();
}
