import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.QA_BASE_URL ?? "http://127.0.0.1:4174", {
      waitUntil: "networkidle",
    });
    const hero = page.locator(".starter-hero");
    assert.equal(
      await hero.getByRole("heading", { name: "Build with Qubic." }).count(),
      1,
    );
    assert.equal(
      await page.locator(".workspace-header[data-scrolled='true']").count(),
      0,
    );
    assert.equal(await page.locator(".workspace-footer").count(), 0);
    assert.equal(
      await hero.evaluate(
        (element) =>
          Math.round(element.getBoundingClientRect().height) ===
          window.innerHeight,
      ),
      true,
    );
    if (reducedMotion === "no-preference") {
      assert.equal(await hero.locator("canvas").count(), 1);
      assert.equal(
        await hero
          .locator("canvas")
          .evaluate(
            (canvas) =>
              Math.round(canvas.getBoundingClientRect().width) ===
              Math.round(
                canvas.closest(".starter-hero")?.getBoundingClientRect()
                  .width ?? 0,
              ),
          ),
        true,
      );
    } else {
      await page.waitForFunction(
        () => document.querySelector(".starter-hero-plasma canvas") === null,
      );
      assert.equal(await hero.locator("canvas").count(), 0);
    }
    const header = page.locator(".workspace-header");
    const inner = page.locator(".workspace-header-inner");
    assert.equal(
      await inner.evaluate((el) => getComputedStyle(el).minHeight),
      "72px",
    );
    assert.equal(await header.getAttribute("data-scrolled"), null);
    assert.equal(errors.length, 0);
    console.log(
      JSON.stringify({
        reducedMotion,
        heroTitle: true,
        plasma: await hero.locator("canvas").count(),
        fullViewportHero: true,
        footerRemoved: true,
        restingHeader: true,
        runtimeErrors: 0,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
