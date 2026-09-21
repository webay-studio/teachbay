import test from "node:test";
import assert from "node:assert/strict";
import { abortable } from "./cancel";
test("cancellation releases an OCR job even when the worker never settles", async () => {
  const controller = new AbortController();
  const operation = abortable(new Promise<void>(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(operation, { name: "AbortError" });
});
test("normal completion and pre-cancelled imports settle correctly", async () => {
  const c = new AbortController();
  assert.equal(await abortable(Promise.resolve(4), c.signal), 4);
  c.abort();
  await assert.rejects(abortable(Promise.resolve(5), c.signal), {
    name: "AbortError",
  });
});
