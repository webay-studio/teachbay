/** Compare semantic output, ignoring generated identities and timing telemetry. */
import fs from "node:fs/promises";

const [beforeFile, afterFile, reportFile] = process.argv.slice(2);
const before = JSON.parse(await fs.readFile(beforeFile, "utf8"));
const after = JSON.parse(await fs.readFile(afterFile, "utf8"));
function projection(d) {
  const section = (id) => d.sections?.find((s) => s.id === id)?.label ?? id;
  const question = (id) => {
    const q = d.questions.find((q) => q.id === id);
    return q ? [section(q.sectionId), q.sourceNumber, q.sourceLabel] : id;
  };
  const material = (id) => {
    const s = d.sharedSets?.find((s) => s.id === id);
    return s ? [section(s.sectionId), s.sourceRange] : id;
  };
  const part = (p) => ({
    page: p.pageIndex,
    flow: p.flowRegionId,
    bbox: p.bbox,
    role: p.role,
  });
  return {
    ink: d.pages.map((p) => p.inkPoints),
    ocr: d.pages.map((p) =>
      p.observations
        .filter((o) => o.source === "ocr")
        .map((o) => ({
          text: o.text,
          rect: o.rect,
          confidence: o.confidence,
          passId: o.passId,
        })),
    ),
    questions: d.questions.map((q) => ({
      identity: question(q.id),
      displayNumber: q.displayNumber,
      parts: q.parts.map(part),
      auxiliaryParts: q.auxiliaryParts?.map(part),
      materials: q.sharedMaterialIds.map(material),
      status: q.status,
      issues: q.issues,
    })),
    materials: d.sharedSets?.map((s) => ({
      identity: material(s.id),
      parts: s.parts.map(part),
      questions: s.questionIds.map(question),
    })),
    groups: d.groups.map((g) => ({
      page: g.page,
      label: g.label,
      rect: g.rect,
      role: g.role,
    })),
  };
}
const a = projection(before),
  b = projection(after),
  checks = {};
for (const key of Object.keys(a))
  checks[key] = JSON.stringify(a[key]) === JSON.stringify(b[key]);
const report = {
  beforeFile,
  afterFile,
  checks,
  allEqual: Object.values(checks).every(Boolean),
  finalRegionsEqual: checks.questions && checks.materials && checks.groups,
};
if (reportFile) await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.allEqual) process.exitCode = 1;
