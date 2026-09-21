import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { selectVisible } from "./questions/_lib/questionsHelpers.lib";
import { copyExamDraft } from "./exams/_lib/examsHelpers.lib";
import { draftSignature, moveDraftItem } from "./editor/_lib/editorHelpers.lib";
import { registrationRecords } from "./registration/_lib/registrationHelpers.lib";
import type { Exam, ExamDraft, Question } from "../../lib/types";
import type { PendingQuestion } from "../../lib/documents/types";

test("visible selection preserves selected questions outside the search", () => {
  const visible = [{ id: "b" }, { id: "c" }] as Question[];
  assert.deepEqual(selectVisible(["a", "b"], visible, true), ["a", "b", "c"]);
  assert.deepEqual(selectVisible(["a", "b", "c"], visible, false), ["a"]);
});

test("reordering keeps source draft intact and rejects invalid positions", () => {
  const value = { items: [{ id: "a" }, { id: "b" }] } as ExamDraft;
  assert.deepEqual(
    moveDraftItem(value, 0, 1).items.map((item) => item.id),
    ["b", "a"],
  );
  assert.deepEqual(
    value.items.map((item) => item.id),
    ["a", "b"],
  );
  assert.equal(moveDraftItem(value, -1, 1), value);
  assert.equal(moveDraftItem(value, 0, 2), value);
});

test("saved identity does not change the content signature", () => {
  const value = {
    title: "수업",
    items: [],
    settings: { columns: 2 },
  } as unknown as ExamDraft;
  assert.equal(
    draftSignature(value),
    draftSignature({
      ...value,
      saved: { id: "saved", signature: "old", createdAt: "today" },
    }),
  );
  assert.notEqual(
    draftSignature(value),
    draftSignature({ ...value, title: "다음 수업" }),
  );
});

test("exam copy owns its items and settings independently", () => {
  const exam = {
    title: "수업",
    items: [{ id: "a", name: "문제" }],
    settings: { columns: 2 },
  } as Exam;
  const copy = copyExamDraft(exam);
  copy.items[0].name = "수정";
  copy.settings.columns = 1;
  assert.equal(exam.items[0].name, "문제");
  assert.equal(exam.settings.columns, 2);
  assert.equal(copy.title, "수업 (복사본)");
});

test("registration preserves engine provenance and linked assets", () => {
  const item = {
    id: "q",
    name: " ",
    filename: "original.pdf",
    memo: "memo",
    asset: { id: "asset" },
    source: { kind: "question", pages: [2] },
    fragments: [{ assetId: "fragment" }],
    materialIds: ["material"],
    dependencyIds: ["dependency"],
    sectionId: "section",
    originalLabel: "12",
  } as unknown as PendingQuestion;
  const [record] = registrationRecords([item], "timestamp");
  assert.equal(record.question.name, "original.pdf");
  assert.equal(record.question.source, item.source);
  assert.equal(record.question.fragments, item.fragments);
  assert.deepEqual(record.question.dependencyIds, ["dependency"]);
  assert.equal(record.question.createdAt, "timestamp");
  assert.equal(record.asset, item.asset);
});

test("LOVE screen boundaries keep areas static and actions client-side", () => {
  const root = join(process.cwd(), "src", "screens");
  for (const relative of readdirSync(root, { recursive: true }) as string[]) {
    if (!relative.endsWith(".tsx")) continue;
    const content = readFileSync(join(root, relative), "utf8");
    if (relative.endsWith(".area.tsx")) {
      assert.doesNotMatch(
        content,
        /\bon(?:Click|Change|Submit|Drop|DragOver)=|\buse(?:State|Effect)\(|\basync\s/,
        relative,
      );
    }
    if (relative.endsWith(".action.tsx")) {
      assert.match(content, /^"use client";/, relative);
      assert.doesNotMatch(
        content,
        /from ["']@engine\/(?:db|auth|images|print)["']/,
        relative,
      );
    }
  }
});
