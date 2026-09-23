import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function verifyPrintCleanup(page, base) {
  await expect(page.locator(".page-notices")).toHaveCount(0);
  if (
    process.argv.includes("--require-score") &&
    (await page.locator(".piece-chip").count()) === 0
  ) {
    // The sparse synthetic scan may need a manually defined question region.
    const canvas = await page.locator(".region-editor-canvas").boundingBox();
    await page.mouse.move(
      canvas.x + canvas.width * 0.075,
      canvas.y + canvas.height * 0.14,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvas.x + canvas.width * 0.9,
      canvas.y + canvas.height * 0.33,
      { steps: 10 },
    );
    await page.mouse.up();
    await expect(page.locator(".piece-chip")).toHaveCount(1);
  }
  await expect(page.locator(".selected-piece-preview")).toBeVisible();
  const masks = page.locator(".selected-piece-preview .print-erasure");
  const autoCount = await masks.count();
  assert(autoCount > 0, "a print label has a located erasure");
  if (process.argv.includes("--require-score"))
    assert(
      await masks.evaluateAll((els) =>
        els.some((el) => parseFloat(el.style.left) > 70),
      ),
      "the printed score has a located erasure",
    );
  const active = page.locator(".region-overlay.active");
  const id = await active.getAttribute("data-piece-id");
  const chip = page.locator(`.piece-chip[data-piece-id="${id}"]`);
  await page.getByRole("button", { name: "선택 변경", exact: true }).click();
  const saveLabel = await chip
    .locator("input")
    .first()
    .getAttribute("aria-label");
  await page.getByRole("button", { name: "지우기", exact: true }).click();
  const box = await active.boundingBox();
  await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.38, box.y + box.height * 0.62, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(masks).toHaveCount(autoCount + 1);
  await page
    .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
    .click();
  await expect(masks).toHaveCount(autoCount);
  // Leave an explicit manual correction alongside the automatic number removal.
  await page.getByRole("button", { name: "지우기", exact: true }).click();
  await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.38, box.y + box.height * 0.62, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(masks).toHaveCount(autoCount + 1);
  const previewMasks = await masks.evaluateAll((els) =>
    els.map((el) => ({
      x: parseFloat(el.style.left) / 100,
      y: parseFloat(el.style.top) / 100,
      w: parseFloat(el.style.width) / 100,
      h: parseFloat(el.style.height) / 100,
    })),
  );
  await page.screenshot({ path: "/tmp/teachbay-print-cleanup.png" });
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page.getByRole("checkbox", { name: saveLabel, exact: true }).check();
  await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL(base + "/questions");
  const result = await page.evaluate(
    async ({ id, previewMasks }) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("teachway");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const get = (store, key) =>
        new Promise((resolve, reject) => {
          const r = db.transaction(store).objectStore(store).get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      const q = await get("questions", id),
        f = q.fragments[0];
      const asset = await get("assets", f.assetId),
        source = await get("assets", f.pageAssetId);
      db.close();
      const original = await createImageBitmap(source.blob),
        saved = await createImageBitmap(asset.blob);
      const make = () => {
        const c = document.createElement("canvas");
        c.width = asset.width;
        c.height = asset.height;
        return c;
      };
      const ref = make(),
        actual = make(),
        rc = ref.getContext("2d"),
        ac = actual.getContext("2d"),
        r = f.rect;
      rc.fillStyle = "white";
      rc.fillRect(0, 0, ref.width, ref.height);
      rc.drawImage(
        original,
        r.x * source.width,
        r.y * source.height,
        r.w * source.width,
        r.h * source.height,
        0,
        0,
        ref.width,
        ref.height,
      );
      ac.drawImage(saved, 0, 0);
      const before = rc.getImageData(0, 0, ref.width, ref.height).data;
      rc.fillStyle = "white";
      for (const m of previewMasks)
        rc.fillRect(
          m.x * ref.width,
          m.y * ref.height,
          m.w * ref.width,
          m.h * ref.height,
        );
      const expected = rc.getImageData(0, 0, ref.width, ref.height).data,
        after = ac.getImageData(0, 0, ref.width, ref.height).data;
      let changed = 0,
        unexpected = 0;
      for (let i = 0; i < after.length; i += 4) {
        if (before[i] !== after[i]) changed++;
        if (
          Math.abs(expected[i] - after[i]) > 1 ||
          Math.abs(expected[i + 1] - after[i + 1]) > 1 ||
          Math.abs(expected[i + 2] - after[i + 2]) > 1
        )
          unexpected++;
      }
      const preserved =
        before.some((v) => v < 150) && after.some((v) => v < 150);
      original.close();
      saved.close();
      return {
        changed,
        unexpected,
        preserved,
        masks: f.erasures.length,
        hasSource: source.blob.size > 0,
      };
    },
    { id, previewMasks },
  );
  assert(result.changed > 10, "ink was actually removed");
  assert.equal(
    result.unexpected,
    0,
    "saved pixels match preview masks and all other content is unchanged",
  );
  assert(
    result.preserved && result.hasSource,
    "remaining body and original page are preserved",
  );
  assert.equal(result.masks, autoCount + 1);
  console.log(
    "PASS: notices removed; automatic label removal, manual eraser/undo; saved pixels match preview masks, body and original preserved.",
  );
}
