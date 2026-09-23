import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const input = process.argv[2];
if (!input) throw new Error("Pass a multipage PDF path");
const buffer = await fs.readFile(input);
const single = process.argv.includes("--single");
const checkOcrStages = process.argv.includes("--check-ocr-stages");
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
const base = process.env.BASE_URL || "http://localhost:3003";
try {
  await page.goto(base + "/questions");
  await expect(page.locator(".library-start")).toBeVisible();
  await page.evaluate(() => {
    window.originalPreviewSeen = false;
    window.analysisMessages = [];
    window.watchPreview = new MutationObserver(() => {
      const message = document.querySelector(
        ".analysis-stage-message",
      )?.textContent;
      if (message && !window.analysisMessages.includes(message))
        window.analysisMessages.push(message);
      if (
        document.querySelector('.analysis-source img[src^="blob:"]') &&
        document.querySelector('.analysis-workspace[aria-busy="true"]')
      )
        window.originalPreviewSeen = true;
    });
    window.watchPreview.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
  await page.locator(".library-start input[type=file]").setInputFiles(
    (single ? ["A.pdf"] : ["A.pdf", "B.pdf", "C.pdf"]).map((name) => ({
      name,
      mimeType: "application/pdf",
      buffer,
    })),
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  if (!single) await expect(page.locator(".scan-job")).toHaveCount(3);
  await expect(page.locator(".analysis-source img")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".scan-skeleton")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/teachbay-analysis-progress.png" });
  if (checkOcrStages) {
    await expect(page.locator(".analysis-stage-message")).toHaveText(
      "놓친 글자가 있는지 한 번 더 살펴볼게요.",
      { timeout: 120000 },
    );
    await page.screenshot({ path: "/tmp/teachbay-ocr-recheck.png" });
  }
  await expect(page.locator(".registration-review")).toBeVisible({
    timeout: 180000,
  });
  if (!single)
    assert(
      (await page.locator('.scan-job[aria-busy="true"]').count()) > 0,
      "completed file available before batch finishes",
    );
  assert(
    await page.evaluate(() => window.originalPreviewSeen),
    "actual source shown during analysis",
  );
  if (checkOcrStages) {
    const messages = await page.evaluate(() => window.analysisMessages);
    assert(
      messages.includes("페이지 전체의 글자를 읽고 있어요."),
      "initial OCR pass is described",
    );
    assert(
      messages.includes("놓친 글자가 있는지 한 번 더 살펴볼게요."),
      "second OCR pass has its own reason",
    );
    assert(
      messages.every((message) => !/OCR|\(\d+\)/.test(message)),
      "technical pass numbers stay out of the guidance",
    );
    console.log("Observed OCR guidance:", messages);
  }
  const columns = await page
    .locator(".review-layout")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  assert.equal(columns, 2);
  if (!single) await page.getByRole("button", { name: "분석 중단" }).click();
  await expect(page.locator('.scan-job[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(page.locator(".registration-review")).toBeVisible();
  const saveBounds = await page
    .locator(".registration-header-actions .btn")
    .boundingBox();
  assert(
    saveBounds && saveBounds.y >= 0 && saveBounds.y + saveBounds.height < 1000,
    "save stays within the modal viewport",
  );
  await page.screenshot({ path: "/tmp/teachbay-document-review.png" });
  const firstCheckbox = page
    .locator('.piece-group[aria-label="문제 목록"] .piece-chip input')
    .first();
  const firstLabel = await firstCheckbox.getAttribute("aria-label");
  const firstName = firstLabel.replace(/ 저장 선택$/, "");
  await page.getByRole("button", { name: "다음 원본 페이지" }).click();
  await expect(page.locator(".source-nav")).toContainText("2 /");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= innerWidth),
    "mobile dialog width",
  );
  assert(
    await page
      .locator(".review-layout")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    "mobile workspace width",
  );
  await page.screenshot({ path: "/tmp/teachbay-document-review-mobile.png" });
  await page.locator(".review-options-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/teachbay-document-options-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page.getByRole("checkbox", { name: firstLabel, exact: true }).check();
  await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL(base + "/questions");
  await expect(
    page.getByRole("heading", { name: firstName, exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: source preview during PDF analysis, no skeleton, editor/sidebar layout, header save, page navigation, mobile width, save/list refresh; no page errors.",
  );
} finally {
  await browser.close();
}
