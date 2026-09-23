import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const input = process.argv[2];
if (!input) throw new Error("Pass a PDF path");
const base = process.env.BASE_URL || "http://localhost:3003";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => localStorage.setItem("teachway-demo", "true"));
const rect = (locator) =>
  locator.evaluate((el) => ({
    x: parseFloat(el.style.left) / 100,
    y: parseFloat(el.style.top) / 100,
    w: parseFloat(el.style.width) / 100,
    h: parseFloat(el.style.height) / 100,
  }));
const near = (actual, expected) => {
  for (const key of ["x", "y", "w", "h"])
    assert(
      Math.abs(actual[key] - expected[key]) < 0.003,
      `${key}: ${actual[key]} vs ${expected[key]}`,
    );
};
async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
try {
  await page.goto(base + "/questions");
  await expect(page.locator(".library-start")).toBeVisible();
  await page.locator(".library-start input[type=file]").setInputFiles(input);
  await expect(page.locator(".region-editor-canvas")).toBeVisible({
    timeout: 180000,
  });
  const editor = page.locator(".region-editor-canvas");
  if (
    process.argv.includes("--check-editable-preview") &&
    (await page.locator(".piece-chip").count()) === 0
  ) {
    const b = await editor.boundingBox();
    await drag(
      { x: b.x + b.width * 0.05, y: b.y + b.height * 0.065 },
      { x: b.x + b.width * 0.94, y: b.y + b.height * 0.36 },
    );
  }
  await expect(page.locator(".review-preview-heading h5")).not.toBeEmpty();
  const layout = await page.locator(".region-editor-layout").boundingBox();
  const sourcePanel = await page
    .locator(".region-editor-layout > .source-panel")
    .boundingBox();
  const panel = await page.locator(".registration-route-panel").boundingBox();
  assert(
    panel.x <= 10 &&
      panel.y <= 10 &&
      panel.width >= 1420 &&
      panel.height >= 980,
    "modal uses nearly the whole viewport",
  );
  assert(
    sourcePanel.width / layout.width > 0.7,
    "shared workspace gets most of the modal",
  );
  const canvasBox = await editor.boundingBox(),
    canvasViewport = await page.locator(".review-board-viewport").boundingBox();
  assert(
    canvasBox.height <= canvasViewport.height + 1,
    "the whole source page fits initially",
  );
  await expect(
    page.locator(".review-extra-options, .piece-editor, .review-advanced"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /파일 추가|파일 제외/ }),
  ).toHaveCount(0);
  await expect(
    page.locator(".pieces-panel input[type=checkbox], .piece-bundle-mark"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "선택 변경", exact: true }),
  ).toBeVisible();
  await expect(page.locator("header .registration-route-close")).toBeVisible();
  await expect(page.locator("header .review-save-controls .btn")).toBeVisible();
  const previewWidth = await page
    .locator(".selected-piece-preview .piece-thumb")
    .first()
    .boundingBox();
  assert(previewWidth.width > 400, "preview stays large on the board");
  assert(
    previewWidth.x > canvasBox.x + canvasBox.width,
    "preview is to the right of the source",
  );
  await expect(
    page.locator(".review-options-panel .selected-piece-preview"),
  ).toHaveCount(0);
  await expect(
    page.locator(".selected-piece-preview .piece-thumb").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "분리 항목 이름" }),
  ).toBeHidden();
  await page.screenshot({ path: "/tmp/teachbay-review-simplified.png" });
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect
    .poll(async () => {
      const button = await page
        .locator(".registration-header-actions .btn")
        .boundingBox();
      const paper = await editor.boundingBox();
      const area = await page.locator(".review-board-viewport").boundingBox();
      return button.y + button.height <= 768 && paper.height <= area.height + 1;
    })
    .toBe(true);
  assert(
    await page
      .locator(".compact-piece-list")
      .evaluate(
        (el) =>
          getComputedStyle(el).overflowY === "visible" &&
          el.scrollHeight <= el.clientHeight + 1,
      ),
    "question numbers expand without an internal scrollbar",
  );
  await page.screenshot({ path: "/tmp/teachbay-review-compact.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(async () => (await editor.boundingBox()).height > 600)
    .toBe(true);
  // Board gestures move the view, never the underlying problem regions.
  const board = page.locator(".review-board-viewport");
  const boardBox = await board.boundingBox();
  const beforeRects = await page
    .locator(".region-overlay")
    .evaluateAll((els) => els.map((el) => el.getAttribute("style")));
  const beforePan = await editor.boundingBox();
  await drag(
    { x: boardBox.x + 8, y: boardBox.y + 10 },
    { x: boardBox.x + 78, y: boardBox.y + 55 },
  );
  const afterPan = await editor.boundingBox();
  assert(Math.abs(afterPan.x - beforePan.x - 70) < 1);
  assert(Math.abs(afterPan.y - beforePan.y - 45) < 1);
  await page.getByRole("button", { name: "작업판 이동", exact: true }).click();
  await drag(
    { x: afterPan.x + 100, y: afterPan.y + 120 },
    { x: afterPan.x + 130, y: afterPan.y + 140 },
  );
  assert(Math.abs((await editor.boundingBox()).x - afterPan.x - 30) < 1);
  await page.getByRole("button", { name: "선택·이동", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "작업판 이동", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await editor.focus();
  await page.keyboard.down("Space");
  const spaceBox = await editor.boundingBox();
  await drag(
    { x: spaceBox.x + 100, y: spaceBox.y + 120 },
    { x: spaceBox.x + 125, y: spaceBox.y + 145 },
  );
  await page.keyboard.up("Space");
  assert(Math.abs((await editor.boundingBox()).x - spaceBox.x - 25) < 1);
  assert.deepEqual(
    await page
      .locator(".region-overlay")
      .evaluateAll((els) => els.map((el) => el.getAttribute("style"))),
    beforeRects,
  );
  await page.getByRole("button", { name: "작업판 전체 보기" }).click();
  await page.mouse.move(
    boardBox.x + boardBox.width / 2,
    boardBox.y + boardBox.height / 2,
  );
  const beforeWheel = await editor.boundingBox();
  await page.mouse.wheel(30, 60);
  await expect
    .poll(async () =>
      Math.round((await editor.boundingBox()).y - beforeWheel.y),
    )
    .toBe(-60);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -20);
  await page.keyboard.up("Control");
  await expect
    .poll(
      async () => (await editor.boundingBox()).width > beforeWheel.width * 1.1,
    )
    .toBe(true);
  await page.getByRole("button", { name: "작업판 전체 보기" }).click();
  if (process.argv.includes("--check-editable-preview")) {
    const { verifyEditablePreview } =
      await import("./verify-editable-preview.mjs");
    await verifyEditablePreview(page, base);
    assert.deepEqual(errors, []);
  } else if (process.argv.includes("--check-auto-bundle")) {
    const { verifyAutomaticPassageBundle } =
      await import("./verify-passage-bundle.mjs");
    await verifyAutomaticPassageBundle(page, base);
    assert.deepEqual(errors, []);
  } else if (process.argv.includes("--check-passage-bundle")) {
    const { verifyPassageBundle } = await import("./verify-passage-bundle.mjs");
    await verifyPassageBundle(page, base);
    assert.deepEqual(errors, []);
  } else if (process.argv.includes("--check-print-cleanup")) {
    const { verifyPrintCleanup } = await import("./verify-print-cleanup.mjs");
    await verifyPrintCleanup(page, base);
    assert.deepEqual(errors, []);
  } else {
    const count = await page.locator(".piece-chip").count();
    const first = page.locator(".region-overlay").first();
    await first.locator(".region-body").click();
    await expect(first).toHaveClass(/active/);
    await page.getByRole("button", { name: "작업판 확대" }).click();
    const original = await rect(first),
      box = await first.boundingBox();
    await drag(
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: box.x + box.width / 2 + 22, y: box.y + box.height / 2 + 16 },
    );
    const moved = await rect(first);
    const zoomedPaper = await editor.boundingBox();
    near(moved, {
      ...original,
      x: original.x + 22 / zoomedPaper.width,
      y: original.y + 16 / zoomedPaper.height,
    });
    assert(
      moved.x > original.x && moved.y > original.y,
      "mouse moves the selected region",
    );
    await page
      .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
      .click();
    near(await rect(first), original);
    await page.getByRole("button", { name: "작업판 전체 보기" }).click();
    const handle = await first.locator(".handle-se").boundingBox();
    await drag(
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      {
        x: handle.x + handle.width / 2 + 22,
        y: handle.y + handle.height / 2 + 18,
      },
    );
    const resized = await rect(first);
    assert(
      resized.w > original.w && resized.h > original.h,
      "corner resizes both dimensions",
    );
    await editor.focus();
    await page.keyboard.press("Control+z");
    near(await rect(first), original);
    const cancelBox = await first.boundingBox();
    await page.mouse.move(
      cancelBox.x + cancelBox.width / 2,
      cancelBox.y + cancelBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      cancelBox.x + cancelBox.width / 2 + 30,
      cancelBox.y + cancelBox.height / 2 + 20,
      { steps: 5 },
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    near(await rect(first), original);
    await expect(page.getByRole("dialog")).toBeVisible();
    // Blank-space draw adds without selecting an add tool first.
    let canvas = await editor.boundingBox();
    await drag(
      { x: canvas.x + canvas.width * 0.7, y: canvas.y + canvas.height * 0.015 },
      { x: canvas.x + canvas.width * 0.9, y: canvas.y + canvas.height * 0.05 },
    );
    await expect(page.locator(".piece-chip")).toHaveCount(count + 1);
    const created = page.locator(".region-overlay.active");
    const createdId = await created.getAttribute("data-piece-id");
    const createdRect = await rect(created);
    const questionChip = page.locator(
      `.piece-chip[data-piece-id="${createdId}"]`,
    );
    await page.getByRole("button", { name: "선택 변경", exact: true }).click();
    const saveLabel = await questionChip
      .locator("input")
      .first()
      .getAttribute("aria-label");
    const name = saveLabel.replace(/ 저장 선택$/, "");
    assert(
      /^\d+$/.test(await questionChip.getByRole("button").innerText()),
      "question chip shows only a number",
    );
    await page.getByRole("button", { name: "지문 추가", exact: true }).click();
    canvas = await editor.boundingBox();
    await drag(
      { x: canvas.x + canvas.width * 0.7, y: canvas.y + canvas.height * 0.18 },
      { x: canvas.x + canvas.width * 0.9, y: canvas.y + canvas.height * 0.23 },
    );
    await expect(
      page.getByRole("region", { name: "지문 목록" }).locator(".piece-chip"),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "선택 영역 삭제", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "지문 목록" }).locator(".piece-chip"),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "지문 목록" }).locator(".piece-chip"),
    ).toHaveCount(1);
    await page.screenshot({ path: "/tmp/teachbay-region-editor.png" });
    await questionChip.getByRole("button").click();
    const beforeZoom = await editor.boundingBox();
    await page
      .getByRole("button", { name: "작업판 확대", exact: true })
      .click();
    assert((await editor.boundingBox()).width > beforeZoom.width * 1.2);
    await page.getByRole("button", { name: "작업판 전체 보기" }).click();
    await page.getByRole("button", { name: "다음 원본 페이지" }).click();
    await page.getByRole("button", { name: "이전 원본 페이지" }).click();
    near(
      await rect(page.locator(`.region-overlay[data-piece-id="${createdId}"]`)),
      createdRect,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= innerWidth),
    );
    assert(
      await page
        .locator(".compact-piece-list")
        .evaluate(
          (el) =>
            getComputedStyle(el).overflowY === "visible" &&
            el.scrollHeight <= el.clientHeight + 1,
        ),
      "mobile question numbers expand without an internal scrollbar",
    );
    await page
      .locator(".review-board-controls")
      .getByRole("button", { name: "미리보기", exact: true })
      .click();
    const mobilePreview = await page
      .locator(".review-board-preview")
      .boundingBox();
    assert(
      mobilePreview.x >= 0 && mobilePreview.x + mobilePreview.width <= 390,
      "mobile preview focus fits the viewport",
    );
    await page.screenshot({ path: "/tmp/teachbay-region-editor-mobile.png" });
    await page.getByRole("button", { name: "작업판 전체 보기" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "선택 해제", exact: true }).click();
    await page.getByRole("checkbox", { name: saveLabel, exact: true }).check();
    await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
    await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
    await expect(page).toHaveURL(base + "/questions");
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const saved = await page.evaluate(async (name) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("teachway");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const rows = await new Promise((resolve, reject) => {
        const r = db.transaction("questions").objectStore("questions").getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return rows.find((row) => row.name === name);
    }, name);
    near(saved.fragments[0].rect, createdRect);
    assert.equal(saved.fragments[0].pageIndex, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: board background/hand/Space pan, wheel/anchored zoom, zoomed normalized move, direct draw, corner resize, undo, Escape rollback, passage/question groups, deletion undo, zoom, page switching, mobile width, saved original fragment coordinates; no page errors.",
    );
  }
} catch (error) {
  await page.screenshot({ path: "/tmp/teachbay-editor-failure.png" });
  throw error;
} finally {
  await browser.close();
}
