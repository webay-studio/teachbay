import type { Observation } from "./question-regions";
import type { Matrix3 } from "./base-types";
import type { Rect } from "./base-types";
export function measureInk(rect: Rect, before: ImageData, after: ImageData) {
  let ink = 0,
    removed = 0,
    cells = 0,
    occupied = 0;
  const { width: w, height: h } = before;
  const x0 = Math.max(0, Math.floor(rect.x * w)),
    x1 = Math.min(w, Math.ceil((rect.x + rect.w) * w));
  const y0 = Math.max(0, Math.floor(rect.y * h)),
    y1 = Math.min(h, Math.ceil((rect.y + rect.h) * h));
  const step = Math.max(1, Math.floor((x1 - x0) / 16));
  for (let x = x0; x < x1; x += step) {
    let found = false;
    for (let xx = x; xx < Math.min(x + step, x1); xx++)
      for (let y = y0; y < y1; y++) {
        const k = (y * w + xx) * 4;
        if (
          Math.min(before.data[k], before.data[k + 1], before.data[k + 2]) < 190
        ) {
          ink++;
          found = true;
          if (
            Math.min(after.data[k], after.data[k + 1], after.data[k + 2]) >= 230
          )
            removed++;
        }
      }
    cells++;
    if (found) occupied++;
  }
  return {
    inkSupport: cells ? occupied / cells : 0,
    removedInkRatio: ink ? removed / ink : 0,
    ink,
  };
}
export function nativeObservation(args: {
  id: string;
  text: string;
  pageIndex: number;
  rect: Rect;
  transform: Matrix3;
  fontName: string;
  fontFamily?: string;
  before: ImageData;
  after: ImageData;
}): Observation {
  const { rect: r } = args,
    m = measureInk(r, args.before, args.after),
    issues: string[] = [];
  const invalid =
    ![r.x, r.y, r.w, r.h].every(Number.isFinite) ||
    r.x < -0.01 ||
    r.y < -0.01 ||
    r.x + r.w > 1.02 ||
    r.y + r.h > 1.02 ||
    r.w <= 0 ||
    r.h <= 0;
  if (invalid) issues.push("문자 또는 좌표 검증 실패");
  if (m.inkSupport < 0.3 || m.ink < 3)
    issues.push("원본 이미지의 잉크 대응 부족");
  if (!args.fontName) issues.push("PDF font metadata missing");
  if (m.removedInkRatio > 0.1)
    issues.push("전처리 마스크 충돌: 원본 인쇄 내용 보호");
  const textStatus = /[�\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(args.text)
    ? "encoding-suspect"
    : "usable";
  const geometryStatus =
    !invalid && m.inkSupport >= 0.3 && m.ink >= 3 ? "usable" : "uncertain";
  const state =
    geometryStatus === "usable" && textStatus === "usable" && !!args.fontName
      ? "supported"
      : "held";
  return {
    id: args.id,
    text: args.text,
    source: "pdf",
    passId: `native-${args.pageIndex}`,
    pageIndex: args.pageIndex,
    flowRegionId: "unassigned",
    transform: args.transform,
    confidence: state === "supported" ? 100 : null,
    rect: r,
    fontName: args.fontName,
    fontFamily: args.fontFamily,
    geometryStatus,
    textStatus,
    state,
    issues,
    inkSupport: m.inkSupport,
    removedInkRatio: m.removedInkRatio,
  };
}

/** Font-level corruption is a reason to withhold semantic text, not its geometry.
 * CJK/old Hangul alone is never an encoding failure. */
export function assessNativeFonts(observations: Observation[]) {
  const controls = (s: string) =>
    (s.match(/[�\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  const total = observations.map((o) => o.text).join("");
  const widespread = controls(total) / Math.max(1, total.length) > 0.05;
  for (const font of new Set(observations.map((o) => o.fontName))) {
    const os = observations.filter((o) => o.fontName === font),
      text = os.map((o) => o.text).join("");
    const broken = controls(text) / Math.max(1, text.length) > 0.02;
    const ambiguous =
      widespread && /[\u4e00-\u9fff]/.test(text) && !/[가-힣]/.test(text);
    if (!broken && !ambiguous) continue;
    for (const o of os) {
      o.textStatus = broken ? "encoding-suspect" : "uncertain";
      o.state = "held";
      o.confidence = null;
      o.issues.push(
        broken
          ? "글꼴의 제어문자 매핑 이상: 의미 분석 보류, 좌표 유지"
          : "같은 페이지의 광범위 인코딩 이상: 해당 글꼴 의미 OCR 확인 필요",
      );
    }
  }
}
