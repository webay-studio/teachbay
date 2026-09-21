import {
  readQuestionNumber,
  validateQuestionNumbers,
  type NumberDecision,
} from "./question-number";
import type { Rect } from "./base-types";
import type { StructureResult, RegionGroup, EvidenceLine } from "./structure";
import type { PdfAnalysisPage } from "./types";
import {
  buildBlocks,
  isOption,
  isMaterial,
  isFormula,
  union,
  overlap,
} from "./layout-blocks";
import {
  boxOf,
  rectOf,
  type QuestionRegion,
  type QuestionPart,
  type FlowRegion,
  type ContentBlock,
} from "./question-regions";
export type HybridDiagnostics = {
  page: number;
  unassignedGroups: string[];
  unassignedInk: number;
  distance: number;
  clusters: number;
  ocrLines: number;
  starts: number;
  textGroups: number;
  displayedGroups: number;
  lanes: number;
  crossColumnLines: number;
  numberDecisions: NumberDecision[];
};
const med = (ns: number[]) =>
  [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] || 0.012;
const numberOnly = (s: string) => /^\s*[1-9]\d{0,2}[.．、]\s*$/.test(s);
const heading = (s: string) =>
  /학교|학년도|시험지|고사|저작권|복제|배포|유의사항|^\s*\d+\s*\/\s*\d+\s*$/.test(
    s,
  );
function getFlows(
  page: number,
  p: Pick<PdfAnalysisPage, "regions">,
  all: EvidenceLine[],
): FlowRegion[] {
  let rs = p.regions ?? [];
  if (!rs.length) {
    const xs = all
      .filter(
        (l) =>
          readQuestionNumber(l.text) &&
          /^\s*(?:(?:서술형|논술형)\s*)?[1-9]\d{0,2}\s*[.．、번]/.test(l.text),
      )
      .map((l) => l.x)
      .sort((a, b) => a - b);
    let split: number | undefined;
    for (let i = 1; i < xs.length; i++)
      if (xs[i] - xs[i - 1] > 0.2) {
        split = (xs[i] + xs[i - 1] + 0.4) / 2;
        split = Math.min(xs[i] - 0.015, split);
        break;
      }
    rs = split
      ? [
          { x: 0, y: 0, w: split, h: 1 },
          { x: split, y: 0, w: 1 - split, h: 1 },
        ]
      : [{ x: 0, y: 0, w: 1, h: 1 }];
  }
  return rs.map((rect, i) => ({
    id: `flow-${page}-${i}`,
    pageIndex: page,
    order: i,
    rect,
    kind: "column",
  }));
}
export function combineRegions(
  structure: StructureResult,
  pages: (Pick<PdfAnalysisPage, "inkPoints" | "regions" | "asset"> &
    Partial<PdfAnalysisPage>)[],
): StructureResult & { hybrid: HybridDiagnostics[] } {
  const questions: QuestionRegion[] = [],
    groups: RegionGroup[] = [],
    flows: FlowRegion[] = [],
    allBlocks: ContentBlock[] = [],
    hybrid: HybridDiagnostics[] = [];
  const relations: StructureResult["relations"] = [];
  let previous: QuestionRegion | undefined,
    previousFlow: string | undefined,
    section = "main",
    sectionCounter = 0,
    lastVisitedFlow: string | undefined;
  const observations = pages.flatMap((p) => p.observations ?? []);
  const makePart = (
    flow: FlowRegion,
    bs: ContentBlock[],
    role: QuestionPart["role"],
  ): QuestionPart => ({
    id: crypto.randomUUID(),
    pageIndex: flow.pageIndex,
    flowRegionId: flow.id,
    bbox: boxOf(union(bs.map((b) => b.rect))),
    role,
    sourceBlockIds: bs.map((b) => b.id),
  });
  for (let page = 0; page < pages.length; page++) {
    const p = pages[page],
      all = structure.lines.filter((l) => l.page === page && !l.duplicateOf),
      pageFlows = getFlows(page, p, all);
    flows.push(...pageFlows);
    // OCR passes can split one confirmed footer into many short words. Propagate
    // the semantic margin row across its fragments, not a fixed page-height crop.
    const marginRows = all.filter(
      (l) => l.role === "margin" && (l.y < 0.16 || l.y > 0.84),
    );
    const inMarginRow = (r: Rect) =>
      marginRows.some(
        (m) =>
          Math.min(r.y + r.h, m.y + m.h) - Math.max(r.y, m.y) >
            Math.min(r.h, m.h) * 0.45 && r.h < m.h * 1.8,
      );

    let starts = 0,
      cross = 0;
    const decisions: NumberDecision[] = [];
    const groupsBefore = questions.length;
    for (const flow of pageFlows) {
      const inFlow = (r: Rect) =>
        r.x >= flow.rect.x - 0.003 &&
        r.x + r.w <= flow.rect.x + flow.rect.w + 0.006;
      const lines = all
        .filter((l) => {
          if (!inFlow(l)) {
            if (overlap(l, flow.rect) > 0) cross++;
            return false;
          }
          return true;
        })
        .sort((a, b) => a.y - b.y || a.x - b.x);
      observations
        .filter((o) => o.pageIndex === page && inFlow(o.rect))
        .forEach((o) => (o.flowRegionId = flow.id));
      const body = lines.filter((l) => l.role !== "margin" && !heading(l.text));
      const h = med(
        body
          .filter((l) => /[가-힣a-z]{2}/i.test(l.text) && l.h < 0.04)
          .map((l) => l.h),
      );
      const checked = validateQuestionNumbers(body, flow.rect, h);
      decisions.push(...checked.decisions);
      const anchors = [...checked.anchors];
      const raw = body.filter(
        (l) =>
          readQuestionNumber(l.text) &&
          /^\s*(?:(?:서술형|논술형)\s*)?[1-9]\d{0,2}\s*[.．、번]/.test(
            l.text,
          ) &&
          !isMaterial(l.text),
      );
      const left = med(
        raw
          .filter((l) => l.x < flow.rect.x + flow.rect.w * 0.25)
          .map((l) => l.x),
      );
      // Supported native markers may be standalone; retain a trailing number until next flow.
      for (const l of raw) {
        if (
          anchors.some(
            (a) => Math.abs(a.y - l.y) < h * 0.6 && Math.abs(a.x - l.x) < 0.025,
          )
        )
          continue;
        const trailing = !body.some((b) => b.y > l.y + l.h && b.text.trim());
        const native = l.source === "pdf" && l.confidence === 100;
        const aligned =
          Math.abs(l.x - left) < 0.025 &&
          l.x < flow.rect.x + flow.rect.w * 0.25;
        const hasNext = body.some(
          (b) =>
            b.y >= l.y + l.h * 0.4 &&
            b.y - l.y < h * 4 &&
            /[가-힣a-z]{2}/i.test(b.text),
        );
        if (
          aligned &&
          ((native && (numberOnly(l.text) || hasNext)) ||
            (numberOnly(l.text) && trailing && (l.confidence ?? 0) >= 55))
        ) {
          anchors.push(l);
          decisions.push({
            lineId: l.id,
            text: l.text,
            rawNumber: readQuestionNumber(l.text)!,
            number: +readQuestionNumber(l.text)!,
            accepted: true,
            score: 0,
            reasons: [
              native
                ? "원본 잉크와 대응하는 네이티브 번호·정렬"
                : "단 마지막 번호-only: 다음 읽기 영역까지 보류",
            ],
          });
        }
      }
      // A missing delimiter is accepted only with observed consecutive numbers
      // on both sides, including the immediately preceding flow. Never invent it.
      for (const l of body) {
        const n = Number(readQuestionNumber(l.text));
        if (
          !n ||
          !/^\s*\d+\s+[가-힣a-z]/i.test(l.text) ||
          l.x > flow.rect.x + flow.rect.w * 0.22
        )
          continue;
        const before = anchors
          .filter((a) => a.y < l.y - h)
          .sort((a, b) => a.y - b.y)
          .at(-1);
        const after = anchors
          .filter(
            (a) =>
              a.y > l.y + h && Number(readQuestionNumber(a.text)) === n + 1,
          )
          .sort((a, b) => a.y - b.y)[0];
        const pn = before
          ? Number(readQuestionNumber(before.text))
          : previous?.sourceNumber;
        if (
          pn === n - 1 &&
          after &&
          Number(readQuestionNumber(after.text)) === n + 1 &&
          !anchors.some(
            (a) => Math.abs(a.y - l.y) < h && Math.abs(a.x - l.x) < 0.03,
          )
        ) {
          anchors.push(l);
          decisions.push({
            lineId: l.id,
            text: l.text,
            rawNumber: String(n),
            number: n,
            accepted: true,
            score: 0,
            reasons: [
              "원문에서 읽힌 숫자·본문과 앞뒤 읽기 영역의 연속 번호 (구분 기호 미인식)",
            ],
          });
        }
      }
      anchors.sort((a, b) => a.y - b.y || a.x - b.x);
      for (let i = anchors.length - 2; i > 0; i--) {
        const n = Number(readQuestionNumber(anchors[i].text)),
          a = Number(readQuestionNumber(anchors[i - 1].text)),
          b = Number(readQuestionNumber(anchors[i + 1].text));
        if (a < b && (n <= a || n >= b)) {
          const rejected = anchors.splice(i, 1)[0];
          decisions
            .filter((d) => d.lineId === rejected.id)
            .forEach((d) => {
              d.accepted = false;
              d.number = null;
              d.reasons.push("연결된 읽기 순서의 앞뒤 번호와 충돌");
            });
        }
      }
      starts += anchors.length;
      const blocks = buildBlocks(
        flow,
        lines,
        p.inkPoints,
        p.asset.height / p.asset.width,
        h,
        p.shapeReport,
        p.visualRegions,
      ).filter(
        (b) =>
          !heading(b.text) &&
          !inMarginRow(b.rect) &&
          !lines.some((l) => l.role === "margin" && b.lineIds.includes(l.id)),
      );
      allBlocks.push(...blocks);
      const select = (top: number, bottom: number) => {
        const candidates = blocks.filter(
          (b) => b.rect.y + b.rect.h > top && b.rect.y < bottom,
        );
        // Keep print and visual blocks, downweight isolated suspected ink rather than mutate pixels.
        return candidates.filter((b) => {
          if (b.classification === "suspected-handwriting")
            return candidates.some(
              (other) =>
                other !== b &&
                other.classification === "protected-print" &&
                overlap(b.rect, other.rect) > 0,
            );
          if (!b.text && b.role === "unknown" && b.componentIds.length < 3)
            return candidates.some(
              (other) =>
                other !== b &&
                (other.text || other.role === "visual") &&
                overlap(b.rect, {
                  x: other.rect.x - h,
                  y: other.rect.y - h * 0.5,
                  w: other.rect.w + 2 * h,
                  h: other.rect.h + h,
                }) > 0,
            );
          return true;
        });
      };
      const prefix = select(
        flow.rect.y,
        anchors[0]?.y ?? flow.rect.y + flow.rect.h,
      ).filter((b) => !anchors.some((a) => b.lineIds.includes(a.id)));
      const prefixText = prefix.map((b) => b.text).join(" ");
      const adjacentPrevious = previousFlow === lastVisitedFlow;
      lastVisitedFlow = flow.id;
      const firstNumber = anchors[0]
        ? Number(readQuestionNumber(anchors[0].text))
        : null;
      const newSection = /서술형|논술형|선택형|단답형/.test(prefixText);
      if (newSection && /서술형|논술형/.test(prefixText)) {
        section = `essay-${++sectionCounter}`;
        previous = undefined;
      }
      if (prefix.length) {
        if (isMaterial(prefixText)) {
          const id = crypto.randomUUID(),
            part = makePart(flow, prefix, "whole");
          groups.push({
            id,
            questionId: id,
            page,
            kind: "material",
            label: "공통 지문",
            lineIds: prefix.flatMap((b) => b.lineIds),
            rect: rectOf(part.bbox),
            flowRegionId: flow.id,
            section,
            partRole: "whole",
            reasons: ["지문 도입·범위 표기"],
            warnings: ["공유 문항 연결 확인 필요"],
            status: "incomplete",
          });
        } else if (
          previous &&
          adjacentPrevious &&
          previousFlow !== flow.id &&
          !newSection
        ) {
          const old = previous.parts.flatMap((part) =>
            allBlocks.filter((b) => part.sourceBlockIds.includes(b.id)),
          );
          const hasOptions = old.some((b) => isOption(b.text)),
            wasNumberOnly = previous.parts.at(-1)?.role === "number-only";
          const continuationEvidence =
            wasNumberOnly ||
            (p.sourceKind === "native" &&
              !hasOptions &&
              (/조건|보기/.test(prefixText) ||
                isOption(prefixText) ||
                isFormula(prefixText)));
          const sequence =
            firstNumber === null ||
            firstNumber === (previous.sourceNumber ?? 0) + 1;
          if (continuationEvidence && sequence) {
            previous.parts.push(makePart(flow, prefix, "continuation"));
            if (previous.parts[0].role === "whole")
              previous.parts[0].role = "start";
            previous.issues.push(
              "읽기 영역 간 연결: 번호 순서·조건/선택지 근거, 원문 확인 필요",
            );
          } else previous.issues.push("다음 읽기 영역의 선행 블록 소속 미확정");
        }
      }
      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i],
          next = anchors[i + 1],
          number = Number(readQuestionNumber(anchor.text));
        const sectionHeader = lines.filter(
          (l) =>
            l.y <= anchor.y &&
            (!i || l.y > anchors[i - 1].y) &&
            /서술형|논술형/.test(l.text),
        );
        if (sectionHeader.length && !section.startsWith("essay"))
          section = `essay-${++sectionCounter}`;
        const bs = select(
          anchor.y - h * 0.3,
          next ? next.y - h * 0.3 : flow.rect.y + flow.rect.h,
        );
        // Remove prior question blocks merely touching the top search boundary.
        const owned = bs.filter(
          (b) =>
            b.rect.y >= anchor.y - h * 0.7 || b.lineIds.includes(anchor.id),
        );
        if (!owned.some((b) => b.lineIds.includes(anchor.id)))
          owned.unshift({
            id: `anchor-${anchor.id}`,
            pageIndex: page,
            flowRegionId: flow.id,
            rect: anchor,
            text: anchor.text,
            role: "text",
            lineIds: [anchor.id],
            componentIds: [],
            classification:
              anchor.source === "pdf" ? "protected-print" : "unknown",
          });
        let accepted = owned;
        if (p.sourceKind !== "native") {
          // Bounded block chain; score is weak evidence and never clips graphics below it.
          let bottom = anchor.y + anchor.h;
          accepted = [];
          for (const b of owned) {
            const gap = b.rect.y - bottom;
            if (
              gap > Math.max(0.035, h * 4) &&
              accepted.length &&
              b.classification !== "protected-print"
            )
              break;
            accepted.push(b);
            bottom = Math.max(bottom, b.rect.y + b.rect.h);
          }
        }
        if (!accepted.length) continue;
        for (const b of accepted)
          if (!allBlocks.some((existing) => existing.id === b.id))
            allBlocks.push(b);
        const substantive = accepted.some(
          (b) =>
            !numberOnly(b.text) &&
            (b.text.replace(/\s/g, "").length > 2 || b.role === "visual"),
        );
        const q: QuestionRegion = {
          id: crypto.randomUUID(),
          sectionId: section,
          sourceLabel:
            anchor.text
              .trim()
              .match(
                /^(?:[\[【]?\s*(?:서술형|논술형)\s*)?\d{1,3}\s*(?:[.．、\]】]|번)?/,
              )?.[0]
              .trim() ?? String(number),
          sourceNumber: number,
          displayNumber: questions.length + 1,
          parts: [
            makePart(flow, accepted, substantive ? "whole" : "number-only"),
          ],
          sharedMaterialIds: [],
          status: "needs-review",
          issues: substantive
            ? ["본문·수식·그림·선택지의 보존 확인 필요"]
            : ["번호-only: 뒤 읽기 영역의 본문 연결 확인 필요"],
        };
        if (p.sourceKind !== "native") {
          q.issues.push(
            "필기 잔존 여부 미확인: 색상·형태만으로 인쇄/필기 분리 불가",
          );
          if (accepted.length < owned.length)
            q.issues.push("분리 불확실: 떨어진 블록의 소속을 확인해야 합니다.");
        }
        questions.push(q);
        previous = q;
        previousFlow = flow.id;
      }
    }
    hybrid.push({
      page,
      unassignedGroups: [],
      unassignedInk: 0,
      distance: 0,
      clusters: allBlocks.filter((b) => b.pageIndex === page).length,
      ocrLines: all.length,
      starts,
      textGroups: structure.groups.filter((g) => g.page === page).length,
      displayedGroups: questions.length - groupsBefore,
      lanes: pageFlows.length,
      crossColumnLines: cross,
      numberDecisions: decisions,
    });
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i],
      prev = questions[i - 1],
      next = questions[i + 1];
    // Resolve conflicting OCR readings only when the alternative number was
    // actually observed at this start and both neighboring questions support it.
    if (
      prev &&
      next &&
      prev.sectionId === q.sectionId &&
      next.sectionId === q.sectionId &&
      prev.sourceNumber !== null &&
      next.sourceNumber === prev.sourceNumber + 2 &&
      q.sourceNumber !== prev.sourceNumber + 1
    ) {
      const part = q.parts[0],
        expected = prev.sourceNumber + 1;
      const alternative = structure.lines.find(
        (l) =>
          l.page === part.pageIndex &&
          Number(readQuestionNumber(l.text)) === expected &&
          l.confidence !== undefined &&
          l.confidence >= 45 &&
          Math.abs(l.x - part.bbox.x) < 0.035 &&
          Math.abs(l.y - part.bbox.y) < 0.035,
      );
      if (alternative) {
        q.issues.push(
          `같은 위치 OCR 번호 충돌: 읽힌 ${q.sourceLabel} / ${expected}, 앞뒤 번호 근거로 선택 — 원문 확인 필요`,
        );
        q.sourceNumber = expected;
        q.sourceLabel =
          alternative.text
            .trim()
            .match(
              /^(?:[\[【]?\s*(?:서술형|논술형)\s*)?\d{1,3}\s*(?:[.．、\]】]|번)?/,
            )?.[0]
            .trim() ?? String(expected);
      }
    }
    if (
      (prev &&
        prev.sectionId === q.sectionId &&
        q.sourceNumber !== null &&
        prev.sourceNumber !== null &&
        q.sourceNumber <= prev.sourceNumber) ||
      (next &&
        next.sectionId === q.sectionId &&
        q.sourceNumber !== null &&
        next.sourceNumber !== null &&
        q.sourceNumber > next.sourceNumber)
    )
      q.issues.push(
        "번호 순서 충돌: 원본 번호 재확인 필요 (자동 보정하지 않음)",
      );
  }
  for (const q of questions)
    for (const [i, part] of q.parts.entries()) {
      const bs = allBlocks.filter((b) => part.sourceBlockIds.includes(b.id));
      groups.push({
        id: part.id,
        questionId: q.id,
        page: part.pageIndex,
        kind: "question",
        label: `${q.sectionId.startsWith("essay") ? "서술형 " : ""}${q.sourceNumber ?? "번호 확인"}번${q.parts.length > 1 ? ` · ${i + 1}/${q.parts.length}` : ""}`,
        originalNumber: q.sourceLabel ?? "",
        questionNumber: q.sourceNumber,
        section: q.sectionId,
        partIndex: i + 1,
        partRole: part.role,
        flowRegionId: part.flowRegionId,
        lineIds: bs.flatMap((b) => b.lineIds),
        rect: rectOf(part.bbox),
        reasons: [
          "글줄·수식·도형/선택지 블록의 제한된 소속 판정",
          "배점은 종료선으로 사용하지 않음",
        ],
        warnings: q.issues,
        status: "incomplete",
      });
    }
  for (const m of groups.filter((g) => g.kind === "material")) {
    const text = structure.lines
        .filter((l) => m.lineIds.includes(l.id))
        .map((l) => l.text)
        .join(" "),
      range = /\[\s*(\d+)\s*[~～–-]\s*(\d+)\s*\]/.exec(text);
    if (range)
      for (const q of questions.filter(
        (q) =>
          q.sectionId === m.section &&
          q.parts[0].pageIndex >= m.page &&
          (q.parts[0].pageIndex !== m.page ||
            q.parts[0].bbox.y >= m.rect.y ||
            q.parts[0].flowRegionId !== m.flowRegionId) &&
          q.sourceNumber !== null &&
          q.sourceNumber >= +range[1] &&
          q.sourceNumber <= +range[2],
      )) {
        q.sharedMaterialIds.push(m.id);
        relations.push({
          from: q.id,
          to: m.id,
          kind: "needs_material",
          state: "candidate",
          reason: "자료 원문 범위; 섹션·문맥 확인 필요",
        });
      }
  }
  const assigned = new Set(
    questions.flatMap((q) => q.parts.flatMap((p) => p.sourceBlockIds)),
  );
  for (const m of groups.filter((g) => g.kind === "material"))
    for (const b of allBlocks)
      if (b.lineIds.some((id) => m.lineIds.includes(id))) assigned.add(b.id);
  for (const d of hybrid) {
    const orphan = allBlocks.filter(
      (b) => b.pageIndex === d.page && !assigned.has(b.id),
    );
    d.unassignedGroups = orphan.map((b) => b.id);
    d.unassignedInk = new Set(orphan.flatMap((b) => b.componentIds)).size;
  }
  return {
    ...structure,
    groups,
    relations,
    questions,
    flowRegions: flows,
    blocks: allBlocks,
    hybrid,
  };
}
