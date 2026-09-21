import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const input = process.argv[2] || process.env.TEST_PDF;
if (!input) throw new Error("Pass the Korean geography regression PDF path as an argument or TEST_PDF.");
const out = "output/registration-v2/integration";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const base = process.env.BASE_URL || "http://localhost:3037";
try {
  await page.goto(base + "/login");
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.waitForURL("**/questions");
  assert.equal(
    (await page.request.get(base + "/lab/pdf-regions")).status(),
    404,
  );
  await page.goto(base + "/question/new");
  await page.waitForURL("**/questions/new");
  assert.equal(
    await page.locator(".topbar:visible,.heading:visible").count(),
    0,
  );
  const buffer = await fs.readFile(
    input,
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      { name: "검토 A.pdf", mimeType: "application/pdf", buffer },
      { name: "검토 B.pdf", mimeType: "application/pdf", buffer },
    ]);
  await page
    .locator(".registration-file-row")
    .nth(1)
    .waitFor({ timeout: 180000 });
  await page.locator(".file-review-open").first().click();
  await page.locator(".registration-review").waitFor({ timeout: 180000 });
  assert.equal(await page.locator(".piece-card").count(), 20);
  assert.equal(await page.locator("[role=dialog],.modal-backdrop").count(), 0);
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  const target = page.getByRole("checkbox", { name: /16번 저장 선택$/ });
  await target.check();
  await page.locator(".file-review-open").nth(1).click();
  assert.equal(
    await page.locator('input[aria-label$="저장 선택"]:checked').count(),
    20,
  );
  await page.locator(".file-review-open").first().click();
  assert(await target.isChecked());
  assert.equal(
    await page.locator('input[aria-label$="저장 선택"]:checked').count(),
    1,
  );
  await page.screenshot({ path: out + "/inline-review.png", fullPage: true });
  const source = await page.locator(".source-stage").boundingBox();
  const footer = await page.locator(".review-footer").boundingBox();
  const add = await page
    .getByRole("button", { name: "문제 직접 추가", exact: true })
    .boundingBox();
  assert(add.y + add.height < footer.y, "add question visible above save");
  assert(
    source.y >= 0 && source.y + source.height <= 900,
    "whole source page fits viewport",
  );
  assert(footer.y + footer.height <= 900, "save stays in viewport");
  await page
    .getByRole("button", { name: "문제 직접 추가", exact: true })
    .click();
  assert(await page.locator(".source-stage.drawing").count());
  await page.getByRole("button", { name: "지정 취소" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile review fits width",
  );
  await page.screenshot({ path: out + "/mobile-review.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("checkbox", { name: /선택한 문제의 내용/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await page
    .locator(".registration-file-row")
    .filter({ hasText: "검토 A.pdf" })
    .waitFor({ state: "detached" });
  assert.equal(await page.locator(".registration-file-row").count(), 1);
  await page.goto(base + "/questions");
  await page.reload();
  const saved = await page.evaluate(async () => {
    const db = await new Promise((r, j) => {
      const q = indexedDB.open("teachway", 2);
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
    const all = (s) =>
      new Promise((r, j) => {
        const q = db.transaction(s).objectStore(s).getAll();
        q.onsuccess = () => r(q.result);
        q.onerror = () => j(q.error);
      });
    const qs = await all("questions"),
      docs = await all("documents"),
      assets = await all("assets");
    return {
      questions: qs,
      documents: docs.map((d) => ({
        id: d.id,
        bytes: d.blob.size,
        pages: d.pages.length,
      })),
      assets: assets.length,
    };
  });
  assert.equal(saved.questions.length, 1);
  assert.equal(saved.questions[0].fragments.length, 1);
  assert.equal(saved.documents.length, 1);
  assert(saved.documents[0].bytes > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/questions/new");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    out + "/result.json",
    JSON.stringify({ passed: true, detected: 20, saved, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      detected: 20,
      savedQuestions: saved.questions.length,
      documents: saved.documents,
      errors,
    }),
  );
} finally {
  await browser.close();
}
