import { expect } from "@playwright/test";
import assert from "node:assert/strict";
export async function verifyPassageBundle(page, base) {
  const ids = [];
  for (let n = 1; n <= 3; n++)
    ids.push(
      await page
        .getByRole("button", { name: `문제 ${n} 선택`, exact: true })
        .evaluate((el) => el.closest(".piece-chip").dataset.pieceId),
    );
  const canvas = await page.locator(".region-editor-canvas").boundingBox();
  await page.getByRole("button", { name: "지문 추가", exact: true }).click();
  await page.mouse.move(
    canvas.x + canvas.width * 0.7,
    canvas.y + canvas.height * 0.015,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.9,
    canvas.y + canvas.height * 0.05,
    { steps: 8 },
  );
  await page.mouse.up();
  const passage = page
    .getByRole("region", { name: "지문 목록" })
    .locator(".piece-chip")
    .last();
  const passageId = await passage.getAttribute("data-piece-id");
  const passageCheck = passage.locator("input").first();
  await page
    .getByRole("combobox", { name: "묶음 시작 문제" })
    .selectOption(ids[2]);
  await page
    .getByRole("combobox", { name: "묶음 끝 문제" })
    .selectOption(ids[0]);
  await page
    .getByRole("button", { name: "한 문제로 묶기", exact: true })
    .click();
  await expect(
    page.locator(".passage-bundle-editor").getByRole("alert"),
  ).toHaveText(/순서/);
  await page
    .getByRole("combobox", { name: "묶음 시작 문제" })
    .selectOption(ids[0]);
  await page
    .getByRole("combobox", { name: "묶음 끝 문제" })
    .selectOption(ids[2]);
  await page
    .getByRole("button", { name: "한 문제로 묶기", exact: true })
    .click();
  await expect(passage.getByRole("button")).toHaveText("1–3번");
  await page.getByRole("button", { name: "문제 1 선택", exact: true }).click();
  await expect(page.locator(".review-bundle-notice")).toContainText(
    "1–3번 지문 묶음",
  );
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(4);
  await expect(page.locator(".review-preview-item h5")).toHaveText([
    "공통 지문",
    "문제 1",
    "문제 2",
    "문제 3",
  ]);
  await page.screenshot({ path: "/tmp/teachbay-bundle-member-preview.png" });
  await page.getByRole("button", { name: "묶음 수정", exact: true }).click();

  await expect(page.locator(".selected-piece-preview")).toBeVisible();
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "묶음 끝 문제" })
    .selectOption(ids[1]);
  await page.getByRole("button", { name: "범위 변경", exact: true }).click();
  await expect(passage.getByRole("button")).toHaveText("1–2번");
  await page
    .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
    .click();
  await expect(passage.getByRole("button")).toHaveText("1–3번");
  await page.getByRole("button", { name: "묶기 해제", exact: true }).click();
  await expect(page.locator(".review-bundle-notice")).toHaveCount(0);
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "한 문제로 묶기", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
    .click();
  await expect(passage.getByRole("button")).toHaveText("1–3번");
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await passageCheck.check();
  await expect(page.locator(".piece-chip input:checked")).toHaveCount(4);
  await page
    .locator(`.piece-chip[data-piece-id="${ids[1]}"] input`)
    .first()
    .uncheck();
  await expect(page.locator(".piece-chip input:checked")).toHaveCount(0);
  await passageCheck.check();
  await expect(
    page.getByRole("button", { name: "1문제 저장", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/teachbay-passage-bundle.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("region", { name: "지문 문제 묶기" })
    .scrollIntoViewIfNeeded();
  assert(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= innerWidth),
  );
  await page.screenshot({ path: "/tmp/teachbay-passage-bundle-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.locator(".question-card")).toHaveCount(1);
  await expect(page.locator(".question-bundle-badge")).toHaveText(
    "지문 묶음 · 1–3번",
  );
  await page.screenshot({ path: "/tmp/teachbay-bundle-library.png" });
  await expect(
    page.getByRole("heading", { name: "1–3번 지문 묶음", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("지문 + 3문제", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "1–3번 지문 묶음 이미지 확대", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("img.full-image")).toHaveCount(
    4,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("checkbox", { name: "1–3번 지문 묶음 선택", exact: true })
    .check();
  await page
    .getByRole("button", { name: "시험지 만들기", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/exams/new");
  const stored = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("teachway");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const all = (name) =>
      new Promise((resolve, reject) => {
        const r = db.transaction(name).objectStore(name).getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const questions = await all("questions"),
      documents = await all("documents"),
      drafts = await all("drafts");
    db.close();
    return {
      questions,
      documents: documents.map((d) => ({
        id: d.id,
        items: d.items,
        hasOriginal: d.blob.size > 0,
      })),
      drafts,
    };
  });
  assert.equal(stored.questions.length, 1);
  const saved = stored.questions[0],
    doc = stored.documents[0];
  assert.equal(saved.bundle.passageId, passageId);
  assert.deepEqual(saved.bundle.questionIds, ids);
  assert.deepEqual(
    saved.fragments.map((f) => f.id),
    [passageId, ...ids].flatMap((id) =>
      doc.items.find((p) => p.id === id).fragments.map((f) => f.id),
    ),
  );
  assert(doc.hasOriginal);
  assert.equal(stored.drafts[0].items.length, 1);
  assert.equal(stored.drafts[0].items[0].fragments.length, 4);
  await page.reload();
  await expect(page).toHaveURL(base + "/exams/new");
  console.log(
    "PASS: range validation, grouping/narrowing/undo/ungroup, unit selection, combined preview, mobile width, one library row, original members preserved, one exam snapshot with all fragments.",
  );
}

export async function verifyAutomaticPassageBundle(page, base) {
  const initialPassage = page
    .locator('.piece-group[aria-label="지문 목록"] .piece-chip.bundled')
    .first();
  await expect(initialPassage).toBeVisible();
  const passageId = await initialPassage.getAttribute("data-piece-id");
  const passage = page.locator(`.piece-chip[data-piece-id="${passageId}"]`);
  await passage.getByRole("button").click();
  const notice = page.locator(".review-bundle-notice");
  await expect(notice).toContainText("지문 묶음");
  const memberCount = Number(
    (await notice.textContent()).match(/문제 (\d+)개/)[1],
  );
  assert(memberCount > 0);
  const memberId = await page
    .getByRole("combobox", { name: "묶음 시작 문제" })
    .inputValue();
  const member = page.locator(`.piece-chip[data-piece-id="${memberId}"]`);
  await member.getByRole("button").click();
  await expect(page.locator(".review-preview-item")).toHaveCount(
    memberCount + 1,
  );
  await page.getByRole("button", { name: "묶음 수정", exact: true }).click();
  await page.getByRole("button", { name: "묶기 해제", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await member.getByRole("button").click();
  await expect(page.locator(".review-preview-item")).toHaveCount(1);
  await passage.getByRole("button").click();
  await expect(
    page.getByRole("button", { name: "한 문제로 묶기", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
    .click();
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await member.locator("input").check();
  await expect(
    page.getByRole("button", { name: "1문제 저장", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/teachbay-auto-bundle.png" });
  await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL(base + "/questions", { timeout: 30000 });
  await expect(page.locator(".question-card")).toHaveCount(1);
  await expect(page.locator(".question-bundle-badge")).toContainText(
    "지문 묶음",
  );
  await expect(page.locator(".card-bottom")).toContainText(
    `지문 + ${memberCount}문제`,
  );
  await page.reload();
  await expect(page.locator(".question-bundle-badge")).toBeVisible();
  console.log(
    "PASS: fresh import auto-bundle, all-member preview, ungroup stays ungrouped across selection, undo, unit selection, one saved bundle survives reload.",
  );
}
