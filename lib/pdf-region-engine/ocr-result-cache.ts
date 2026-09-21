/** Tab-local, bounded cache. Never persists document text or shares it across users. */
export class OCRResultCache<T> {
  private entries = new Map<string, { json: string; bytes: number }>();
  private bytes = 0;
  constructor(private readonly maxBytes = 16 * 1024 * 1024) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    // Callers cannot mutate results used by later passes.
    return JSON.parse(entry.json) as T;
  }

  set(key: string, value: T) {
    const json = JSON.stringify(value),
      bytes = 2 * (json.length + key.length);
    if (bytes > this.maxBytes) return;
    const previous = this.entries.get(key);
    if (previous) this.bytes -= previous.bytes;
    this.entries.delete(key);
    this.entries.set(key, { json, bytes });
    this.bytes += bytes;
    while (this.bytes > this.maxBytes) {
      const oldest = this.entries.entries().next().value!;
      this.bytes -= oldest[1].bytes;
      this.entries.delete(oldest[0]);
    }
  }
}

/** Hash actual pixels, dimensions and all varying recognition parameters.
 * Crop position is intentionally absent: recognition is local; callers apply
 * their own transform and fresh observation IDs even on a cache hit.
 */
export async function ocrPixelKey(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  mode: string,
  digitsOnly: boolean,
) {
  const hash = await crypto.subtle.digest("SHA-256", pixels);
  return (
    `tesseract7-kor-eng-lstm-v1:${width}:${height}:${mode}:${digitsOnly}:` +
    Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}

type Box = { x0: number; y0: number; x1: number; y1: number };
export type CachedOCRLine = {
  text: string;
  confidence: number;
  bbox: Box;
  words: { text: string; confidence: number; bbox: Box }[];
};
// Only fields used by the region engine; no symbol trees, bitmaps or PDF blobs.
export const ocrResults = new OCRResultCache<CachedOCRLine[]>();
