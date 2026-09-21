import test from "node:test";
import assert from "node:assert/strict";
import { OCRResultCache, ocrPixelKey } from "./ocr-result-cache";

test("OCR cache separates pixels, dimensions, segmentation and whitelist", async () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  const key = await ocrPixelKey(pixels, 2, 1, "3", false);
  assert.equal(key, await ocrPixelKey(pixels.slice(), 2, 1, "3", false));
  const changed = pixels.slice();
  changed[0] = 1;
  for (const other of await Promise.all([
    ocrPixelKey(changed, 2, 1, "3", false),
    ocrPixelKey(pixels, 1, 2, "3", false),
    ocrPixelKey(pixels, 2, 1, "11", false),
    ocrPixelKey(pixels, 2, 1, "3", true),
  ]))
    assert.notEqual(other, key);
});

test("bounded OCR cache evicts least recently used and isolates caller mutations", () => {
  const cache = new OCRResultCache<{ text: string }>(70);
  const value = { text: "a" };
  cache.set("a", value);
  cache.set("b", { text: "b" });
  value.text = "changed";
  const read = cache.get("a")!;
  assert.equal(read.text, "a");
  read.text = "edited";
  cache.set("c", { text: "c" });
  assert.equal(cache.get("b"), undefined);
  assert.deepEqual(cache.get("a"), { text: "a" });
  cache.set("huge", { text: "x".repeat(100) });
  assert.equal(cache.get("huge"), undefined);
  assert.deepEqual(cache.get("c"), { text: "c" });
});

test("empty OCR output is reusable; missing results are distinct", () => {
  const cache = new OCRResultCache<unknown[]>();
  assert.equal(cache.get("missing"), undefined);
  cache.set("blank", []);
  assert.deepEqual(cache.get("blank"), []);
});
