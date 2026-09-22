import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/questions", "/login"]) {
      await page.goto("http://localhost:3037" + route);
      await page.locator(".studio-header").waitFor();
      const result = await page.evaluate(() => {
        const header = document.querySelector(".studio-header");
        const body = document.querySelector(".main-wrap,.landing-body");
        const filler = document.createElement("div");
        filler.style.height = "1800px";
        filler.style.flexShrink = "0";
        body.append(filler);
        const before = header.getBoundingClientRect().top;
        body.scrollTop = 400;
        return {
          before,
          after: header.getBoundingClientRect().top,
          scroll: body.scrollTop,
          windowScroll: scrollY,
          overflow: getComputedStyle(document.body).overflow,
          thin: getComputedStyle(body).scrollbarWidth,
          width: document.documentElement.scrollWidth,
        };
      });
      assert.equal(result.before, result.after);
      assert(result.scroll > 0);
      assert.equal(result.windowScroll, 0);
      assert.equal(result.overflow, "hidden");
      assert.equal(result.thin, "thin");
      assert(result.width <= width);
      console.log(width, route, result);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
