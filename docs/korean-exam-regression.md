# 국어 PDF 영역 추출 보완 기록

적용 범위는 `/lab/pdf-regions`다. 일반 `/questions/new`의 영구 등록·시험지 출력 엔진을 교체하지 않았다. 실험 화면의 박스는 미리보기와 내보내는 JSON의 crop 범위다. 이번에 추가한 선택 구성 JSON도 검토용이며, DB 저장이나 인쇄 완료를 뜻하지 않는다.

## 실제로 변경한 경로

`app/lab/pdf-regions/page.tsx / run()` → `extractExperiment()` → 기존 PDF.js 렌더·네이티브 관측·Tesseract.js kor+eng OCR → `buildStructure()` → `combineRegions()` → 새 `assignDocumentOwnership()` → 같은 parts 좌표로 미리보기·JSON 표시.

외부 AI API, 생성 모델, 파일 전용 글리프 복원표는 추가하지 않았다. Tesseract의 로컬 OCR은 기존 모델을 그대로 사용한다. 사용자 fixture의 좌표·문항 수·페이지 번호는 **검사 스크립트만** 읽으며 앱에는 들어가지 않는다.

- `native-observations.ts / nativeObservation(), assessNativeFonts()`: 글자 의미 신뢰와 좌표 신뢰를 분리했다. 제어문자가 반복되는 글꼴의 문자열은 보류하되 원본 위치는 남긴다. 한자·옛한글 자체는 실패 조건이 아니다. `extract-experiment.ts`의 native 판정에서는 저작권 문구만으로 본문을 통과시키지 않는다.
- `pdf-geometry.ts / pdfRasterContainers()`: PDF 이미지의 CTM·viewport 변환을 따라 원본 위치를 확보한다. 같은 폭·정렬의 맞닿은 타일을 시각 컨테이너로 묶고 모든 원래 타일을 유지한다. 작은 인쇄 글자 이미지도 보관한다. 묶임은 시각 후보이고 소속은 문서 패스에서 별도로 부여한다.
- `document-ownership.ts / assignDocumentOwnership()`: 헤더에서 섹션 인스턴스와 인쇄 페이지를 확보한 뒤 문항·공통 지문·안내 영역의 소속을 구분한다. 원문 번호는 섹션마다 유지하고 UUID를 고유 ID로 쓴다. 문항 번호와 범위 머리말은 서로 다른 사건이다. 새 범위 머리말이 이전 문항을 종료하며, 열린 지문은 다음 flow/page까지 parts로 이어진다.
- 지문 처리는 숫자 범위만으로 켜지지 않는다. 같은 행에 읽기·응답 안내가 관측돼야 한다. 수학 스캔의 `[6-51]` OCR 오류가 국어 지문 경로를 켜는 회귀를 발견해 차단했다.
- 번호 후보는 왼쪽 정렬·기존 검증 근거·동일 위치 관측·섹션 순서·열린 지문 범위·래스터 내부 여부를 함께 본다. 자료 내부 목록이나 순서 충돌을 원문에 없는 번호로 보정하지 않는다. 원문과 보류 이유를 유지한다.
- 들여쓴 본문 때문에 단의 바깥 경계가 안쪽으로 잡힌 경우, 같은 gutter 안의 원본 위치와 OCR 관측으로 바깥 경계를 보완한다. 파일별 단 좌표를 지정하지 않았다.
- `layout-blocks.ts / buildBlocks()`: 여러 OCR 패스가 같은 잉크를 읽었을 때, 앞 패스가 성분을 사용했다는 이유로 뒤 패스가 넓은 OCR bbox로 돌아가던 문제를 수정했다. 같은 물리 잉크 지지 범위를 공유한다.
- 헤더·푸터를 글자 목록에서만 빼면 원시 획/도형이 다시 박스를 늘렸다. 확인된 margin 행과 제목 아래 PDF 가로선을 함께 써서 내용 구역을 정한다. 가로선은 제목·첫 본문 앵커와의 위치 관계가 맞을 때만 헤더 경계에 사용한다. 일반 표·분수선은 일괄 삭제하지 않는다.
- `확인 사항` 글자 위에서만 멈추면 안내 상자의 테두리가 이전 문항에 붙었다. 해당 글자를 감싼 독립 상자의 시작을 경계로 사용한다. 안내 자체는 `instructions`에 남긴다.
- 문항 전용 보기/표/그림은 `auxiliaryParts[]`로 여러 개 보존한다. 이 배열은 본문 parts 안의 자료 위치를 설명하며, 출력 시 본문에 다시 중복 삽입하는 배열이 아니다. 배점으로 하단 자료를 자르지 않는다.
- `selectDocumentContent()`: 선택한 문항의 필요한 공통 지문 전체를 한 번씩 포함한다. 다른 선택 문항을 강제로 추가하지 않으며 원본 픽셀 속 번호를 바꾸지 않는다.
- `updateDocumentPart()`: 문항과 공통 지문 모두 수동 경계를 바꾸면 표시 group과 소유자의 part가 동시에 바뀐다. 선택 구성도 그 좌표를 사용한다.

## 화면과 데이터

문항 카드에 과목·원문 번호·연결 지문을 표시한다. 공통 지문 카드에서는 여러 페이지 조각을 원래 순서로 볼 수 있다. 문항 선택과 `선택 구성 JSON 받기`, 공통 지문 조각 경계 조절을 추가했다. 자료 내부 숫자를 숨겨서 성공으로 표시하는 대신 관계와 문항 상태는 `needs-review`로 유지한다.

추가 데이터: `DocumentSection`, `SharedSet`, `SourceContainer`, `QuestionRegion.auxiliaryParts`, `Observation.geometryStatus/textStatus`, `pageMetadata`, `instructions`, PDF `horizontalRules`.

원본 Blob·네이티브 관측·OCR 패스·좌표 변환·타일 목록은 유지한다. 결과 JSON에는 원문 글자도 포함되므로 이 문서의 실행 산출물은 `.gitignore`의 로컬 전용 경로 아래 둔다.

## 실파일 검증

입력: 사용자 제공 국어 PDF 20쪽 및 `korean_exam_regression.json`. SHA-256을 확인한 뒤 비교한다. 색상/형태 전처리는 끈 상태다.

기존 브라우저 실행은 논리 문항 64개였다. 중간 수정 빌드를 처음부터 실행한 결과는 공통 34개, 화법과 작문 11개, 언어와 매체 11개와 공유 지문 14세트였다. 20쪽 전체는 56개이며 공통과 선택 과목 하나를 조합하면 45개다. 동일 OCR을 재사용한 최종 geometry 비교에서는 문항 56조각과 지문 27조각을 얻었다.

독립 fixture 어댑터는 다음을 각각 검사한다.

- 섹션별 고유 번호·물리 페이지·단, 제공된 번호 앵커 포함.
- 14개 지문의 문항 소속과 여러 단/페이지 조각 순서.
- 알림 화면·블로그·댓글·카드 뉴스 타일의 결합과 소유자 영역 포함.
- 옛한글 작은 이미지 4개의 포함.
- 물리 페이지와 별도의 인쇄 페이지; 선택 과목 시작의 `1`도 OCR 관측으로 확보.
- 10번+12번 및 12번 단독 선택의 지문 중복 방지와 전체 조각 포함.
- 36번의 복수 전용 자료, 마지막 안내 상자의 별도 소속과 문항 crop 제외.

총 323개 assertion은 위 필드/좌표 조건을 나눈 수치이지 323개 독립 문항이나 픽셀 정확도 점수가 아니다. fixture의 서술형 회귀 항목 26개를 전부 자동 검증했다고 표시하지 않는다. 본문 bbox와 정답 픽셀 마스크가 없어 모든 본문·선택지·밑줄·각주 픽셀의 완전성은 자동 판정하지 못한다.

실행별 최종 수치, 브라우저 UI 검사 결과, 실패 항목은 `output/korean-regression/report.md`에 기록한다. 전후 오버레이 전체는 `output/korean-regression/comparison/index.html`, 원시 관측 → 블록 → 최종 범위는 `scripts/render-region-stages.mjs`의 JSON/PNG로 확인한다.

## 비용과 미검증 범위

중간 수정 브라우저 실행은 20쪽 약 539초, OCR 요청 258회였다. 기존은 약 540초, 255회였다. 각 1회 실행으로 속도 개선을 주장하지 않는다. 외부 API 호출은 없지만 로컬 CPU/WASM 연산 비용과 대기 시간은 크다. JS heap 표본 최대 약 364 MB는 전체 브라우저·WASM·GPU peak memory가 아니다. 선택 영역만 재인식하는 최적화는 후속 과제다.

- 이 파일에서 범위가 명시된 국어 지문을 검증했다. 범위 없는 지문, 모든 영어 유형, 3단·중간 단 전환·원근 스캔을 검증한 것이 아니다.
- 섹션 제목의 소규모 OCR 오자는 기존 과목명과 편집 거리로 비교한다. 제목이 사라진 섹션 재시작, 다른 과목의 새 섹션 자동 분류는 남은 한계다.
- 래스터 컨테이너 내부의 문항 번호를 보류하므로 문항 전체가 작은 이미지로 삽입된 자료에는 추가 검토가 필요하다. 타일 폭·맞닿음만으로 의미상 같은 자료임을 보장하지 않는다.
- 공통 지문의 연결은 범위·읽기 순서 근거의 검토 대상이며 의미 이해를 완료한 것이 아니다. 누락 페이지의 내용을 만들지 않는다.
- 기존 수학 스캔은 같은 OCR 관측의 geometry 재실행으로 확인했다. 22문항/22조각을 유지하지만 8→49 오인식과 11·14의 마침표 누락 등 기존 4개 실패가 남는다. 새 OCR 실행이나 필기 제거 품질 개선으로 보고하지 않는다.
- 사용자 수정 시간, 독립 출처 일반화, 인쇄 픽셀 마스크, 영구 저장 후 재출력은 이번 실험 검증 범위가 아니다.

## 재현

```sh
npm test
npm run typecheck
TEACHWAY_BUILD_DIR=.next-korean npm run build
TEACHWAY_BUILD_DIR=.next-korean npm run start -- --port 3036
LAB_BASE_URL=http://localhost:3036 node scripts/verify-lab-regions.mjs korean-final /path/to/국어영역_문제지.pdf /path/to/1111.pdf /path/to/2222.pdf
node --import tsx scripts/check-korean-fixture.mts /path/to/korean_exam_regression.json /path/to/app-export.json /path/to/국어영역_문제지.pdf
node scripts/render-korean-comparison.mjs /path/to/before.json /path/to/after.json /path/to/render-directory /path/to/output-directory
```

OCR 고정 비교: `scripts/replay-korean-ownership.mts input.json source.pdf output.json`. 이것은 원본 PDF geometry를 다시 읽고 저장된 OCR을 재사용하는 비교다. 신규 OCR 성공 결과로 해석하지 않는다. 단순 기존 geometry 재실행은 `scripts/replay-region-geometry.ts`를 사용한다.
