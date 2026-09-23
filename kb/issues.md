# 이슈 추적

상태: `확인 필요` / `진행 중` / `차단` / `해결` / `보류`.
‘해결’에는 실제 실행한 검증 근거가 필요하다. 미검증 항목을 장애로 단정하지 않는다.

## KB-001 — 동일 PDF 페이지별 미리보기의 현재 연결 상태

- 상태: 확인 필요
- 등록: 2026-09-23
- 증상/근거: 과거 onPageReady 및 ProgressiveReviewAction 구현·브라우저 검증 기록이 있으나, 이후 소스 조회 및 최종 커밋 목록에서 해당 경로가 보이지 않았다. 제거 이유는 확인되지 않았다.
- 2026-09-23 현재 코드 확인: `analyzePdf()`는 페이지 루프가 끝난 뒤 전체 구조·문항 소속을 계산해 반환한다. 등록 핸들러는 `await readDocument()` 이후에만 documents와 reviewId를 갱신한다. `onPageReady`와 `ProgressiveReviewAction`은 현재 소스에 없다. 파일별 완료 검토는 연결돼 있으나 동일 PDF의 페이지별 결과 선표시는 연결돼 있지 않다.
- 2026-09-23 후속 UI 변경: `onPageRendered`로 분석 중 실제 원본 페이지를 보여주고 현재 쪽수·페이지별 완료 상태를 연결했다. 실제 3쪽 PDF의 처리 중 원본 표시를 브라우저로 검증했다. 페이지별 잠정 문항 bbox·크롭은 추가하지 않았으며, 문항 결과는 전체 파일 연결 분석 후 표시한다. 따라서 기존 요구의 문항 선표시까지 해결된 상태는 아니다.
- 관련 파일: `lib/pdf-region-engine/analyze-pdf.ts`, `lib/documents/pdf-registration.ts`, `src/screens/registration/`.
- 다음 행동: 현재 등록 호출 경로와 이벤트·상태 전달을 확인한 뒤 실제 다중 페이지 PDF로 완료 페이지 선표시 여부를 재현한다.
- 해결 검증: 미실행. 상세 이력은 `04-implementation-log.md` 참고.

## KB-002 — 로그인 최종 디자인 모바일 확인

- 상태: 확인 필요
- 등록: 2026-09-23
- 근거: 반응형 및 reduced-motion 규칙은 구현됐으나 마지막 헤더·푸터 제거/로고 배치까지 포함한 모바일 시각 회귀는 실행하지 않았다.
- 관련 파일: `app/studio.css`, `src/screens/session/`.
- 다음 행동: 작은 화면에서 가로 넘침, 글과 배경의 대비, 시작 버튼 접근성 및 동작 줄이기를 확인한다.
- 해결 검증: 미실행. 현재 오류가 확인된 것은 아니다.

## KB-003 — 개발/검증 빌드 디렉터리 공유 위험

- 상태: 보류
- 등록: 2026-09-23
- 근거: 과거 webpack 런타임 오류 이력. 여러 서버가 동일 `.next`를 사용한 정황이 있었으나 원인 확정은 하지 않았다.
- 관련 파일: `next.config.ts`, `next-env.d.ts`.
- 현재 대응: 검증 빌드는 `TEACHWAY_BUILD_DIR=.next-registration` 사용. 생성된 next-env 참조가 커밋에 섞이지 않도록 확인.
- 다음 행동: 오류 재발 시 실행 프로세스와 산출물 경로를 확인한다. 무관한 서버는 종료하지 않는다.

## KB-004 — 한국지리 20번 하단 안내 상자 포함

- 상태: 확인 필요
- 등록: 2026-09-23
- 근거: 기존 통합 검증 문서에 남아 있는 영역 과다 포함 한계. 현재 코드로 재검증하지 않았다.
- 관련 파일: PDF 영역 엔진 및 `docs/registration-integration.md`.
- 다음 행동: 동일 자료로 중간 블록과 최종 bbox를 비교하고 필요한 본문과 안내 상자의 소속 근거를 확인한다.
- 해결 검증: 미실행.

## KB-005 — README 실행 안내와 현재 기능 설명 불일치

- 상태: 확인 필요
- 등록: 2026-09-23
- 증상/근거: README 상단은 데모·샘플 UI 제거를 설명하지만 실행 안내에는 ‘데모로 시작하기’와 ‘샘플 문제 넣기’가 남아 있다. 실제 SessionHero의 버튼은 ‘내 작업실 시작하기’다. ‘원본 보존형 등록 엔진 실험’은 현재 UI를 대체하지 않았다고 설명하지만 현재 PDF 등록은 `importPdfQuestions()` → `analyzePdf()`를 호출한다.
- 관련 파일: `README.md`, `src/screens/session/_area/SessionHero.area.tsx`, `src/screens/registration/_lib/registration.lib.ts`, `lib/documents/pdf-registration.ts`.
- 다음 행동: 과거 검증 기록은 보존하면서 현재 실행 안내와 엔진 통합 상태를 구분해 정리한다.
- 해결 검증: 문서와 소스 불일치 확인. 문서 수정 및 실행 흐름의 브라우저 재검증은 미실행.

## KB-006 — 등록 모달의 분석·검토 배치 불일치와 하단 밀림

- 상태: 해결
- 등록/갱신: 2026-09-23
- 증상/근거: 사용자 피드백으로 분석 중 스켈레톤과 결과 화면 디자인 불일치 확인. 3열 변경 중 실제 여러 파일 화면에서 고정 높이 작업 영역과 상단 작업 목록이 합쳐져 저장 버튼이 초기 모달 화면 아래로 밀리는 것도 스크린샷으로 확인.
- 관련 파일: `app/studio.css`, `components/documents/document-review.tsx`, `src/screens/registration/_action/AnalysisWorkspace.action.tsx`, `scripts/verify-registration-progress.mjs`.
- 변경: 실제 원본·쪽수·페이지 진행 상태로 스켈레톤 대체. 완료 후 원본/문항 카드/설정·저장 3열 배치. 데스크톱은 남은 모달 높이를 채우고 패널별 스크롤, 모바일은 세로 배치.
- 해결 검증: 실제 3쪽 PDF 단일·여러 파일에서 원본 표시, 문항 검토·이름 수정·저장·목록 복귀, 완료 파일 보존 및 중단, 모바일 가로 넘침 없음 확인. 데스크톱 다중 파일 스크린샷에서 저장 버튼 노출 확인, 단일 파일에서는 버튼 bbox가 viewport 안에 있음을 자동 검증.
- 다음 행동: 실제 사용 피드백에 따라 간격 조정. 페이지별 잠정 문항 미리보기는 KB-001로 별도 유지.

- 2026-09-23 UI 재정리 후: 모달 확대·원본 한 쪽 fit·헤더 저장(직전 오른쪽 footer 대체)·상시 큰 preview. 단일/배치 Chrome 저장·모바일 재검증 통과. 이전 3열 배치는 폐기된 이력.

## KB-007 — 한글 OCR의 소수 진행률과 페이지 상태 표시 확인

- 상태: 확인 필요
- 등록: 2026-09-23
- 증상/근거: 코드 조회 중 HWP/HWPX importer가 OCR logger에서 `current: index + progress * 0.85`를 전달하는 것을 확인. 새 분석 UI는 current를 완료 쪽수와 현재 쪽수 계산에 직접 사용하므로 한글 OCR에서는 소수 쪽수 또는 이른 완료 표시가 나올 가능성이 있다. PDF current는 정수이므로 이번 PDF 검증에서는 재현되지 않았다.
- 관련 파일: `lib/documents/import.ts`, `src/screens/registration/_action/AnalysisWorkspace.action.tsx`.
- 다음 행동: OCR이 필요한 한글 파일로 재현하고 완료 페이지 수와 페이지 내부 진행률을 구분한다. 한글의 세부 OCR 단계 안내도 함께 확인한다.
- 해결 검증: 실제 한글 파일 재현 미실행.

## KB-008 — 영역 수동 편집 불편
- 상태: 해결 · 2026-09-23
- 근거: 사용자 추가/영역 수정 불편 피드백. 기존 다시 그리기·슬라이더 중심.
- 파일: `components/documents/{document-review,region-canvas}.tsx`, `lib/documents/region-edit.ts`, `app/studio.css`.
- 변경/검증: 직접 그리기·이동·8방향 resize·번호 그룹. Chrome 드래그/resize/undo/Escape/삭제 복구/zoom/페이지 전환/모바일 폭/저장 좌표 통과; geometry3+전체66/UI6·타입·빌드 통과.
- 다음: 실제 사용 피드백; 터치 제스처 별도 미검증.

## KB-009 — 스캔 번호 인식/배점 제거 한계
- 상태: 확인 필요 · 2026-09-23
- 근거: 합성 한글 스캔 fixture 3문항이 기존 엔진에서 0영역; 번호 1을 27로 오인식. 수동 영역 추가로 검증 진행. OCR 알고리즘 미변경.
- 파일: `lib/pdf-region-engine/`, `lib/documents/print-cleanup.ts`.
- 해결된 부분: 분리된 괄호/글자 bbox 때문에 배점 제거 누락 → 배점만 있는 고신뢰 줄 좌표도 사용; unit+Chrome 확인. 인식 불확실/본문과 합쳐진 번호는 수동 지우기 제공.
- 다음: 스캔 번호 회귀 원인 분리 검증. 실제 HWP·다양한 배점 표기 미검증. 괄호 없는 배점은 자동 처리하지 않음.

## KB-010 — 소속 문제 선택 시 지문 묶음 인지 어려움
- 상태: 해결 · 2026-09-23
- 근거: 사용자 첫 문제만 보임 피드백; preview가 active만 기준으로 구성되어 소속 문제 클릭 시 묶음 누락.
- 파일: `document-review.tsx`, `QuestionCard.tsx`, `studio.css`.
- 변경/검증: bundleOwner 기준 전체 preview·범위/개수 안내, 보관함 badge. Chrome 소속 문제 클릭→4영역/범위 표시, 해제·undo/1카드·시험지 저장 통과. 타입 통과.
- 다음: 실자료 피드백; 저장 모델/OCR 유지.

## KB-011 — 긴 실자료 브라우저 검증 제한
- 상태: 확인 필요 · 2026-09-23
- 근거: 국어 20쪽 초기 import smoke 180초 timeout; 6쪽 번호 재확인 중/5쪽 완료. UI 오류 확인 아님. 자동 묶기는 분석 후 적용.
- 파일: `scripts/verify-region-editor.mjs`, `lib/pdf-region-engine/analyze-pdf.ts`.
- 다음: 전체 자료 완료 시간 별도 측정; 이번 기능 검증은 앞 3쪽 표본 사용. OCR 변경 금지.
- 해결 검증: 앞3쪽 자동 묶음·해제/undo·저장/reload Chrome 통과; 전체20쪽 완료 미검증.

## 새 이슈 양식

```md
## KB-XXX — 제목
- 상태:
- 등록/갱신:
- 증상/근거:
- 관련 파일:
- 원인: 확인된 원인 또는 가설을 구분
- 다음 행동:
- 해결 검증:
```
