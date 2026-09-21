# PDF 문항 영역 엔진

이전 `/lab/pdf-regions`에서 검증한 알고리즘을 화면·저장소와 분리한 브라우저용 TypeScript 모듈이다. 별도 서버나 외부 AI API를 추가하지 않았다. 분리 과정에서 OCR 정책, 해상도, 재시도 조건, 군집·번호·경계 임계값, 문항/지문 소속 규칙을 변경하지 않았다.

## 호출

```ts
import {
  analyzePdf,
  serializeAnalysis,
  selectDocumentContent,
  updateDocumentPart,
  type PdfAnalysisResult,
} from "../pdf-region-engine"; // lib/documents/pdf-registration.ts 기준

const controller = new AbortController();
const result: PdfAnalysisResult = await analyzePdf(
  file,
  controller.signal,
  ({ current, total, message }) => console.log(current, total, message),
  {
    removeInk: true,
    shapeFilter: true,
    distributionOnly: false,
    ocrPolicy: "legacy",
    connectivity: 4,
  },
);

const metadata = serializeAnalysis(result);
const selection = selectDocumentContent(result, selectedQuestionIds);
// 경계 조절은 문항/지문 조각과 화면 그룹을 함께 갱신한다.
// updateDocumentPart의 인수 및 반환 타입은 공개 타입으로 확인한다.
// 취소: controller.abort()
```

API는 `analyzePdf(file, signal, onProgress, options?)`다. `File`, canvas, Web Worker를 사용하는 실제 분석은 브라우저에서 호출한다. 모듈 import 자체는 SSR/Node에서 안전하다. 진행 알림·취소·다운로드·선택 상태는 호출자가 관리한다. 결과의 Blob은 엔진이 localStorage/IndexedDB/서버에 저장하지 않는다.

옵션 객체를 전부 생략하면 기존 동작대로 `removeInk: true, shapeFilter: true`다. 객체를 직접 전달할 때 `shapeFilter` 등 불리언의 생략 의미는 기존과 같으므로 위처럼 명시하는 것을 권장한다. OCR 정책을 생략하면 `legacy`, 연결 방향을 생략하면 4방향이다. 이 기본값을 임의로 `adaptive`로 바꾸지 않는다.

`serializeAnalysis()`는 기존 실험 화면과 동일한 JSON 필드·좌표 규약을 반환한다. 원본 PDF와 이미지 Blob은 포함하지 않는다. `hasHandwriting`은 판별기가 없으므로 `null`, 확인되지 않은 시각 요소도 기존대로 `null`을 보존한다. 결과 스키마의 `version: "text-structure-v3"`를 유지했다. 파일 이동만으로 스키마 버전을 올리지 않았다.

## 처리 순서와 파일

| 단계 | 파일 | 역할 |
| --- | --- | --- |
| 공개 API | `index.ts` | 분석, 결과 타입, 선택/수정, JSON 내보내기 |
| 전체 처리 | `analyze-pdf.ts` | PDF 입력부터 페이지별 처리, 최종 문서 조립까지 순서 관리 |
| 데이터 계약 | `base-types.ts`, `types.ts`, `question-regions.ts` | 이미지/좌표, 페이지 결과, 문항 조각·공통 지문·관측 |
| 원본 구조 | `pdf-geometry.ts`, `native-observations.ts`, `text-lines.ts` | PDF 글자·벡터·이미지, 신뢰도, 글줄 조립 |
| 전처리 | `ink-preprocess.ts`, `shape-ink-filter.ts` | 색상 처리, 비파괴 형태 분류 |
| 단·군집 | `physical.ts`, `ink-regions.ts`, `point-clusters.ts` | 읽기 단, 연결 성분, 분포 군집 |
| OCR 실행 | `ocr-worker.ts`, `ocr-retries.ts`, `ocr-result-cache.ts` | 단일 워커 재사용, 필요한 재인식, 정확한 픽셀 캐시 |
| 문항 판정 | `structure.ts`, `question-number.ts`, `layout-blocks.ts`, `hybrid-regions.ts` | 구조 후보, 번호 검증, 콘텐츠 블록, 다중 조각 문항 |
| 문서 관계 | `document-ownership.ts` | 섹션, 공통 지문, 문항 연결, 선택/수정 |
| 출력 데이터 | `serialize.ts` | Blob을 제외한 분석 JSON 계약 |
| 공통 실행 도구 | `browser-utils.ts`, `cancel.ts` | 이미지 자산 생성과 취소 |
| 화면 없는 재검증 | `core.ts` | 저장된 관측으로 구조·영역·소속 재계산; 렌더/OCR 실행 안 함 |

문항 하나는 여러 `parts`를 가질 수 있다. 좌표는 회전이 반영된 페이지 좌상단 기준 0~1이며 원본 대응 변환도 별도로 유지한다. 공통 지문은 독립 소유자로 보존하고 선택 시 필요한 자료를 한 번씩 포함한다. 원본 문항 번호와 섹션을 유지한다.

## 실행 자원과 캐시

기존 의존성 `pdfjs-dist`, `tesseract.js`를 사용한다. `npm run prepare:documents`가 만드는 `/document-runtime`의 PDF worker·CMap·WASM 및 OCR worker·kor/eng 언어 데이터가 필요하다. HWP/HWPX 처리는 이 엔진의 범위가 아니다.

OCR 결과 캐시는 실제 RGBA와 크기·모드·whitelist·엔진/언어 버전을 키로 사용한다. 현재 탭 메모리의 LRU 캐시이며 문자열 추정 16MiB 한도다. 탭 종료/새로고침 때 사라진다. 픽셀이 다르면 재인식한다. 일반 문항 저장소나 서버 저장과는 무관하다.

## 기존 코드와의 경계

- 등록 어댑터 `lib/documents/pdf-registration.ts`가 공개 API를 호출한다. 실험 페이지는 삭제했다.
- 엔진 안에는 React/Next.js, 앱 저장소, `lib/documents/import.ts`, HWP 런타임 의존성이 없다.
- 이전 `lib/documents` 경로는 호환 재내보내기로 남겼다. **알고리즘 구현은 이 폴더에 한 벌만 존재한다.** 이전 `extractExperiment`는 `analyzePdf`의 별칭이다. OCR 캐시·워커도 중복 생성되지 않는다.
- `/questions/new`는 PDF를 이 엔진으로 분석한 뒤 페이지 안에서 선택·검토·수정한다. `analysisToDocument`가 다중 조각과 공통 지문 관계를 보존하고, `prepareRegistration`이 승인된 영역과 원본 PDF를 저장 데이터로 변환한다. HWP/HWPX는 기존 별도 경로를 유지한다. `/question/new`는 정식 등록 경로로 이동한다.
- 이미 저장된 검증 JSON과 이전 스크립트가 계속 읽히도록 타입과 필드 이름을 호환한다. `.mts`에서 이전 `.ts` 경로를 가져오는 경우도 명시적 함수 재내보내기로 지원한다.

## 검증과 한계

2026-09-21 분리 시점:

- 단위 테스트 60개, 타입 검사, 프로덕션 빌드 통과.
- 옮긴 18개 구현 모듈의 실행 AST를 비교했다. import 경로·공개 함수 이름·타입·공백을 제외한 알고리즘 본문이 동일했다.
- 한국지리 20문항, 국어 56문항/14지문, 수학 1111 22문항/24조각, 2222 22문항/22조각을 기존 관측으로 재처리했다. 문항 및 보조 조각 좌표·순서, 공통 자료 연결, 화면 그룹이 이전과 같았다.
- 국어 fixture 323개, 수학 fixture 104/107개 통과. 원본 PDF에서 새 OCR을 실행한 검증은 아니다. 이번 작업에서 새 브라우저 업로드·인쇄 테스트를 수행했다고 보고하지 않는다.
- 한국지리 20번 하단 안내 상자 포함 등 기존 미해결 사례는 그대로다. 엔진 분리를 정확도 개선이나 모든 문서에서의 품질 보증으로 해석하지 않는다.

일반 검사: `npm test`, `npm run typecheck`, `TEACHWAY_BUILD_DIR=.next-optimized npm run build`.
재처리: `node --import tsx scripts/replay-region-geometry.ts <기존 JSON> <출력 JSON> no-shape`.
비교: `node scripts/compare-lab-results.mjs <기준 JSON> <재처리 JSON> <보고서 JSON>`.
검증 자료는 비공개 `output/region-regression/engine-refactor/`에 보관한다.
