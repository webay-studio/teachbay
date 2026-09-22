import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
const base = process.env.BASE_URL || "http://localhost:3037";
try {
  await page.goto(base + "/questions");
  const open = async () => {
    await page
      .getByRole("link", { name: "문제 등록", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(base + "/questions/new");
  };
  await open();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(base + "/questions/new");
  assert.equal(await page.locator(".studio-header").count(), 1);
  await page.getByRole("button", { name: "문제 등록 닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(base + "/questions");
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".registration-page")).toBeVisible();
  await page.goto(base + "/questions");
  await open();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 180;
    const x = c.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 600, 180);
    x.fillStyle = "black";
    x.font = "24px sans-serif";
    x.fillText("1. 2 + 3 = ?", 24, 65);
    return c.toDataURL().split(",")[1];
  });
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "route-modal-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(
    page.getByRole("button", { name: "문제 1개 저장" }),
  ).toBeEnabled();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "문제 등록 닫기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "문제 1개 저장" }).click();
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "route-modal-test", exact: true }),
  ).toBeVisible();
  await open();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= innerWidth),
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: interception, close, Escape, back/forward, direct reload, unsaved cancel, save/list refresh, mobile; no page errors.",
  );
} finally {
  await browser.close();
}
