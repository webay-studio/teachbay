import test from "node:test";
import assert from "node:assert/strict";
import type { Worker } from "tesseract.js";
import { recognizeRegions } from "./ocr";
test("OCR diagnostics are captured per request without hiding recognition failures", async () => {
  const requested: unknown[] = [],
    diagnostics: string[] = [];
  const worker = {
    setParameters: async () => {},
    recognize: async (_image: unknown, _options: unknown, output: unknown) => {
      requested.push(output);
      return { data: { debug: "Estimating resolution as 309", blocks: [] } };
    },
  } as unknown as Worker;
  await recognizeRegions(
    worker,
    [],
    100,
    100,
    async () => Buffer.alloc(0),
    undefined,
    (message) => diagnostics.push(message),
  );
  assert.equal(requested.length, 2);
  assert.ok(requested.every((x) => (x as { debug: boolean }).debug));
  assert.equal(diagnostics.length, 2);
  const broken = {
    setParameters: async () => {},
    recognize: async () => {
      throw new Error("recognition failed");
    },
  } as unknown as Worker;
  await assert.rejects(
    recognizeRegions(broken, [], 100, 100, async () => Buffer.alloc(0)),
    /recognition failed/,
  );
});
