import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { get, put } from "./db";
test("v1 database upgrades without deleting existing questions", async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("teachway", 1);
    r.onupgradeneeded = () => {
      for (const name of ["questions", "assets", "drafts", "exams"])
        r.result.createObjectStore(name, { keyPath: "id" });
    };
    r.onsuccess = () => {
      const d = r.result,
        t = d.transaction("questions", "readwrite");
      t.objectStore("questions").put({
        id: "legacy",
        name: "saved before migration",
      });
      t.oncomplete = () => {
        d.close();
        resolve();
      };
    };
    r.onerror = () => reject(r.error);
  });
  assert.equal(
    (await get("questions", "legacy"))?.name,
    "saved before migration",
  );
  await put("documents", {
    id: "new",
    filename: "new.pdf",
    blob: new Blob(["source"]),
    sha256: "hash",
    version: 2,
    pages: [],
    items: [],
    relations: [],
  });
  assert.equal(await (await get("documents", "new"))!.blob.text(), "source");
});
