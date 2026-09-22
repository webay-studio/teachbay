import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const input = process.argv[2];
if (!input) throw new Error("Pass a multipage PDF path");
const buffer = await fs.readFile(input);
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
const out = "output/registration-v2/progress";
await fs.mkdir(out, { recursive: true });
try {
  await page.goto("http://localhost:3037/questions");
  await page
    .getByRole("link", { name: "문제 등록", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => {
    window.previewSeen = false;
    window.watchPreview = new MutationObserver(() => {
      if (document.querySelector(".progressive-crops article"))
        window.previewSeen = true;
    });
    window.watchPreview.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
  await page
    .locator("input[type=file]")
    .setInputFiles(
      ["A.pdf", "B.pdf", "C.pdf"].map((name) => ({
        name,
        mimeType: "application/pdf",
        buffer,
      })),
    );
  await expect(page.locator(".scan-job")).toHaveCount(3);
  await expect(page.locator(".scan-skeleton").first()).toBeVisible();
  await page.screenshot({ path: out + "/processing.png" });
  const first = page.getByRole("article", { name: "A.pdf 분석 상태" });
  await expect(page.locator(".registration-review")).toBeVisible({
    timeout: 180000,
  });
  assert(
    (await page.locator('.scan-job[aria-busy="true"]').count()) > 0,
    "completed file available before batch finishes",
  );
  await expect(
    first.getByRole("button", { name: "미리보기 목록으로" }),
  ).toBeEnabled();
  await page.screenshot({ path: out + "/partial-ready.png" });
  assert(
    !(await page.evaluate(() => window.previewSeen)),
    "no provisional page regions displayed",
  );
  await expect(page.locator(".registration-review")).toBeVisible();
  await page.getByRole("button", { name: "분석 중단" }).click();
  await expect(page.locator('.scan-job[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(page.locator(".registration-review")).toBeVisible();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /1번 저장 선택$/ })
    .first()
    .check();
  await page.getByRole("checkbox", { name: /선택한 문제의 내용/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3037/questions");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: waiting skeletons, no provisional page previews, ready file before batch completion, review during analysis, cancel keeps completed result, save.",
  );
} finally {
  await browser.close();
}
