import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto(process.env.QA_BASE_URL ?? "http://127.0.0.1:4174");
    const button = page.getByRole("button", {
      name: "Connect wallet",
      exact: true,
    });
    const resting = await button.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    assert.notEqual(resting, "none");
    await button.hover();
    const box = await button.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction((reduced) => {
      const el = document.querySelector(
        'header [data-slot="button"][data-variant="outline"]',
      );
      const style = getComputedStyle(el);
      return reduced
        ? style.scale === "none" && style.translate === "none"
        : style.scale === "0.96";
    }, reducedMotion === "reduce");
    const pressed = await button.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    assert.notEqual(pressed, resting);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await button.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await button.evaluate((el) => el.matches(":focus-visible")),
      true,
    );
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    const disabled = page.getByRole("dialog").getByRole("button", {
      name: "Qubic Extension unavailable",
      exact: true,
    });
    assert.equal(await disabled.isDisabled(), true);
    assert.equal(
      await disabled.evaluate((el) => getComputedStyle(el).boxShadow),
      "none",
    );
    console.log(
      JSON.stringify({
        reducedMotion,
        raisedAtRest: true,
        pressedFeedback: true,
        keyboardFocusAndActivation: true,
        disabledNotRaised: true,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
