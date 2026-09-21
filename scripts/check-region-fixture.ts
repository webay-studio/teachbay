/** Compare real application exports with independently reviewed, 1-based fixture.
 * Usage: node --import tsx scripts/check-region-fixture.ts fixture.json app.json source.pdf document-id
 * Missing ground truth is reported as unmeasured, never a passing assertion.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  invert,
  transform,
  type Matrix3,
} from "../lib/documents/registration-graph";
import type { PdfAnalysisResult } from "../lib/pdf-region-engine";
import type { QuestionPart } from "../lib/documents/question-regions";
type BBox = [number, number, number, number];
type ExpectedQuestion = {
  id: string;
  section: string;
  sourceLabel: string;
  sourceNumber: number;
  parts: { page: number; column: number; role: string }[];
  nativeNumberAnchor?: { page: number; bbox: BBox };
  requiredNativeImages?: {
    page: number;
    role: string;
    choiceNumber: number | null;
    bbox: BBox;
  }[];
};
type Fixture = {
  schemaVersion: number;
  limitations: unknown;
  documents: {
    id: string;
    sha256: string;
    pageCount: number;
    expectedLogicalQuestionCount: number;
    expectedPhysicalPartCount: number;
    pageInventory: { page: number; rotationDegrees: number }[];
    questions: ExpectedQuestion[];
  }[];
};
async function main() {
  const [fixtureFile, appFile, pdfFile, documentId] = process.argv.slice(2);
  if (!documentId)
    throw new Error(
      "fixture.json app.json source.pdf document-id 인자가 필요합니다.",
    );
  const fixture: Fixture = JSON.parse(await fs.readFile(fixtureFile, "utf8"));
  const expected = fixture.documents.find((d) => d.id === documentId);
  if (fixture.schemaVersion !== 1 || !expected)
    throw new Error("지원하지 않는 fixture 또는 문서 ID");
  const actual = JSON.parse(await fs.readFile(appFile, "utf8")) as Omit<
    PdfAnalysisResult,
    "pages"
  > & {
    pages: (PdfAnalysisResult["pages"][number] & {
      width: number;
      height: number;
    })[];
  };
  const checks: { check: string; passed: boolean; detail?: unknown }[] = [];
  const add = (check: string, passed: boolean, detail?: unknown) =>
    checks.push({ check, passed, detail });
  const hash = createHash("sha256")
    .update(await fs.readFile(pdfFile))
    .digest("hex");
  if (hash !== expected.sha256)
    throw new Error(
      `원본 SHA-256 불일치: ${hash} (fixture 결과로 비교하지 않음)`,
    );
  add("same source PDF SHA-256", true, hash);
  add(
    "page count",
    actual.pages.length === expected.pageCount,
    actual.pages.length,
  );
  const qs = actual.questions ?? [];
  add(
    "logical question count",
    qs.length === expected.expectedLogicalQuestionCount,
    qs.length,
  );
  add(
    "physical part count",
    qs.reduce((n, q) => n + q.parts.length, 0) ===
      expected.expectedPhysicalPartCount,
    qs.reduce((n, q) => n + q.parts.length, 0),
  );
  const column = (part: QuestionPart) =>
    actual.flowRegions?.find((f) => f.id === part.flowRegionId)?.order ?? null;
  const contains = (
    part: QuestionPart,
    page: number,
    b: BBox,
    tolerance = 0.002,
  ) =>
    part.pageIndex === page - 1 &&
    part.bbox.x <= b[0] + tolerance &&
    part.bbox.y <= b[1] + tolerance &&
    part.bbox.x + part.bbox.width >= b[2] - tolerance &&
    part.bbox.y + part.bbox.height >= b[3] - tolerance;
  const used = new Set<string>();
  for (const e of expected.questions) {
    // Use section identity only for repeated source numbering. Do not use expected
    // page/column to select a conveniently matching detection.
    const matches = qs.filter(
      (q) =>
        q.sourceNumber === e.sourceNumber &&
        (e.section === "descriptive"
          ? q.sectionId.startsWith("essay")
          : !q.sectionId.startsWith("essay")),
    );
    add(
      `${e.id}: one source number in section`,
      matches.length === 1,
      matches.length,
    );
    if (matches.length !== 1) continue;
    const q = matches[0];
    used.add(q.id);
    const parts = q.parts.map((p) => ({
      page: p.pageIndex + 1,
      column: column(p),
      role: p.role,
    }));
    add(
      `${e.id}: ordered page/column/role`,
      JSON.stringify(parts) === JSON.stringify(e.parts),
      { expected: e.parts, actual: parts },
    );
    add(`${e.id}: original label retained`, q.sourceLabel === e.sourceLabel, {
      expected: e.sourceLabel,
      actual: q.sourceLabel,
    });
    if (e.nativeNumberAnchor) {
      const a = e.nativeNumberAnchor,
        cx = (a.bbox[0] + a.bbox[2]) / 2,
        cy = (a.bbox[1] + a.bbox[3]) / 2;
      const obs = actual.pages[a.page - 1].observations.filter(
        (o) =>
          o.source === "pdf" &&
          o.state === "supported" &&
          Number(o.text.replace(/[.．、\s]/g, "")) === e.sourceNumber &&
          Math.abs(o.rect.x + o.rect.w / 2 - cx) < 0.008 &&
          Math.abs(o.rect.y + o.rect.h / 2 - cy) < 0.008,
      );
      add(
        `${e.id}: supported native number at fixture anchor`,
        obs.length > 0,
        obs.length,
      );
    }
    for (const im of e.requiredNativeImages ?? [])
      add(
        `${e.id}: ${im.role} ${im.choiceNumber ?? ""} enclosed`,
        q.parts.some((p) => contains(p, im.page, im.bbox)),
        im.bbox,
      );
  }
  add(
    "no unmatched extra logical questions",
    qs.every((q) => used.has(q.id)),
    qs
      .filter((q) => !used.has(q.id))
      .map((q) => ({ number: q.sourceNumber, section: q.sectionId })),
  );
  let maxRoundtripError = 0;
  for (const e of expected.pageInventory) {
    const p = actual.pages[e.page - 1];
    if (!p) continue;
    add(
      `page ${e.page}: rotation`,
      p.coordinateFrames.rotation === e.rotationDegrees,
      p.coordinateFrames.rotation,
    );
    const m = p.sourceToAnalysis as Matrix3;
    const points: [[number, number], ...[number, number][]] = [
      [0, 0],
      [p.width, 0],
      [0, p.height],
      [p.width, p.height],
      ...p.observations
        .slice(0, 20)
        .map(
          (o) => [o.rect.x * p.width, o.rect.y * p.height] as [number, number],
        ),
    ];
    for (const at of points) {
      const back = transform(m, transform(invert(m), at));
      maxRoundtripError = Math.max(
        maxRoundtripError,
        Math.abs(back[0] - at[0]),
        Math.abs(back[1] - at[1]),
      );
    }
  }
  add(
    "actual rotation matrices: corners/observations roundtrip",
    maxRoundtripError < 1e-6,
    maxRoundtripError,
  );
  add(
    "screen groups and exported logical parts use same bbox",
    qs.every((q) =>
      q.parts.every((p) => {
        const g = actual.groups.find((g) => g.id === p.id);
        return (
          g &&
          Math.max(
            Math.abs(g.rect.x - p.bbox.x),
            Math.abs(g.rect.y - p.bbox.y),
            Math.abs(g.rect.w - p.bbox.width),
            Math.abs(g.rect.h - p.bbox.height),
          ) < 1e-9
        );
      }),
    ),
  );
  const report = {
    fixtureFile,
    appFile,
    documentId,
    checks,
    summary: {
      passed: checks.filter((c) => c.passed).length,
      failed: checks.filter((c) => !c.passed).length,
    },
    unmeasured: [
      "Full question bbox ground truth",
      "Printed/handwriting pixel masks and overlap loss",
      "Semantic completeness except provided required image boxes",
      "User correction time",
      "Total browser/process/GPU peak memory",
      "Generalization to new sources",
    ],
    fixtureLimitations: fixture.limitations,
  };
  const out = path.join(
    path.dirname(appFile),
    `${documentId}-fixture-checks.json`,
  );
  await fs.writeFile(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        report: out,
        ...report.summary,
        failures: checks.filter((c) => !c.passed),
      },
      null,
      2,
    ),
  );
  if (report.summary.failed) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
