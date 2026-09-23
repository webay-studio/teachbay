import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const base = process.env.BASE_URL || "http://localhost:3003";
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
try {
  await page.goto(base + "/questions");
  const picker = page.getByRole("button", {
    name: "문제 파일 선택",
    exact: true,
  });
  await expect(picker).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 600, 180);
    ctx.fillStyle = "black";
    ctx.font = "24px sans-serif";
    ctx.fillText("1. 2 + 3 = ?", 24, 65);
    return canvas.toDataURL().split(",")[1];
  });
  const file = (name) => ({
    name,
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  // Cancelling selection keeps the user in the empty library.
  let chooserPromise = page.waitForEvent("filechooser");
  await picker.click();
  await (await chooserPromise).setFiles([]);
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Keyboard selection transfers multiple original files exactly once.
  await picker.focus();
  chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (
    await chooserPromise
  ).setFiles([file("first.png"), file("second.png")]);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "문제 2개 저장" }),
  ).toBeEnabled();
  await expect(page.locator(".upload-card")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "문제 등록 닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".upload-card")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(base + "/questions");
  await expect(picker).toBeVisible();
  // A file drop opens the same modal without showing a chooser.
  const transfer = await page.evaluateHandle((data) => {
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    return transfer;
  }, png);
  await page
    .locator(".library-start")
    .dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(page.locator(".library-start")).toHaveClass(/dragging/);
  await page.screenshot({ path: "/tmp/teachbay-library-drag.png" });
  await page
    .locator(".library-start")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "문제 1개 저장" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "문제 1개 저장" }).click();
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "dropped", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "문제 등록", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".upload-card")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".registration-page")).toHaveCount(0);
  for (const path of ["/questions/new", "/question/new"]) {
    await page.goto(base + path);
    await expect(page).toHaveURL(base + "/questions");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page
    .getByRole("link", { name: "문제 등록", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // A separate browser context checks the empty mobile layout without user data.
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await mobile.addInitScript(() =>
    localStorage.setItem("teachway-demo", "true"),
  );
  await mobile.goto(base + "/questions");
  await expect(
    mobile.getByRole("button", { name: "문제 파일 선택", exact: true }),
  ).toBeVisible();
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.screenshot({ path: "/tmp/teachbay-library-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: cancelled picker, keyboard/multiple selection, one-time transfer, back/forward, drag highlight/drop, save/list refresh, modal navigation, reload/direct-entry redirects, modal reopening, mobile width; no page errors.",
  );
} finally {
  await browser.close();
}
