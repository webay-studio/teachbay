/** Actual app JSON adapter. Expected counts/continuations are from the user's
 * reviewed PDF report; no bbox or handwriting mask ground truth is fabricated. */
import fs from "node:fs/promises";
import path from "node:path";
import {
  invert,
  transform,
  type Matrix3,
} from "../lib/documents/registration-graph";
import type { PdfAnalysisResult } from "../lib/pdf-region-engine";
async function main() {
  const dir = process.argv[2] ?? "output/region-regression/after";
  const checks: {
    file: string;
    check: string;
    passed: boolean;
    detail?: unknown;
  }[] = [];
  for (const name of ["1111", "2222"]) {
    const d = JSON.parse(
      await fs.readFile(path.join(dir, name + ".json"), "utf8"),
    ) as PdfAnalysisResult;
    const add = (check: string, passed: boolean, detail?: unknown) =>
      checks.push({ file: name, check, passed, detail });
    add(
      "22 logical questions",
      d.questions?.length === 22,
      d.questions?.length,
    );
    add(
      "physical parts",
      d.questions?.reduce((n, q) => n + q.parts.length, 0) ===
        (name === "1111" ? 24 : 22),
    );
    add(
      "source labels 1..22 exactly once",
      JSON.stringify(
        d.questions?.map((q) => q.sourceNumber).sort((a, b) => a! - b!),
      ) === JSON.stringify(Array.from({ length: 22 }, (_, i) => i + 1)),
    );
    const nativeAnchors = d.pages.flatMap((p) =>
      p.observations.filter(
        (o) =>
          o.source === "pdf" &&
          o.state === "supported" &&
          /^\s*\d+\.\s*$/.test(o.text),
      ),
    );
    add(
      "44-file-set native anchors, 22 per file",
      nativeAnchors.length === 22,
      nativeAnchors.length,
    );
    if (name === "1111")
      for (const n of [14, 18]) {
        const q = d.questions!.find((q) => q.sourceNumber === n)!;
        add(
          `Q${n} continuation`,
          q.parts.length === 2 &&
            q.parts[0].flowRegionId !== q.parts[1].flowRegionId,
        );
      }
    if (name === "2222")
      add(
        "no question in last right column",
        !d.questions!.some((q) =>
          q.parts.some((p) => p.pageIndex === 5 && p.bbox.x > 0.5),
        ),
      );
    const q5 = d.questions!.find((q) => q.sourceNumber === 5)!;
    const options = d.pages.flatMap((p) =>
      p.observations.filter(
        (o) =>
          o.source === "pdf" &&
          /^[①②③④⑤]$/.test(o.text) &&
          q5.parts.some(
            (part) =>
              part.pageIndex === p.index &&
              o.rect.x >= part.bbox.x - 0.002 &&
              o.rect.y >= part.bbox.y - 0.002 &&
              o.rect.x + o.rect.w <= part.bbox.x + part.bbox.width + 0.002 &&
              o.rect.y + o.rect.h <= part.bbox.y + part.bbox.height + 0.002,
          ),
      ),
    );
    add(
      "Q5 five option symbols retained (not a diagram pixel-mask test)",
      new Set(options.map((o) => o.text)).size === 5,
    );
    let roundTripError = 0;
    for (const p of d.pages) {
      const m = p.sourceToAnalysis as Matrix3;
      for (const at of [
        [0, 0],
        [(p as unknown as { width: number }).width, 0],
        [0, (p as unknown as { height: number }).height],
        [
          (p as unknown as { width: number }).width,
          (p as unknown as { height: number }).height,
        ],
      ] as [number, number][]) {
        const back = transform(m, transform(invert(m), at));
        roundTripError = Math.max(
          roundTripError,
          Math.abs(at[0] - back[0]),
          Math.abs(at[1] - back[1]),
        );
      }
    }
    add(
      "actual viewport corner roundtrip",
      roundTripError < 1e-6,
      roundTripError,
    );
    add(
      "all decisions remain reviewable",
      d.questions!.every((q) => q.status === "needs-review"),
    );
  }
  await fs.writeFile(
    path.join(dir, "regression-checks.json"),
    JSON.stringify(
      {
        checks,
        unmeasured: [
          "full bbox ground truth",
          "printed/handwriting pixel masks",
          "all mandatory diagram pixels",
          "total application peak memory",
          "cross-source generalization",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(checks, null, 2));
  if (checks.some((c) => !c.passed)) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
