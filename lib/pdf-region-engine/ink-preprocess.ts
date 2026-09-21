/** Colour-based ink suppression for an analysis copy only.
 * This is NOT a handwriting classifier. Printed red/blue content may also change.
 * No dilation, inpainting, or reconstruction of obscured text is performed.
 */
export type InkStats = {
  algorithm: "red-blue-hsv-v1";
  changedPixels: number;
  totalPixels: number;
  changedRatio: number;
  darkPixelsPreserved: true;
};
export async function suppressColoredInk(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<InkStats> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  let changedPixels = 0;
  for (let y = 0; y < canvas.height; y++) {
    if (y % 128 === 0) {
      if (signal.aborted)
        throw new DOMException("취소되었습니다.", "AbortError");
      // Yield to allow the cancel button to interrupt larger pages.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        delta = max - min;
      // Preserve near-black and low-chroma pixels, including most black print.
      if (max < 90 || delta < 40 || delta / max < 0.28) continue;
      let hue =
        max === r
          ? ((g - b) / delta) % 6
          : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4;
      hue = (hue * 60 + 360) % 360;
      const red = hue <= 22 || hue >= 340;
      const blue = hue >= 195 && hue <= 260;
      if (!red && !blue) continue;
      // Replace only selected pixels; do not expand the mask into adjacent maths.
      data[i] = data[i + 1] = data[i + 2] = 255;
      changedPixels++;
    }
  }
  if (signal.aborted) throw new DOMException("취소되었습니다.", "AbortError");
  ctx.putImageData(frame, 0, 0);
  const totalPixels = canvas.width * canvas.height;
  return {
    algorithm: "red-blue-hsv-v1",
    changedPixels,
    totalPixels,
    changedRatio: changedPixels / totalPixels,
    darkPixelsPreserved: true,
  };
}
