import type { StructureResult, EvidenceLine, RegionGroup } from "./structure";
import type { PdfAnalysisPage } from "./types";
import type {
  QuestionRegion,
  QuestionPart,
  SharedSet,
  DocumentSection,
  FlowRegion,
  ContentBlock,
} from "./question-regions";
import { boxOf, rectOf } from "./question-regions";
import { buildBlocks, union, overlap } from "./layout-blocks";
import { readQuestionNumber } from "./question-number";
import type { Rect } from "./base-types";
export function readSharedRange(text: string): [number, number] | undefined {
  const m =
    /^\s*[\[［【(]?\s*(\d{1,3})\s*[~～〜–—-]\s*(\d{1,3})\s*[\]］】)]?/.exec(
      text,
    );
  if (!m || +m[1] >= +m[2] || +m[2] - +m[1] > 100) return;
  if (
    !/[\[［【(]/.test(m[0]) &&
    !/다음|물음|읽|답하|passage|questions/i.test(text)
  )
    return;
  return [+m[1], +m[2]];
}
// Small OCR spelling errors are matched against section labels, never document-specific glyphs.
const editDistance = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])),
      );
    row = next;
  }
  return row[b.length];
};
const headerSubject = (text: string) =>
  ["화법과작문", "언어와매체"]
    .map((label) => ({
      label,
      score: Math.min(
        ...Array.from(
          { length: Math.max(0, text.length - label.length + 1) },
          (_, i) => editDistance(text.slice(i, i + label.length), label),
        ),
      ),
    }))
    .filter((x) => x.score <= 1)
    .sort((a, b) => a.score - b.score)[0]?.label;
const header = (l: EvidenceLine) =>
  l.y < 0.2 &&
  /국\s*어\s*영\s*역|학년도|시험지|제\s*\d+\s*교시|홀수형|짝수형/.test(l.text);
const footer = (l: EvidenceLine) =>
  l.y > 0.9 &&
  (/저작권|교육과정평가원/.test(l.text) || /^\s*[\d\s/\[\]|-]+$/.test(l.text));
const within = (a: Rect, b: Rect) =>
  a.x >= b.x - 0.005 && a.x + a.w <= b.x + b.w + 0.005;
const inRaster = (l: Rect, p: Partial<PdfAnalysisPage>) =>
  p.containers?.some(
    (c) =>
      c.rect.w > 0.08 &&
      c.rect.w < 0.8 &&
      c.rect.h < 0.85 &&
      overlap(l, c.rect) > 0.85 * l.w * l.h,
  );
/** Document ownership pass. Activated by observed printed range headings, never a file name or fixture. */
export function assignDocumentOwnership(
  base: StructureResult,
  pages: (Partial<PdfAnalysisPage> & {
    asset: PdfAnalysisPage["asset"];
    inkPoints: Rect[];
  })[],
): StructureResult {
  const source = base.lines.filter((l) => !l.duplicateOf);
  // A bracketed numeric interval can be a formula or an OCR artifact. Enter this
  // ownership pass only when a range has an observed reading/question instruction.
  const hasMaterialPrompt = (l: EvidenceLine) =>
    /다음|물음|읽고|답하시오|passage|questions|following/i.test(
      source
        .filter(
          (x) =>
            x.page === l.page &&
            Math.abs(x.y - l.y) < Math.max(x.h, l.h) * 0.6 &&
            x.x >= l.x - 0.005,
        )
        .map((x) => x.text)
        .join(" "),
    );
  if (!source.some((l) => readSharedRange(l.text) && hasMaterialPrompt(l)))
    return base;
  const sections: DocumentSection[] = [],
    pageMetadata: NonNullable<StructureResult["pageMetadata"]> = [],
    instructions: NonNullable<StructureResult["instructions"]> = [];
  let section: DocumentSection | undefined;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const top = source.filter((l) => l.page === pageIndex && l.y < 0.2),
      text = top
        .map((l) => l.text)
        .join(" ")
        .replace(/\s/g, "");
    const subject = headerSubject(text);
    const label =
      subject === "화법과작문"
        ? "화법과 작문"
        : subject === "언어와매체"
          ? "언어와 매체"
          : /국어영역/.test(text)
            ? "공통"
            : (section?.label ?? "본문");
    if (!section || label !== section.label) {
      section = {
        id: crypto.randomUUID(),
        label,
        kind:
          label === "공통"
            ? "common"
            : ["화법과 작문", "언어와 매체"].includes(label)
              ? "option"
              : "unknown",
        pageIndices: [],
      };
      sections.push(section);
    }
    section.pageIndices.push(pageIndex);
    const printed = (pages[pageIndex].observations ?? [])
      .filter(
        (o) =>
          /^\d{1,3}$/.test(o.text.trim()) &&
          Number(o.text) > 0 &&
          o.rect.y < 0.12 &&
          (o.rect.x < 0.2 || o.rect.x > 0.8) &&
          o.rect.h > 0.015 &&
          o.state === "supported",
      )
      .sort(
        (a, b) =>
          (b.confidence ?? 0) - (a.confidence ?? 0) || b.rect.w - a.rect.w,
      )[0];
    pageMetadata.push({
      pageIndex,
      sectionId: section.id,
      printedSectionPage: printed ? Number(printed.text.trim()) : null,
    });
  }
  const questions: QuestionRegion[] = [],
    sharedSets: SharedSet[] = [],
    groups: RegionGroup[] = [],
    blocks: ContentBlock[] = [];
  let owner: QuestionRegion | SharedSet | undefined,
    lastSection = "";
  const flows = (base.flowRegions ?? [])
    .map((f) => ({ ...f, rect: { ...f.rect } }))
    .sort((a, b) => a.pageIndex - b.pageIndex || a.order - b.order);
  // Outer lane bounds can follow indented prose and omit hanging question numbers.
  // Recover extents from body observations within the existing gutter, not a page template.
  for (const flow of flows) {
    const peers = flows.filter((f) => f.pageIndex === flow.pageIndex),
      i = peers.indexOf(flow);
    const lo = i
      ? (peers[i - 1].rect.x + peers[i - 1].rect.w + flow.rect.x) / 2
      : 0;
    const hi =
      i + 1 < peers.length
        ? (flow.rect.x + flow.rect.w + peers[i + 1].rect.x) / 2
        : 1;
    const rects = [
      ...source.filter((l) => l.page === flow.pageIndex),
      ...(pages[flow.pageIndex].observations ?? [])
        .filter((o) => o.geometryStatus === "usable")
        .map((o) => o.rect),
    ].filter(
      (r) =>
        r.y > 0.12 &&
        r.y + r.h < 0.91 &&
        r.x >= lo &&
        r.x + r.w <= hi &&
        r.w < (hi - lo) * 1.05,
    );
    if (rects.length) {
      const x = Math.max(
          lo,
          Math.min(flow.rect.x, ...rects.map((r) => r.x)) - 0.003,
        ),
        right = Math.min(
          hi,
          Math.max(flow.rect.x + flow.rect.w, ...rects.map((r) => r.x + r.w)) +
            0.003,
        );
      flow.rect = { ...flow.rect, x, w: right - x };
    }
  }
  for (const flow of flows) {
    const p = pages[flow.pageIndex],
      sid = pageMetadata[flow.pageIndex].sectionId;
    if (sid !== lastSection) {
      owner = undefined;
      lastSection = sid;
    }
    const all = source.filter(
      (l) => l.page === flow.pageIndex && within(l, flow.rect),
    );
    const margins = source.filter(
      (l) => l.page === flow.pageIndex && (header(l) || footer(l)),
    );
    let headerBottom = Math.max(
      flow.rect.y,
      ...margins.filter(header).map((l) => l.y + l.h + 0.003),
    );
    const firstBodyAnchor = Math.min(
      1,
      ...source
        .filter(
          (l) =>
            l.page === flow.pageIndex &&
            l.y >= headerBottom &&
            !header(l) &&
            (readSharedRange(l.text) ||
              /^\s*\d{1,3}\s*[.．]\s*[가-힣A-Za-z(<]/.test(l.text)),
        )
        .map((l) => l.y),
    );
    if (margins.some(header))
      headerBottom = Math.max(
        headerBottom,
        ...(p.horizontalRules ?? [])
          .filter(
            (r) =>
              r.y >= headerBottom - 0.01 && r.y < firstBodyAnchor && r.y < 0.25,
          )
          .map((r) => r.y + r.h + 0.002),
      );
    const footerFrames = (p.visualRegions ?? []).filter(
      (r) =>
        r.y > 0.9 &&
        r.w < 0.2 &&
        r.h < 0.05 &&
        margins.filter(footer).some((m) => overlap(r, m) > 0.8 * m.w * m.h),
    );
    const footerTop = Math.min(
      flow.rect.y + flow.rect.h,
      ...footerFrames.map((r) => r.y - 0.003),
      ...margins.filter(footer).map((l) => l.y - 0.003),
      ...(p.observations ?? [])
        .filter(
          (o) =>
            o.source === "ocr" &&
            o.rect.y > 0.9 &&
            o.rect.x > 0.4 &&
            o.rect.x + o.rect.w < 0.6 &&
            /^\d{1,3}$/.test(o.text.trim()),
        )
        .map((o) => o.rect.y - 0.003),
    );
    const inBody = (r: Rect) =>
      r.y + r.h / 2 >= headerBottom && r.y < footerTop;
    const body = all.filter(
      (l) =>
        inBody(l) &&
        !header(l) &&
        !footer(l) &&
        !margins.some(
          (m) =>
            Math.abs(l.y + l.h / 2 - (m.y + m.h / 2)) <
            Math.min(l.h, m.h) * 0.45,
        ),
    );
    const starts = (base.questions ?? []).flatMap((q) =>
      q.parts
        .filter(
          (part) =>
            part.flowRegionId === flow.id && part.role !== "continuation",
        )
        .map((part) => ({ q, part })),
    );
    const numbered = body.filter(
      (l) =>
        /^\s*\d{1,3}\s*[.．、]\s*\D/.test(l.text) &&
        readQuestionNumber(l.text) &&
        !inRaster(l, p),
    );
    const xs = [
      ...starts.map((s) => s.part.bbox.x),
      ...numbered
        .filter((l) => l.x < flow.rect.x + flow.rect.w * 0.25)
        .map((l) => l.x),
    ].sort((a, b) => a - b);
    const left = xs.length ? xs[Math.floor(xs.length * 0.25)] : flow.rect.x;
    const markers = numbered
      .filter(
        (l) => Math.abs(l.x - left) < 0.018 && /[가-힣a-z]{2}/i.test(l.text),
      )
      .sort((a, b) => {
        const support = (l: EvidenceLine) =>
          starts.some(
            (s) =>
              s.q.sourceNumber === Number(readQuestionNumber(l.text)) &&
              Math.abs(s.part.bbox.y - l.y) < 0.025,
          )
            ? 1000
            : 0;
        return (
          support(b) - support(a) + (b.confidence ?? 0) - (a.confidence ?? 0)
        );
      });
    const anchors: EvidenceLine[] = [];
    for (const l of markers)
      if (!anchors.some((a) => Math.abs(a.y - l.y) < Math.max(a.h, l.h) * 0.65))
        anchors.push(l);
    for (const { q, part } of starts) {
      if (
        q.sourceNumber === null ||
        anchors.some((a) => Math.abs(a.y - part.bbox.y) < 0.025) ||
        inRaster(rectOf(part.bbox), p)
      )
        continue;
      const l = body.find(
        (l) =>
          Number(readQuestionNumber(l.text)) === q.sourceNumber &&
          Math.abs(l.y - part.bbox.y) < 0.035 &&
          Math.abs(l.x - left) < 0.025,
      );
      if (l && !inRaster(l, p)) anchors.push(l);
    }
    const rangeLines = body
      .filter(
        (l) =>
          readSharedRange(l.text) &&
          !inRaster(l, p) &&
          l.x < flow.rect.x + flow.rect.w * 0.3,
      )
      .sort((a, b) => a.y - b.y);
    const ranges = rangeLines.filter(
      (l, i) => !rangeLines.slice(0, i).some((x) => Math.abs(x.y - l.y) < 0.02),
    );
    const instruction = body
      .filter((l) => /확인사항/.test(l.text.replace(/\s/g, "")))
      .filter(
        (l, i, ls) => !ls.slice(0, i).some((x) => Math.abs(x.y - l.y) < 0.015),
      );
    const instructionBox = (l: EvidenceLine) =>
      [...(p.visualRegions ?? []), ...p.inkPoints]
        .filter(
          (r) =>
            within(r, flow.rect) &&
            r.w > 0.1 &&
            r.h > 0.02 &&
            l.y >= r.y &&
            l.y + l.h <= r.y + r.h &&
            l.y - r.y < l.h * 2 &&
            overlap(l, r) > 0.8 * l.w * l.h,
        )
        .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    type Event = {
      y: number;
      line: EvidenceLine;
      kind: "question" | "set" | "instruction";
    };
    const events: Event[] = [
      ...anchors.map((line) => ({
        y: line.y,
        line,
        kind: "question" as const,
      })),
      ...ranges.map((line) => ({ y: line.y, line, kind: "set" as const })),
      ...instruction.map((line) => ({
        y: instructionBox(line)?.y ?? line.y,
        line,
        kind: "instruction" as const,
      })),
    ].sort((a, b) => a.y - b.y);
    const heights = body
        .filter((l) => l.h < 0.03)
        .map((l) => l.h)
        .sort((a, b) => a - b),
      h = heights[Math.floor(heights.length / 2)] || 0.012;
    const geometry = (p.observations ?? [])
      .filter(
        (o) =>
          o.source === "pdf" &&
          o.geometryStatus === "usable" &&
          o.textStatus !== "usable" &&
          !margins.some((m) => overlap(o.rect, m) > 0.5 * o.rect.w * o.rect.h),
      )
      .map((o) => o.rect);
    const bs = buildBlocks(
      flow,
      body.map((l) => ({
        ...l,
        role: l.role === "margin" ? "unassigned" : l.role,
      })),
      p.inkPoints.filter(inBody),
      p.asset.height / p.asset.width,
      h,
      undefined,
      [...(p.visualRegions ?? []), ...geometry].filter(inBody),
    );
    blocks.push(...bs);
    const addPart = (
      target: QuestionRegion | SharedSet | undefined,
      top: number,
      bottom: number,
    ) => {
      if (!target) return;
      const selected = bs.filter(
        (b) =>
          b.rect.y + b.rect.h > top &&
          b.rect.y < bottom &&
          b.rect.y >= top - h * 0.5 &&
          !margins.some(
            (m) =>
              Math.abs(b.rect.y + b.rect.h / 2 - m.y - m.h / 2) <
              Math.min(b.rect.h, m.h) * 0.45,
          ),
      );
      if (!selected.length) return;
      const part: QuestionPart = {
        id: crypto.randomUUID(),
        pageIndex: flow.pageIndex,
        flowRegionId: flow.id,
        bbox: boxOf(union(selected.map((b) => b.rect))),
        role: target.parts.length ? "continuation" : "whole",
        sourceBlockIds: selected.map((b) => b.id),
      };
      if (target.parts.length && target.parts[0].role === "whole")
        target.parts[0].role = "start";
      if (selected.some((b) => b.rect.y + b.rect.h > bottom + 0.003))
        target.issues.push("소유 경계를 걸친 블록: 원본 확인 필요");
      target.parts.push(part);
      if ("sourceNumber" in target) {
        const containers = [
          ...(p.containers ?? [])
            .filter((c) => c.rect.w > 0.04 && c.rect.h > 0.018)
            .map((c) => c.rect),
          ...(p.visualRegions ?? []).filter((r) => r.w > 0.07 && r.h > 0.03),
          ...p.inkPoints.filter((r) => r.w > 0.1 && r.h > 0.03),
        ].sort((a, b) => b.w * b.h - a.w * a.h);
        for (const r of containers.filter(
          (r) => within(r, flow.rect) && r.y >= top && r.y + r.h <= bottom,
        )) {
          if (
            target.auxiliaryParts?.some(
              (a) => overlap(rectOf(a.bbox), r) > 0.9 * r.w * r.h,
            )
          )
            continue;
          target.auxiliaryParts ??= [];
          target.auxiliaryParts.push({
            ...part,
            id: crypto.randomUUID(),
            bbox: boxOf(r),
            role: "whole",
          });
        }
      }
    };
    let top = headerBottom;
    for (const e of events) {
      if (e.kind === "question") {
        const n = Number(readQuestionNumber(e.line.text)),
          last = questions.filter((q) => q.sectionId === sid).at(-1);
        const waiting = owner && "sourceRange" in owner ? owner : undefined;
        if (
          (waiting &&
            (n < waiting.sourceRange[0] || n > waiting.sourceRange[1])) ||
          (last && n <= (last.sourceNumber ?? 0))
        ) {
          owner?.issues.push(
            `문항으로 확정하지 않은 내부 숫자 ${n}: 범위·섹션 순서와 충돌`,
          );
          continue;
        }
      }
      addPart(owner, top, e.y - 0.002);
      if (e.kind === "set") {
        const set: SharedSet = {
          id: crypto.randomUUID(),
          sectionId: sid,
          sourceRange: readSharedRange(e.line.text)!,
          parts: [],
          questionIds: [],
          issues: ["원문 범위 머리말과 읽기 순서에 따른 공통 자료: 확인 필요"],
          status: "needs-review",
        };
        sharedSets.push(set);
        owner = set;
      } else if (e.kind === "question") {
        const n = Number(readQuestionNumber(e.line.text));
        const q: QuestionRegion = {
          id: crypto.randomUUID(),
          sectionId: sid,
          sourceLabel:
            e.line.text.trim().match(/^\d+\s*[.．、]?/)?.[0] ?? String(n),
          sourceNumber: n,
          displayNumber:
            questions.filter((q) => q.sectionId === sid).length + 1,
          parts: [],
          auxiliaryParts: [],
          sharedMaterialIds: [],
          status: "needs-review",
          issues: ["지문 소속·보기·선택지 보존 확인 필요"],
        };
        questions.push(q);
        owner = q;
      } else {
        instructions.push({
          id: crypto.randomUUID(),
          pageIndex: flow.pageIndex,
          rect: {
            x: flow.rect.x,
            y: e.y,
            w: flow.rect.w,
            h: flow.rect.y + flow.rect.h - e.y,
          },
          text: e.line.text,
        });
        owner = undefined;
      }
      top = e.y - 0.002;
    }
    addPart(owner, top, footerTop);
  }
  // Range association is section-scoped and tied to a preceding observed set.
  const rank = (part: QuestionPart) =>
    flows.findIndex((f) => f.id === part.flowRegionId) * 2 + part.bbox.y;
  for (const q of questions.filter((q) => q.parts.length)) {
    const set = sharedSets
      .filter(
        (s) =>
          s.sectionId === q.sectionId &&
          s.parts.length &&
          q.sourceNumber !== null &&
          q.sourceNumber >= s.sourceRange[0] &&
          q.sourceNumber <= s.sourceRange[1] &&
          rank(s.parts[0]) <= rank(q.parts[0]),
      )
      .at(-1);
    if (set) {
      q.sharedMaterialIds = [set.id];
      set.questionIds.push(q.id);
    }
  }
  for (const [pageIndex, p] of pages.entries())
    for (const c of p.containers ?? []) {
      const matches = [...sharedSets, ...questions].filter((owner) =>
        owner.parts.some(
          (part) =>
            part.pageIndex === pageIndex &&
            overlap(rectOf(part.bbox), c.rect) > 0.99 * c.rect.w * c.rect.h,
        ),
      );
      c.ownerId = matches.length === 1 ? matches[0].id : undefined;
    }
  for (const target of [...sharedSets, ...questions])
    for (const [i, part] of target.parts.entries()) {
      const question = "sourceNumber" in target;
      groups.push({
        id: part.id,
        questionId: target.id,
        page: part.pageIndex,
        flowRegionId: part.flowRegionId,
        partRole: part.role,
        partIndex: i + 1,
        kind: question ? "question" : "material",
        section: target.sectionId,
        questionNumber: question ? target.sourceNumber : null,
        originalNumber: question ? (target.sourceLabel ?? "") : "",
        label: question
          ? `${target.sourceNumber}번`
          : `공통 지문 ${target.sourceRange[0]}–${target.sourceRange[1]}`,
        lineIds: blocks
          .filter((b) => part.sourceBlockIds.includes(b.id))
          .flatMap((b) => b.lineIds),
        rect: rectOf(part.bbox),
        reasons: ["문서 읽기 순서와 소유 경계"],
        warnings: target.issues,
        status: "incomplete",
      });
    }
  return {
    ...base,
    flowRegions: flows,
    questions: questions.filter((q) => q.parts.length),
    sharedSets,
    sections,
    pageMetadata,
    instructions,
    groups,
    blocks,
    relations: [
      ...sharedSets.flatMap((s) =>
        s.questionIds.map((id) => ({
          from: id,
          to: s.id,
          kind: "needs_material" as const,
          state: "candidate" as const,
          reason: "같은 섹션의 원문 범위 머리말",
        })),
      ),
      ...[...sharedSets, ...questions].flatMap((owner) =>
        owner.parts.slice(1).map((part, i) => ({
          from: owner.parts[i].id,
          to: part.id,
          kind: "possible_continuation" as const,
          state: "candidate" as const,
          reason: "읽기 영역을 넘어 이어지는 동일 소유 자료: 원문 확인 필요",
        })),
      ),
    ],
  };
}
export function selectDocumentContent(result: StructureResult, ids: string[]) {
  if (
    !ids.length ||
    ids.some((id) => !result.questions?.some((q) => q.id === id))
  )
    throw new Error("유효한 문항을 선택해주세요.");
  const qs = (result.questions ?? []).filter((q) => ids.includes(q.id)),
    seen = new Set<string>();
  const items: {
    kind: "material" | "question";
    id: string;
    parts: QuestionPart[];
  }[] = [];
  for (const q of qs) {
    for (const id of q.sharedMaterialIds) {
      if (seen.has(id)) continue;
      const s = result.sharedSets?.find((s) => s.id === id);
      if (!s) throw new Error("필요한 공통 자료가 없습니다.");
      items.push({ kind: "material", id, parts: s.parts });
      seen.add(id);
    }
    items.push({ kind: "question", id: q.id, parts: q.parts });
  }
  return { items, status: "needs-review", originalNumbersPreserved: true };
}

/** Keep displayed and exported crop coordinates synchronized for either owner type. */
export function updateDocumentPart<T extends StructureResult>(
  result: T,
  id: string,
  rect: Rect,
): T {
  if (
    ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.w <= 0 ||
    rect.h <= 0 ||
    rect.x + rect.w > 1.000001 ||
    rect.y + rect.h > 1.000001
  )
    throw new Error("페이지 안의 유효한 영역을 지정해주세요.");
  const update = <U extends { parts: QuestionPart[]; issues: string[] }>(
    owner: U,
  ): U => ({
    ...owner,
    parts: owner.parts.map((p) =>
      p.id === id ? { ...p, bbox: boxOf(rect) } : p,
    ),
    issues: owner.parts.some((p) => p.id === id)
      ? [
          ...new Set([
            ...owner.issues,
            "사용자가 경계를 조정함: 내용 보존 재확인 필요",
          ]),
        ]
      : owner.issues,
  });
  return {
    ...result,
    groups: result.groups.map((g) => (g.id === id ? { ...g, rect } : g)),
    questions: result.questions?.map(update),
    sharedSets: result.sharedSets?.map(update),
  };
}
