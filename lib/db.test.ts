import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { all, get, put, remove, saveQuestions, draft } from "./db";
import { defaults } from "./types";
test("persist blobs and snapshots independently of source questions", async () => {
  const asset = {
    id: "asset-one",
    blob: new Blob(["image-bytes"], { type: "image/png" }),
    mime: "image/png",
    width: 1000,
    height: 500,
  };
  const q = {
    id: "question-one",
    name: "original name",
    filename: "one.png",
    memo: "note",
    assetId: asset.id,
    createdAt: "2026-09-18",
    updatedAt: "2026-09-18",
  };
  await saveQuestions([{ question: q, asset }]);
  await put("exams", {
    id: "saved-exam",
    title: "snapshot",
    items: [{ id: q.id, name: q.name, assetId: q.assetId }],
    settings: { ...defaults },
    createdAt: "2026-09-18",
    pages: 1,
  });
  await put("questions", { ...q, name: "renamed" });
  assert.equal(
    (await get("exams", "saved-exam"))!.items[0].name,
    "original name",
  );
  await remove("questions", q.id);
  assert.equal(await get("questions", q.id), undefined);
  assert.equal(
    await (await get("assets", asset.id))!.blob.text(),
    "image-bytes",
  );
  assert.equal((await get("exams", "saved-exam"))!.items.length, 1);
  const original = await get("exams", "saved-exam");
  await put("exams", original!);
  assert.equal((await all("exams")).length, 1);
});
test("draft settings and question order survive a new read", async () => {
  const initial = await draft();
  const edited = {
    ...initial,
    title: "persistent draft",
    items: [
      { id: "second", name: "two", assetId: "b" },
      { id: "first", name: "one", assetId: "a" },
    ],
    settings: { ...defaults, columns: 1 as const, space: "large" as const },
  };
  await put("drafts", edited);
  assert.deepEqual(await draft(), edited);
});
test("document original and all fragment assets survive library deletions", async () => {
  const { snapshotQuestion } = await import("./reuse");
  const material = {
    id: "material-v2",
    name: "material",
    filename: "doc.pdf",
    memo: "",
    assetId: "material-image",
    source: { documentId: "source-v2", kind: "passage" as const, pages: [1] },
    createdAt: "now",
    updatedAt: "now",
  };
  const question = {
    ...material,
    id: "question-v2",
    name: "question",
    assetId: "question-image",
    source: { ...material.source, kind: "question" as const },
    materialIds: [material.id],
  };
  const image = (id: string) => ({
    id,
    blob: new Blob([id]),
    mime: "image/png",
    width: 100,
    height: 200,
  });
  const document = {
    id: "source-v2",
    filename: "doc.pdf",
    blob: new Blob(["original-pdf"], { type: "application/pdf" }),
    sha256: "hash",
    version: 2 as const,
    pages: [],
    items: [material, question],
    relations: [],
  };
  await saveQuestions([
    {
      question,
      asset: image(question.assetId),
      extraAssets: [image(material.assetId)],
      document,
    },
  ]);
  await remove("questions", material.id);
  const stored = (await get("documents", document.id))!;
  assert.equal(await stored.blob.text(), "original-pdf");
  assert.ok(await get("assets", material.assetId));
  assert.equal(
    snapshotQuestion(question, [stored], []).materials![0].assetId,
    material.assetId,
  );
});
