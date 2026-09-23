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
  const createdPassage = page
    .getByRole("region", { name: "지문 목록" })
    .locator(".piece-chip")
    .last();
  const passageId = await createdPassage.getAttribute("data-piece-id");
  const passage = page.locator(`.piece-chip[data-piece-id="${passageId}"]`);
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
  await page
    .getByRole("button", { name: "문제 1 영역 선택", exact: true })
    .click();
  await expect(page.locator(".review-selected-heading")).toContainText(
    "1–3번 지문 묶음",
  );
  await expect(page.locator(".pieces-panel input[type=checkbox]")).toHaveCount(
    0,
  );
  for (const id of ids)
    await expect(
      page.locator(`.piece-chip[data-piece-id="${id}"]`),
    ).toHaveCount(0);
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(1);
  await expect(page.locator(".review-preview-item h5")).toHaveText(["문제 1"]);
  await expect(page.locator(".review-member-nav button")).toHaveCount(4);
  const saveScope = page.locator(".review-preview-save-scope");
  await expect(saveScope).toHaveText("공통 지문 + 1–3번 묶음으로 저장");
  await page.locator(".review-member-nav button").first().click();
  await expect(page.locator(".review-preview-item h5")).toHaveText([
    "공통 지문",
  ]);
  await expect(
    page.locator(".region-overlay.active .region-caption"),
  ).toHaveText("공통 지문");
  const activeColor = await page
    .locator(".region-overlay.active")
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  assert.equal(
    await page
      .locator(".review-preview-heading h5")
      .evaluate((el) => getComputedStyle(el).color),
    activeColor,
  );
  assert.equal(
    await page
      .locator('.review-member-nav button[aria-pressed="true"]')
      .evaluate((el) => getComputedStyle(el).color),
    activeColor,
  );
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "문제 2 영역 선택", exact: true })
    .click();
  await expect(page.locator(".review-preview-item h5")).toHaveText(["문제 2"]);
  await page
    .locator(`.region-overlay[data-piece-id="${ids[0]}"] .region-body`)
    .click();
  await expect(page.locator(".review-preview-item h5")).toHaveText(["문제 1"]);
  await expect
    .poll(async () =>
      page
        .locator(".selected-piece-preview .piece-thumb img")
        .evaluateAll(
          (els) =>
            els.length > 0 &&
            els.every((el) => el.complete && el.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/teachbay-bundle-member-preview.png" });
  await page.locator(".review-bundle-range > summary").click();

  await expect(page.locator(".selected-piece-preview")).toBeVisible();
  await expect(
    page.locator(".selected-piece-preview .piece-thumb"),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "묶음 끝 문제" })
    .selectOption(ids[1]);
  await page.getByRole("button", { name: "범위 변경", exact: true }).click();
  await expect(passage.getByRole("button")).toHaveText("1–2번");
  await expect(saveScope).toHaveText("공통 지문 + 1–2번 묶음으로 저장");
  await page
    .getByRole("button", { name: "영역 수정 되돌리기", exact: true })
    .click();
  await expect(passage.getByRole("button")).toHaveText("1–3번");
  await page.getByRole("button", { name: "묶기 해제", exact: true }).click();
  await expect(page.locator(".review-bundle-summary")).toHaveCount(0);
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
  await page.getByRole("button", { name: "선택 변경", exact: true }).click();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await passageCheck.check();
  await expect(page.locator(".piece-chip input:checked")).toHaveCount(1);
  await passageCheck.uncheck();
  await expect(page.locator(".piece-chip input:checked")).toHaveCount(0);
  await expect(saveScope).toHaveText("1–3번 묶음 · 저장 제외");
  await expect(page.locator(".review-bundle-summary")).toContainText(
    "저장 제외",
  );
  await passageCheck.check();
  await expect(
    page.getByRole("button", { name: "1문제 저장", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "선택 완료", exact: true }).click();
  await expect(page.locator(".pieces-panel input")).toHaveCount(0);
  await expect(saveScope).toHaveText("공통 지문 + 1–3번 묶음으로 저장");
  await page.screenshot({ path: "/tmp/teachbay-passage-bundle.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".pieces-panel").scrollIntoViewIfNeeded();
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
    "PASS: range validation, grouping/narrowing/undo/ungroup, unit selection, active-only preview with intact membership, mobile width, one library row, original members preserved, one exam snapshot with all fragments.",
  );
}

export async function verifyAutomaticPassageBundle(page, base) {
  const passageId = await page
    .locator('.piece-group[aria-label="지문 묶음 목록"] .piece-chip')
    .first()
    .getAttribute("data-piece-id");
  const passage = page.locator(`.piece-chip[data-piece-id="${passageId}"]`);
  await passage.getByRole("button").click();
  const notice = page.locator(".review-bundle-summary");
  const memberCount = Number(
    (await notice.textContent()).match(/문제 (\d+)개/)[1],
  );
  assert(memberCount > 0);
  await expect(page.locator(".pieces-panel input")).toHaveCount(0);
  await page.locator(".review-bundle-range > summary").click();
  const memberId = await page
    .getByRole("combobox", { name: "묶음 시작 문제" })
    .inputValue();
  await expect(
    page.locator(`.piece-chip[data-piece-id="${memberId}"]`),
  ).toHaveCount(0);
  await page.locator(".review-member-nav button").nth(1).click();
  await expect(page.locator(".review-preview-item")).toHaveCount(1);
  await expect(page.locator(".review-member-nav button")).toHaveCount(
    memberCount + 1,
  );
  await page.getByRole("button", { name: "묶기 해제", exact: true }).click();
  await expect(notice).toHaveCount(0);
  const member = page.locator(`.piece-chip[data-piece-id="${memberId}"]`);
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
  await page.getByRole("button", { name: "선택 변경", exact: true }).click();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await passage.locator("input").check();
  await expect(page.locator(".piece-chip input:checked")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "1문제 저장", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "선택 완료", exact: true }).click();
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
    "PASS: initial bundles shown once, member navigation, ungroup/undo, opt-in unit selection, one saved bundle survives reload.",
  );
}
