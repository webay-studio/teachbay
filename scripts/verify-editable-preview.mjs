import { expect } from "@playwright/test";
import assert from "node:assert/strict";
export async function verifyEditablePreview(page, base) {
  const source = await page
    .locator(".region-overlay.active")
    .getAttribute("style");
  await page
    .getByRole("button", { name: "텍스트 편집 · 실험", exact: true })
    .click();
  await expect(page.locator(".editable-experiment-note")).toContainText(
    "저장에 반영되지",
  );
  await page
    .getByRole("button", { name: "글자 분리 시작", exact: true })
    .click();
  await expect(page.locator(".editable-node").first()).toBeVisible({
    timeout: 90000,
  });
  await expect(page.locator(".editable-fragment > img").first()).toBeVisible();
  const first = page.locator(".editable-node.text").first();
  await first.click();
  const id = await first.getAttribute("data-node-id");
  const node = page.locator(`.editable-node[data-node-id="${id}"]`).first();
  const input = page.getByRole("textbox", { name: "선택 영역 내용" });
  await input.fill("EDIT TEST");
  await expect(node).toHaveText("EDIT TEST");
  await input.fill("");
  await expect(node).toHaveText("");
  await page
    .getByRole("button", { name: "편집 되돌리기", exact: true })
    .click();
  await expect(node).toHaveText("EDIT TEST");
  await page.getByRole("button", { name: "수식", exact: true }).click();
  await input.fill(String.raw`\frac{1}{2}+\sqrt{x^{2}}`);
  await expect(page.locator(".editable-formula-result .katex")).toBeVisible();
  await expect(node.locator(".katex")).toHaveCount(1);
  await input.fill(String.raw`\frac{`);
  await expect(page.locator(".editable-inspector [role=alert]")).toContainText(
    "수식 표기",
  );
  await input.fill(String.raw`x^{2}`);
  await page.getByRole("button", { name: "원본 복원", exact: true }).click();
  await expect(node).toHaveAttribute("data-mode", "image");
  await page.getByRole("button", { name: "글자", exact: true }).click();
  await input.fill("EDIT TEST");
  await page.getByRole("button", { name: "이미지", exact: true }).click();
  await expect(page.locator(".piece-thumb img").first()).toBeVisible();
  await page
    .getByRole("button", { name: "텍스트 편집 · 실험", exact: true })
    .click();
  await expect(node).toHaveText("EDIT TEST");
  assert.equal(
    await page.locator(".region-overlay.active").getAttribute("style"),
    source,
  );
  await page
    .getByRole("button", { name: "수식 영역 지정", exact: true })
    .click();
  const paper = await page.locator(".editable-fragment").first().boundingBox();
  const count = await page.locator(".editable-node").count();
  await page.mouse.move(
    paper.x + paper.width * 0.62,
    paper.y + paper.height * 0.62,
  );
  await page.mouse.down();
  await page.mouse.move(
    paper.x + paper.width * 0.95,
    paper.y + paper.height * 0.95,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.locator(".editable-node")).toHaveCount(count + 1);
  await page.getByRole("button", { name: "수식", exact: true }).click();
  await input.fill(String.raw`\frac{a}{b}`);
  await expect(page.locator(".editable-formula-result .katex")).toBeVisible();
  await page.screenshot({ path: "/tmp/teachbay-editable-preview.png" });
  // Drawing/typing in the preview cannot move the board or edit source regions.
  assert.equal(
    await page.locator(".region-overlay.active").getAttribute("style"),
    source,
  );
  await page.getByRole("button", { name: "이미지", exact: true }).click();
  await expect(page.locator(".selected-piece-preview")).not.toContainText(
    "EDIT TEST",
  );
  await page.getByRole("button", { name: "선택 변경", exact: true }).click();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page.locator(".piece-chip.active input").check();
  await page.getByRole("checkbox", { name: /저장할 문제를 확인/ }).check();
  await page.getByRole("button", { name: "1문제 저장", exact: true }).click();
  await expect(page).toHaveURL(base + "/questions");
  await expect(page.locator(".question-card")).toHaveCount(1);
  console.log(
    "PASS: text split/edit/delete/undo, KaTeX fraction/root/errors, raster restore, cached draft, manual formula region, source isolation, original save.",
  );
}
