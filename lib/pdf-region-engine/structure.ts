import type { Rect, TextLine } from "./base-types";

export type Role =
  | "start"
  | "context"
  | "request"
  | "choice"
  | "formula"
  | "material"
  | "margin"
  | "unassigned";
export type EvidenceLine = TextLine & {
  id: string;
  page: number;
  source: "pdf" | "ocr";
  role: Role;
  reasons: string[];
  passId?: string;
  observationIds?: string[];
  duplicateOf?: string;
};
export type RegionGroup = {
  id: string;
  page: number;
  kind: "question" | "material";
  label: string;
  lineIds: string[];
  rect: Rect;
  reasons: string[];
  warnings: string[];
  status: "candidate" | "incomplete";
  questionId?: string;
  questionNumber?: number | null;
  originalNumber?: string;
  section?: string;
  partIndex?: number;
  flowRegionId?: string;
  partRole?: import("./question-regions").QuestionPart["role"];
  visualCandidate?: boolean;
  inkRegionCount?: number;
};
export type StructureResult = {
  sections?: import("./question-regions").DocumentSection[];
  sharedSets?: import("./question-regions").SharedSet[];
  pageMetadata?: {
    pageIndex: number;
    sectionId: string;
    printedSectionPage: number | null;
  }[];
  instructions?: { id: string; pageIndex: number; rect: Rect; text: string }[];
  questions?: import("./question-regions").QuestionRegion[];
  flowRegions?: import("./question-regions").FlowRegion[];
  blocks?: import("./question-regions").ContentBlock[];
  lines: EvidenceLine[];
  groups: RegionGroup[];
  relations: {
    from: string;
    to: string;
    kind: "needs_material" | "possible_continuation";
    state: "candidate";
    reason: string;
  }[];
};
export const ROLE_NAMES: Record<Role, string> = {
  start: "문항 시작 후보",
  context: "주어진 정보·조건",
  request: "질문·수행 요구",
  choice: "선택지·하위 항목",
  formula: "수식 후보",
  material: "공통 자료 후보",
  margin: "머리말·꼬리말 후보",
  unassigned: "소속 미확정",
};
const clean = (s: string) => s.replace(/\s/g, "").toLowerCase();
const number = (s: string) =>
  /^\s*(?:[\[【]?\s*(?:서술형|논술형)\s*)?(\d{1,3})\s*(?:[.．、]|번|\]|$)(?=\s|[^\d]|$)/u.exec(
    s,
  );
const material = (s: string) =>
  /\[\s*\d+\s*[~～–-]\s*\d+\s*\]|다음\s*(?:글|지문|자료).*읽|read\s+(?:the\s+)?(?:passage|text)/i.test(
    s,
  );
const request = (s: string) =>
  /구하|고르|설명하|서술하|증명하|작성하|쓰시오|답하|완성하|계산하|나타내|비교하|선택하|논하|밝히|값은|것은|것인가|얼마|무엇|어느|어떻게|이유를|적절한|적절하지|옳은|옳지|일치하는|추론한|[?？]|\b(?:find|choose|which|what|why|how|calculate|determine|prove|explain|complete|evaluate|solve)\b/i.test(
    s,
  );
const context = (s: string) =>
  /일\s*때|에\s*대하여|에\s*대한|만족|조건|주어진|다음|함수|수열|방정식|실수|정수|자연수|삼각형|그래프|그림|표에서|\b(?:given|let|suppose|consider|when|if|following)\b/i.test(
    s,
  );
const formula = (s: string) =>
  /[=∑∫√≤≥∞παβθ]|\b(?:lim|sin|cos|tan|log)\b|[a-z]\s*\([^)]*\)/i.test(s);
const choice = (s: string) =>
  /^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|\([1-9가-힣]\)|[A-E][.)])/.test(s);
const median = (a: number[]) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0.012;
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const bounds = (ls: TextLine[]): Rect => {
  const x = Math.max(0, Math.min(...ls.map((l) => l.x)) - 0.006),
    y = Math.max(0, Math.min(...ls.map((l) => l.y)) - 0.006);
  return {
    x,
    y,
    w: Math.min(1, Math.max(...ls.map((l) => l.x + l.w)) + 0.006) - x,
    h: Math.min(1, Math.max(...ls.map((l) => l.y + l.h)) + 0.006) - y,
  };
};

/** Experimental structural evidence, not semantic AI or handwriting removal.
 * Every recognized line survives. Weak ownership is left unresolved.
 */
export function buildStructure(
  input: EvidenceLine[],
  pageCount: number,
  inkPages: Rect[][] = [],
): StructureResult {
  const lines = input.map((l) => ({
    ...l,
    role: "unassigned" as Role,
    reasons: [] as string[],
  }));
  // OCR can emit "1." separately from its body. Keep raw records and add a
  // geometric join; do not require the number and question to share an OCR line.
  const numberOnly = lines.filter(
    (l) =>
      /^\s*\d{1,3}[.．、]?\s*$/.test(l.text) &&
      (l.source !== "pdf" || /[.．、]\s*$/.test(l.text)),
  );
  for (const start of numberOnly) {
    const body = lines
      .filter(
        (l) =>
          l.page === start.page &&
          l.id !== start.id &&
          l.x >= start.x + start.w - 0.003 &&
          l.x - (start.x + start.w) < 0.045 &&
          Math.min(l.y + l.h, start.y + start.h) - Math.max(l.y, start.y) >
            Math.min(l.h, start.h) * 0.35 &&
          /[가-힣a-z]{2}/i.test(l.text),
      )
      .sort((a, b) => a.x - b.x)[0];
    if (!body) continue;
    const rect = bounds([start, body]);
    const id = `joined-${start.id}-${body.id}`;
    lines.push({
      ...body,
      ...rect,
      id,
      observationIds: [
        ...(start.observationIds ?? []),
        ...(body.observationIds ?? []),
      ],
      text: `${start.text.trim().replace(/[.．、]$/, "")}. ${body.text}`,
      reasons: ["따로 인식된 번호와 같은 행 본문 연결"],
      role: "unassigned",
    });
    start.duplicateOf = id;
    body.duplicateOf = id;
  }
  // Keep duplicates in raw output, but avoid counting PDF/OCR overlap twice.
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    if (a.duplicateOf) continue;
    const duplicate = lines
      .slice(0, i)
      .find(
        (b) =>
          !b.duplicateOf &&
          b.page === a.page &&
          clean(a.text) === clean(b.text) &&
          overlap(a, b) > Math.min(a.w * a.h, b.w * b.h) * 0.6,
      );
    if (duplicate) a.duplicateOf = duplicate.id;
  }
  const repeated = new Map<string, Set<number>>();
  for (const l of lines) {
    if (l.y < 0.14 || l.y > 0.9) {
      const k = clean(l.text).replace(/\d+/g, "#");
      if (k.length < 4) continue;
      const pages = repeated.get(k) ?? new Set<number>();
      pages.add(l.page);
      repeated.set(k, pages);
    }
  }
  for (const l of lines) {
    const t = l.text;
    const repeat = repeated.get(clean(t).replace(/\d+/g, "#"))?.size ?? 0;
    if (
      ((l.y < 0.14 || l.y > 0.9) &&
        repeat >= Math.min(3, Math.max(2, pageCount))) ||
      (l.y < 0.2 &&
        /시험지|고사|학교|학년도|응시|유의\s*사항/.test(t) &&
        !number(t)) ||
      (l.y > 0.9 &&
        /저작권|복제|배포|^\s*[-–\[ ]*\d+(?:\s*[-/]\s*\d+)?\s*[-–\] ]*$/.test(
          t,
        ))
    ) {
      l.role = "margin";
      l.reasons.push("페이지 가장자리의 반복 문구 또는 쪽 번호 단서");
    } else if (material(t)) {
      l.role = "material";
      l.reasons.push("공통 자료 범위 또는 지문 도입 단서");
    } else if (choice(t)) {
      l.role = "choice";
      l.reasons.push("선택지·하위 항목 표기");
    } else if (request(t)) {
      l.role = "request";
      l.reasons.push("질문·수행 요구 문장 단서");
    } else if (context(t)) {
      l.role = "context";
      l.reasons.push("대상·주어진 조건의 언어 단서");
    } else if (formula(t)) {
      l.role = "formula";
      l.reasons.push("수식 표기 단서; 인쇄물·필기 구별 불가");
    }
  }
  const groups: RegionGroup[] = [];
  for (let page = 0; page < pageCount; page++) {
    const pageLines = lines
      .filter((l) => l.page === page && !l.duplicateOf && l.role !== "margin")
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const h = median(
      pageLines.filter((l) => /[가-힣a-z]{2}/i.test(l.text)).map((l) => l.h),
    );
    const numbered = pageLines.filter(
      (l) => number(l.text) && l.role !== "choice" && l.role !== "material",
    );
    // Infer possible reading lanes AFTER extraction; never crop the OCR input by lanes.
    const clusters: number[][] = [];
    for (const l of numbered) {
      const c = clusters.find((c) => Math.abs(median(c) - l.x) < 0.06);
      if (c) c.push(l.x);
      else clusters.push([l.x]);
    }
    const starts = clusters
      .filter((c) => c.length >= 1)
      .map(median)
      .sort((a, b) => a - b);
    const splits = starts.filter((x, i) => i && x - starts[i - 1] > 0.2);
    const lane = (l: TextLine) => splits.filter((x) => l.x >= x - 0.035).length;
    const validStarts = new Set<string>();
    for (const l of numbered) {
      const neighbors = pageLines.filter(
        (n) =>
          n.id !== l.id &&
          lane(n) === lane(l) &&
          n.y >= l.y &&
          n.y - l.y < Math.max(0.1, h * 8),
      );
      const aligned = numbered.filter(
        (n) =>
          n.id !== l.id &&
          Math.abs(n.x - l.x) < 0.035 &&
          Math.abs(n.h - l.h) < Math.max(h, l.h),
      );
      const substantive = /[가-힣]{2,}|[a-z]{3,}/i.test(
        l.text.replace(number(l.text)?.[0] ?? "", ""),
      );
      const hasBody =
        context(l.text) ||
        request(l.text) ||
        neighbors.some((n) => n.role === "context" || n.role === "request");
      if (
        hasBody &&
        (substantive || aligned.length >= 2) &&
        l.h >= h * 0.45 &&
        l.h <= h * 2.5
      ) {
        validStarts.add(l.id);
        l.role = "start";
        l.reasons.push("번호 + 본문 연결 + 정렬/글자 크기 근거");
      } else l.reasons.push("번호 모양은 있으나 문항 시작 근거 부족");
    }
    for (let column = 0; column <= splits.length; column++) {
      const list = pageLines.filter((l) => lane(l) === column);
      const anchors = list.filter(
        (l) => validStarts.has(l.id) || l.role === "material",
      );
      // Requests initiate ownership; numbered intervals are SEARCH WINDOWS only.
      for (let k = 0; k < anchors.length; k++) {
        const anchor = anchors[k],
          next = anchors[k + 1];
        const window = list.filter(
          (l) => l.y + l.h >= anchor.y && (!next || l.y < next.y),
        );
        if (anchor.role === "material") {
          const connected: EvidenceLine[] = [anchor];
          for (const l of window.filter((l) => l.id !== anchor.id)) {
            const last = connected.at(-1)!;
            if (l.y - (last.y + last.h) > Math.max(0.035, h * 3)) break;
            connected.push(l);
          }
          groups.push({
            id: `group-${anchor.id}`,
            page,
            kind: "material",
            label: "공통 자료 후보",
            lineIds: connected.map((l) => l.id),
            rect: bounds(connected),
            reasons: ["자료 도입에서 인접 문장 연결"],
            warnings: [
              "공유 대상과 지문 완전성 확인 필요",
              "글자로 인식되지 않은 그림·표는 자동 포함되지 않을 수 있습니다.",
            ],
            status: "candidate",
          });
          continue;
        }
        const asks = window.filter(
          (l) => request(l.text) && l.role !== "choice",
        );
        const children = window.filter((l) => /^\s*\([1-9]\)/.test(l.text));
        // A parent's later subquestions are part of the same question, not new starts.
        const end = children.length ? asks.at(-1) : asks[0];
        if (!end) {
          // Missing a request keyword does not imply that the question is one line.
          const chain: EvidenceLine[] = [anchor];
          let bottom = anchor.y + anchor.h;
          for (const l of window
            .filter((l) => l.id !== anchor.id)
            .sort((a, b) => a.y - b.y || a.x - b.x)) {
            if (l.y + l.h < anchor.y) continue;
            if (l.y - bottom > Math.max(h * 3, 0.025)) break;
            chain.push(l);
            bottom = Math.max(bottom, l.y + l.h);
          }
          groups.push({
            id: `group-${anchor.id}`,
            page,
            kind: "question",
            label: `${number(anchor.text)?.[1] ?? "?"}번 후보`,
            lineIds: chain.map((l) => l.id),
            rect: bounds(chain),
            reasons: [
              ...anchor.reasons,
              "요구 문구 미인식 시 번호부터 인접 본문·수식 행 연결",
            ],
            warnings: [
              "문항 끝 표현을 인식하지 못해 줄 간격으로 범위를 구성했습니다. 끝부분과 필기 포함 여부를 확인하세요.",
            ],
            status: "incomplete",
          });
          continue;
        }
        // Walk backward from the request, linking statements/formulas by reading adjacency.
        const preceding = window
          .filter((l) => l.y <= end.y + end.h)
          .sort((a, b) => b.y - a.y || b.x - a.x);
        const connected: EvidenceLine[] = [];
        let top = end.y + end.h;
        let gap = false;
        for (const l of preceding) {
          if (top - (l.y + l.h) > Math.max(h * 5, 0.05)) {
            gap = true;
            break;
          }
          connected.push(l);
          top = Math.min(top, l.y);
        }
        const reached = connected.some((l) => l.id === anchor.id);
        let bottom = Math.max(...connected.map((l) => l.y + l.h));
        for (const l of window
          .filter((l) => l.y > end.y + end.h)
          .sort((a, b) => a.y - b.y)) {
          const nearby = l.y - bottom < Math.max(h * 3, 0.035);
          const last = connected.at(-1);
          if (
            nearby &&
            (l.role === "choice" ||
              (last?.role === "choice" &&
                l.role !== "request" &&
                l.role !== "start"))
          ) {
            connected.push(l);
            bottom = Math.max(bottom, l.y + l.h);
          } else break;
        }
        // Include score labels, wrapped choices, and all child questions after the stem.
        for (const l of window) {
          if (connected.some((c) => c.id === l.id)) continue;
          const lastChild = children.at(-1);
          const childBody =
            lastChild &&
            l.y >= children[0].y &&
            l.y <= Math.max(lastChild.y + lastChild.h, end.y + end.h);
          const tailMarker =
            l.role === "choice" ||
            /\[\s*\d+(?:[.,]\d+)?\s*점\s*\]/.test(l.text);
          if (
            childBody ||
            (tailMarker && l.y - bottom < Math.max(h * 5, 0.055))
          ) {
            connected.push(l);
            bottom = Math.max(bottom, l.y + l.h);
          }
        }
        const ids = new Set(connected.map((l) => l.id));
        const warnings = [
          "필기와 인쇄물을 분류한 결과가 아닙니다.",
          "OCR에 잡히지 않은 그림·표·수식과 질문 뒤 자료를 원본에서 확인하세요.",
        ];
        if (!reached || gap)
          warnings.push("앞부분을 문항 시작까지 연결하지 못했습니다.");
        if (asks.length > 1)
          warnings.push(
            "질문 문장이 여러 개입니다. 하위 문항·다른 문항·필기인지 확인하세요.",
          );
        if (window.some((l) => !ids.has(l.id)))
          warnings.push("같은 탐색 구역에 소속 미확정 글자가 남아 있습니다.");
        const ordered = connected.sort((a, b) => a.y - b.y || a.x - b.x);
        groups.push({
          id: `group-${anchor.id}`,
          page,
          kind: "question",
          label: `${number(anchor.text)?.[1] ?? "?"}번 후보`,
          lineIds: ordered.map((l) => l.id),
          rect: bounds(ordered),
          reasons: [
            "질문·수행 요구를 기준으로 앞의 조건·수식 연결",
            reached ? "시작 번호까지 연결됨" : "시작 연결 미완료",
            ordered.some((l) => l.role === "choice")
              ? "뒤의 선택지 후보 포함"
              : "선택지 연결 근거 없음",
          ],
          warnings,
          status: reached && !gap ? "candidate" : "incomplete",
        });
      }
      // No validated number: preserve request-centered fragments, never invent a number.
      const owned = new Set(groups.flatMap((g) => g.lineIds));
      for (const ask of list.filter(
        (l) => l.role === "request" && !owned.has(l.id),
      )) {
        const chain: EvidenceLine[] = [ask];
        let top = ask.y;
        for (const prior of list
          .filter((l) => l.y < ask.y && !owned.has(l.id))
          .sort((a, b) => b.y - a.y)) {
          if (
            top - (prior.y + prior.h) > Math.max(h * 3, 0.035) ||
            prior.role === "material" ||
            prior.role === "request" ||
            prior.role === "choice"
          )
            break;
          chain.unshift(prior);
          top = prior.y;
          if (validStarts.has(prior.id)) break;
        }
        chain.forEach((l) => owned.add(l.id));
        groups.push({
          id: `group-${ask.id}`,
          page,
          kind: "question",
          label: "시작 미확정",
          lineIds: chain.map((l) => l.id),
          rect: bounds(chain),
          reasons: [
            ...ask.reasons,
            "질문 앞의 인접 조건·글자 연결; 번호를 생성하지 않음",
          ],
          warnings: [
            "문항 시작을 확정하지 못했습니다. 앞부분 누락·필기 포함 가능성이 있습니다.",
            "뒤의 선택지·그림·표를 확인해주세요.",
          ],
          status: "incomplete",
        });
      }
    }
  }
  // Refine text ownership with visible ink, preserving boxes/diagrams absent from OCR.
  for (const g of groups) {
    const pageLines = lines.filter((l) => l.page === g.page && !l.duplicateOf);
    const owned = pageLines.filter((l) => g.lineIds.includes(l.id));
    const h = median(owned.map((l) => l.h));
    const others = groups.filter((o) => o.page === g.page && o.id !== g.id);
    const blocks = inkPages[g.page] ?? [];
    const rects: Rect[] = [g.rect];
    let visual = false;
    const text = owned.map((l) => l.text).join(" ");
    const referencesVisual =
      /그림|그래프|도형|사진|좌표|삼각형|사각형|figure|diagram|graph/i.test(
        text,
      );
    for (const b of blocks) {
      const hit = overlap(b, g.rect) > 0;
      const horizontal =
        b.x < g.rect.x + g.rect.w + 0.02 && b.x + b.w > g.rect.x - 0.02;
      const gap = Math.max(
        0,
        b.y - (g.rect.y + g.rect.h),
        g.rect.y - (b.y + b.h),
      );
      const belongsElsewhere = others.some(
        (o) => overlap(b, o.rect) > 0.25 * b.w * b.h,
      );
      const crossesOtherStart = others.some(
        (o) =>
          o.rect.y > g.rect.y &&
          o.rect.y < b.y + b.h &&
          o.rect.x < g.rect.x + g.rect.w &&
          o.rect.x + o.rect.w > g.rect.x,
      );
      if (belongsElsewhere || crossesOtherStart) continue;
      const textOverlap = owned.some((l) => overlap(l, b) > 0);
      const large = b.h > h * 2 && b.w > 0.025;
      // No extension to the next start: require intersection or a nearby referenced visual.
      if (
        (hit && (textOverlap || large)) ||
        (referencesVisual && large && horizontal && gap < h * 3)
      ) {
        rects.push(b);
        if (large && !textOverlap) visual = true;
      }
    }
    g.rect = bounds(rects.map((r) => ({ ...r, text: "" })));
    g.visualCandidate = visual;
    g.inkRegionCount = rects.length - 1;
    if (rects.length > 1)
      g.reasons.push(
        "전처리 이미지의 연결된 획을 포함해 수식·테두리·시각 요소 경계 보완",
      );
    if (referencesVisual && !visual) {
      g.status = "incomplete";
      g.warnings.push(
        "시각 자료 참조는 있지만 그림 연결을 확정하지 못했습니다.",
      );
    }
    g.warnings.push(
      "검정 필기와 인쇄된 획은 영상 규칙으로 확실하게 구분되지 않습니다.",
    );
  }
  // Keep original numbering separate from document-wide ordering. Unknown numbers stay unknown.
  let offset = 0,
    last = 0,
    section = "main";
  for (const g of groups) {
    if (g.kind !== "question") continue;
    const marked = lines.find(
      (l) => g.lineIds.includes(l.id) && number(l.text),
    );
    const original = marked ? number(marked.text)?.[1] : undefined;
    const essay = !!marked && /서술형|논술형/.test(marked.text);
    if (essay && section !== "essay") {
      offset = last;
      section = "essay";
    }
    g.questionId = g.id;
    g.originalNumber = original ?? "";
    g.section = section;
    g.partIndex = 1;
    g.questionNumber = original ? Number(original) + offset : null;
    if (g.questionNumber !== null) {
      if (g.questionNumber <= last && Number(original) === 1 && !essay) {
        g.questionNumber = null;
        g.warnings.push(
          "번호 재시작: 섹션 경계를 확인할 수 없어 전체 번호를 확정하지 않았습니다.",
        );
      } else last = Math.max(last, g.questionNumber);
    }
    if (g.questionNumber !== null)
      g.label = `${g.questionNumber}번 후보${essay ? ` (원문 서술형 ${original})` : ""}`;
  }
  // Only an explicit continuation with the same original number reuses identity.
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.kind !== "question" || !g.originalNumber) continue;
    const text = lines
      .filter((l) => g.lineIds.includes(l.id))
      .map((l) => l.text)
      .join(" ");
    if (!/계속|이어서|continued/i.test(text)) continue;
    const prior = groups
      .slice(0, i)
      .filter(
        (p) =>
          p.kind === "question" &&
          p.section === g.section &&
          p.originalNumber === g.originalNumber &&
          p.page >= g.page - 1,
      )
      .at(-1);
    if (prior) {
      g.questionId = prior.questionId ?? prior.id;
      g.questionNumber = prior.questionNumber;
      g.partIndex = (prior.partIndex ?? 1) + 1;
      g.reasons.push("동일 원문 번호와 명시적 이어짐 표기로 조각 연결");
      g.warnings.push("이어짐 소속을 원본에서 확인하세요.");
    }
  }
  const relations: StructureResult["relations"] = [];
  for (const g of groups.filter((g) => g.kind === "material")) {
    const text = g.lineIds
      .map((id) => lines.find((l) => l.id === id)?.text ?? "")
      .join(" ");
    const range = /\[\s*(\d+)\s*[~～–-]\s*(\d+)\s*\]/.exec(text);
    if (range)
      for (const q of groups.filter(
        (q) =>
          q.kind === "question" && q.page >= g.page && q.page <= g.page + 1,
      )) {
        const n = Number(q.originalNumber || Number.parseInt(q.label));
        if (n >= +range[1] && n <= +range[2])
          relations.push({
            from: q.id,
            to: g.id,
            kind: "needs_material",
            state: "candidate",
            reason: "원문 번호 범위 단서; 번호 재시작과 자료 내용 확인 필요",
          });
      }
  }
  for (const g of groups.filter((g) => g.status === "incomplete")) {
    const prior = groups.filter((p) => p.page === g.page - 1).at(-1);
    if (prior)
      relations.push({
        from: prior.id,
        to: g.id,
        kind: "possible_continuation",
        state: "candidate",
        reason: "이전 페이지 연결 가능성만 표시; 자동 합치지 않음",
      });
  }
  return { lines, groups, relations };
}
