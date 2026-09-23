# 작업 내역

최신 기록을 위에 추가한다. 과거 상세 내용은 `04-implementation-log.md`에 보존한다.

## 2026-09-23 — 누적 등록 개선 커밋·푸시 요청
- 범위: 파일 drop→모달/분석 안내/직접 영역 editor/번호·배점 제거/지문 자동 묶음/헤더 저장·큰 preview/목록 scroll 제거 + AGENTS/kb·검증 스크립트.
- 검증: 최신 격리 build·타입 검사 통과(next-env 복원), diff 검사 통과. 이전 기본81/UI6·Chrome 검증은 각 항목 참조. 기존 이슈 유지(KB-011 전체20쪽 시간 제한 포함).
- Git: `5543512` 구현+AGENTS/kb 커밋, `origin/main` push 성공(b6fe8b0→5543512). 직후 HEAD=origin/main·clean 확인. 이 항목은 후속 문서 기록.

## 2026-09-23 — 저장할 문제 목록 스크롤 제거
- 변경: `studio.css` compact list 높이 제한·내부 overflow 제거(모바일/지문 조건 포함). `document-review.tsx` 목록 내부 자동 scroll 제거. 전체 번호 펼침, 긴 내용은 sidebar/모달 본문 scroll.
- 검증: Chrome editor smoke 통과; 1366 desktop/390 mobile 목록 scrollHeight≤clientHeight·overflow visible, 편집/저장/폭 검증. desktop 시각·diff 확인. 타입/빌드/전체 엔진 반복 안 함. 기존 이슈 유지; 커밋·푸시 없음.

## 2026-09-23 — 최초 import 지문 자동 묶음
- 변경: `passage-bundles.ts:autoBundlePassages` 기존 materialIds로 초기 bundle 설정. PDF adapter/한글 importer에만 적용, 검토 중 해제·수정 재적용 없음. 연결 중첩/영역 충돌은 보존; OCR/bbox 불변. 수동 묶기 기본값 대체.
- 검증: 기본81·타입·diff 통과. 실제 국어 앞3쪽 Chrome: 자동1–3/4–9묶음, 전체 preview, 해제 후 이동 유지/undo/선택/1카드 저장·reload 통과. 첫 smoke는 해제 뒤 live locator가 다음 묶음을 가리켜 실패→ID 고정 후 통과.
- 한계: 전체20쪽 smoke 180초 제한(6쪽 분석 중) KB-011. 실제 HWP/전체 build 이번 반복 안 함. 커밋·푸시 없음.

## 2026-09-23 — 지문 묶음 식별
- 변경: `document-review.tsx` 소속 문제 선택도 묶음 전체 preview(지문→번호별 문제), 범위·개수 안내/묶음 수정 이동/번호 chip 연결 아이콘. `QuestionCard.tsx` 이미지 위 지문 묶음·번호 범위 badge. CSS, bundle smoke 갱신. 저장/OCR 불변.
- 검증: 타입·diff 통과. Chrome 소속 1번 선택→범위/4영역 preview, 해제/undo/모바일/1카드 저장·badge/시험지 연결 통과; desktop 시각 확인. 전체 엔진/빌드 반복 안 함. KB-010 해결. 커밋·푸시 없음.

## 2026-09-23 — 헤더 저장 / preview 확대 / 세부 옵션 삭제
- 변경: 파일 추가·제외 버튼 삭제. `registration-header.tsx` portal로 문서·이미지 확인/저장 헤더 이동, X 같은 헤더. preview 접기 제거·폭 전체·남는 높이 사용. `document-review.tsx` 옵션 UI/상태/핸들러 제거(이름·종류·연결/정밀 영역/합치기·분할/재분석·trace); 직접 editor·지문 묶기·자동 번호/배점 제거 유지. 이전 옵션/하단 저장 결정 대체.
- 검증: 타입·UI6·격리 build 통과(next-env 복원). Chrome editor/이미지 intake/다중 파일 진행·저장/지문 묶음/cleanup pixel 일치 통과, pageerror 없음. 1366/1440 헤더 노출·preview 폭·모바일 폭 및 시각 확인.
- 범위: OCR·저장 모델 유지; 전체 엔진 반복 안 함. 기존 이슈 유지. 커밋·푸시 없음.

## 2026-09-23 — 등록 UI/UX 단순화
- 변경: `document-review.tsx` 오른쪽 기본 선택/preview/지문 범위/고정 저장, 정밀 기능은 세부 옵션. `region-canvas.tsx` ResizeObserver desktop 한 쪽 fit/mobile 너비 fit. `studio.css` 모달 inset8px/mobile 전체, 원본 비중≈52%, 독립 sidebar scroll. 지문 UI 문구 간결화, smoke selector 갱신.
- 검증: 타입·UI6·격리 build 통과(next-env 복원). Chrome editor(드래그/resize/undo/좌표 저장), 지문 묶음→시험지, 번호 제거 preview=저장, 다중 파일 분석/중단/수정/저장/모바일 통과; pageerror 없음. 모달 크기/원본 비율/한 쪽 fit/옵션 기본 닫힘 검증. 데스크톱·모바일 시각 확인.
- 범위: UI만; OCR·저장 모델 유지. 전체 엔진 테스트 반복 안 함. 기존 이슈 유지. Git 커밋·푸시 없음.

## 2026-09-23 — 지문+문제 범위 한 항목 저장
- 변경: `passage-group-editor.tsx`, `passage-bundles.ts` 범위 지정·변경/해제, 단위 선택/undo, 겹침·번호 재시작 영역 검증. `prepare-registration/review/types/reuse` 그룹 1row/snapshot + 순서 있는 fragments, 원본 개별 record/자산 보존. 보관함 badge·미리보기 연결.
- 검증: 기본79+UI6, 타입, 격리 build 통과(next-env 복원). Chrome 실제 PDF에 지문 영역 추가 → 1~3범위 오류/묶기/변경/해제/undo/단위 선택/preview → 1카드 저장 → 1시험지 snapshot·4fragments·원본 개별 record 보존/새로고침. 모바일 폭·스크린샷 확인; pageerror 없음.
- 한계: 장문 실자료의 다중 페이지 묶음 브라우저 미검증(다중 fragment 순서 unit 검증). 여러 지문에 같은 문항 중복 묶기 금지. 기존 OCR/이슈 유지.
- 검증 중 `.next/types` 생성 경합으로 첫 typecheck 실패, 재실행 통과(KB-003). Git 커밋·푸시 없음.

## 2026-09-23 — 모달 hard navigation redirect
- 변경: `app/questions/new/page.tsx`, `app/question/new/page.tsx` → `/questions` redirect. 인터셉트 route 유지; 이전 전체 페이지 fallback 대체.
- 검증: `verify-library-intake.mjs` Chrome 통과(soft 모달/새로고침/직접 URL 2종/재진입/기존 파일 전달·저장/모바일); pageerror 없음. diff 검사 통과. 단순 route 변경으로 전체 타입·빌드 재실행 생략.
- Git: 커밋·푸시 없음. 기존 이슈 유지.

## 2026-09-23 — 이미지 번호·배점 제거
- 요청: 페이지 확인 사항 UI 삭제; 제목 문자열 아닌 이미지 속 번호/배점 제거.
- 변경: `print-cleanup.ts` 신뢰 위치 기반 독립 번호/괄호 배점 mask, 주변 글자 경계 제한; PDF 관측/줄 좌표 재사용. 미리보기·compose 동일 mask, 저장 erasures+원본 유지. `document-review/region-canvas` 자동 제거 toggle·드래그 지우기·undo. OCR 규칙/패스 유지.
- 검증: 타입·격리 빌드 통과(next-env 복원). 기본72+UI6 통과 뒤 padding 보완 후 cleanup7 재검증 통과. Chrome 실제 PDF 번호/합성 스캔 배점: toggle·수동 지우기/undo·저장 이미지=preview mask 픽셀 일치·나머지 본문/원본 보존. 기존 editor smoke 통과.
- 한계: KB-009 스캔 fixture 번호 오인식/0영역 → 수동 영역 지정 사용. 확실하지 않은 번호·본문과 합쳐진 글자·괄호 없는 배점은 직접 지우기. HWP/터치 지우기 별도 미검증.
- Git: 커밋·푸시 없음. 다음: 실제 자료 피드백.

## 2026-09-23 — 마우스 영역 editor / kb 압축
- 요청: 직접 추가·수정, 오른쪽 지문/문제 번호만; kb agent-only 최소 토큰.
- 변경: `region-canvas.tsx` pointer capture·이동/8방향 resize·직접 그리기·Escape/키보드; `region-edit.ts` 정규화/경계 제한. `document-review.tsx` 2열·번호 그룹·undo 상태 복원·zoom·접힌 상세 설정. CSS, 브라우저 검증 추가. OCR 로직 유지.
- 검증: 타입, 기본66+UI6, 격리 빌드 통과(next-env 복원). Chrome 등록 smoke + editor: 드래그/resize/undo/취소/삭제 복구/zoom/쪽 이동/모바일 폭/저장 좌표 확인; pageerror 없음. 데스크톱·모바일 스크린샷 확인.
- 기록: AGENTS/README에 압축 원칙, handoff 압축·최신화. KB-008 해결; KB-001~005/007 유지. 실제 HWP/터치 제스처/전체 OCR 정확도 미검증.
- Git: 커밋·푸시 없음. 다음: 사용자 조작 피드백.

## 2026-09-23 — 왼쪽 원본 스캔 효과 제거

- 요청: 왼쪽 시험지에서는 스캔 효과를 없애기.
- 변경: `AnalysisWorkspace.action.tsx`의 원본 스캔 오버레이·래퍼와 `app/studio.css`의 전용 선·빛 자국·키프레임 제거. 원본 이미지, 중앙 종이 모션, 진행 안내는 유지.
- 검증: 변경 파일 Prettier 및 diff 검사. 단순 시각 효과 제거로 브라우저·타입·전체 테스트·빌드는 재실행하지 않음.
- 방향: 직전 원본 스캔 강화 요청은 최신 제거 요청으로 대체. 기존 이슈 유지.
- Git: 커밋·푸시하지 않음.

## 2026-09-23 — 왼쪽 원본 시험지의 하강 스캔 선 강화

- 요청: 왼쪽 시험지에서도 선이 아래로 내려가는 스캔 애니메이션.
- 변경: `app/studio.css`의 원본 스캔 선을 2px 키컬러와 옅은 빛 자국으로 강화하고 3.6초 일정 속도 하강으로 변경. 중앙 종이 모션과 분리. 현재 분석 페이지에만 표시하고 reduced-motion 대응 유지.
- 검증: 이미지형 2쪽 PDF로 기존 브라우저 검증 실행, OCR 단계 전환·검토·저장·모바일 확인 통과 및 pageerror 없음. 재확인 단계 스크린샷에서 원본 위 선 시각 확인. Prettier 및 diff 검사 통과.
- 미실행 검증: CSS 소규모 변경으로 타입·전체 테스트·빌드는 새로 반복하지 않음. 기존 이슈 유지.
- Git: 커밋·푸시하지 않음.

## 2026-09-23 — OCR 재확인의 목적과 이유를 단계별로 안내

- 요청: 사용자에게 처리가 오래 걸리는 이유가 보이도록 ‘한 번 더 확인할게요’ 같은 세부 진행 안내 제공.
- 변경: `ImportProgress.stage`와 `analyze-pdf.ts`의 진행 이벤트로 실제 OCR 대상·읽기 방식·확대/숫자 전용 작업을 구분. 준비·캐시 재사용·형태 분류·문서 연결도 보고. `registrationHelpers.lib.ts`에서 작업 설명과 이유를 각각 매핑하고 분석 UI에 표시. OCR 패스 수·순서·규칙은 유지. 기존 포괄 문구를 세분화한 후속 수정이다.
- 검증: 타입 검사, 기본 테스트 63개, UI 계약 테스트 6개 통과. 직접 만든 2쪽 이미지형 PDF로 기존 브라우저 검증 스크립트의 `--check-ocr-stages` 실행: 전체 글자 읽기 → 짧은 글자 재확인 → 형태 확인 → 다음 쪽 캐시 재사용 → 페이지 간 연결 안내를 실제 DOM에서 관측. 재확인 단계 스크린샷 확인, 수정·저장·모바일 검증 통과, pageerror 없음.
- 미실행 검증: 다단·번호 확대·헤더 숫자 재확인 각각을 유발하는 별도 fixture, HWP/HWPX 세부 단계 연결. 후자는 기존 메시지 안내 유지. 코드 조회에서 한글 OCR 소수 진행률의 페이지 표시 위험을 발견해 KB-007 기록.
- 추가 검증: `.next-registration` 격리 프로덕션 빌드 통과. next-env 생성 참조 복원.
- 다음 행동: 각 안내는 실제 실행 중인 작업과 대응해야 한다. 문구를 시간으로 순환하거나 처리 횟수만 보고 목적을 추측하지 않는다.
- Git: 커밋·푸시하지 않음.

## 2026-09-23 — 분석 진행 안내를 쉬운 말로 변경

- 요청: ‘OCR(숫자)’ 대신 사용자에게 무엇을 하는지 간단히 설명.
- 변경: `registrationHelpers.lib.ts`에 화면용 진행 메시지 변환 추가. `AnalysisWorkspace.action.tsx`, `ImportProgress.action.tsx`에서 원본 불러오기·글자 읽기·문제 위치 찾기·문제와 지문 정리 안내를 사용. 최종 연결 단계 제목도 쉬운 말로 변경. 엔진 진단 문자열·처리 규칙·쪽수 데이터는 유지.
- 검증: 타입 검사, UI 계약 테스트 6개, 변경 파일 Prettier 및 diff 검사 통과.
- 미실행 검증: 문구 변경 후 별도 브라우저·프로덕션 빌드 재실행. 기존 이슈 상태 유지.
- 다음 행동: 사용자 문구 피드백 반영.
- Git: 커밋·푸시하지 않음.

## 2026-09-23 — 분석 스핀을 종이·스캔 모션으로 대체

- 요청: 어색한 회전 로딩 대신 더 인터랙티브한 표시.
- 변경: `AnalysisWorkspace.action.tsx`의 원본에 현재 분석 페이지에서만 움직이는 스캔 선, 중앙 작은 종이 모션과 쪽수 전환, 실제 완료 쪽수 기반 분할 진행선 추가. 페이지 행과 `ImportProgress.action.tsx`의 회전 아이콘은 작은 막대 모션으로 대체. `app/studio.css`에 페이지 hover/focus 및 reduced-motion 대응 추가. OCR 엔진·등록 데이터 흐름은 이번 수정에서 변경하지 않음.
- 검증: 타입 검사와 UI 계약 테스트 6개 통과. 실제 3쪽 PDF 단일 파일로 분석 화면·3열 검토·수정·저장·모바일 가로 넘침 검증 통과, pageerror 없음. 분석 화면 스크린샷 시각 확인. 격리 프로덕션 빌드 통과 및 next-env 생성 참조 복원. 등록 소스에 Loader2/spin 사용이 남지 않음을 확인.
- 미실행 검증: OS reduced-motion 설정을 바꾼 별도 브라우저 검증, 전체 엔진 테스트 재실행. 엔진 미변경이며 기존 열린 이슈 KB-001~005 유지.
- 다음 행동: 사용자 모션 취향 피드백에 따라 강도·속도 조정.
- Git: 커밋·푸시하지 않음. 앞선 등록·모달 변경 유지.

## 2026-09-23 — 등록 모달 실제 분석 진행 표시와 3열 검토 디자인

- 요청: 모달의 분석 스켈레톤을 현재 분석 쪽수 등 실제 진행 화면으로 바꾸고 결과 화면도 같은 배치로 디자인.
- 변경: `AnalysisWorkspace.action.tsx`에서 원본, 현재/전체 쪽수, 완료 쪽수, 페이지 선택 표시. `onPageRendered` 콜백을 엔진→등록 어댑터→핸들러로 연결하되 기존 Blob을 재사용하고 OCR 규칙·패스·영역 계산은 유지. 한글 importer는 분석 완료된 페이지를 전달. `document-review.tsx`의 기존 조작을 원본/문항/설정·저장 3열로 재배치. `app/studio.css`에서 공통 종이 테마·모바일 세로 배치·데스크톱 패널별 스크롤 적용. 스켈레톤 JSX 제거.
- 실행 검증: 기본 테스트 63개, UI 계약 테스트 6개, 타입 검사 및 `.next-registration` 격리 빌드 통과. next-env 생성 참조 복원. `verify-registration-progress.mjs`를 현재 요구에 맞게 갱신해 실제 3쪽 PDF의 단일/3파일 등록, 분석 중 원본 선표시, 22개 결과 확인, 완료 파일부터 검토, 분석 중단 후 완료 결과 보존, 이름 수정·페이지 이동·선택 확인·저장·목록 복귀 확인. pageerror 없음. 390px 모바일 작업영역 가로 넘침 없음, 설정·저장 화면 시각 확인. 데스크톱 저장 버튼 viewport 내 위치 검증.
- 미실행 검증: HWP/HWPX 실제 파일의 새 미리보기 콜백, 광범위 OCR/bbox 정확도 재평가. 페이지별 잠정 문항 크롭은 구현하지 않음(KB-001 유지).
- 이슈: KB-006 해결, KB-001은 원본 미리보기 연결 사실만 갱신. KB-002~005는 별도 유지.
- 다음 행동: 사용자 화면 피드백 반영. 미완료인 페이지별 문항 선표시와 현재 실제 원본 표시를 구분할 것.
- Git: 커밋·푸시하지 않음. 앞선 빈 보관함 파일 진입 변경과 기존 AGENTS/kb 변경 유지.

## 2026-09-23 — 빈 보관함에서 파일 선택·드롭 후 등록 모달 열기

- 요청: 등록 모달을 먼저 열어 파일을 넣는 대신 빈 보관함에서 클릭/드롭으로 파일을 받고, 파일이 있을 때 모달을 열기.
- 변경: `QuestionList.action.tsx` 빈 영역 전체에 접근 가능한 파일 선택 버튼·다중 선택 input·드롭 강조 연결. `Questions.handler.tsx`에서 파일 전달 후 기존 인터셉트 경로로 이동. `src/_state/RegistrationIntake.tsx`와 `app/layout.tsx`의 메모리 Provider를 통해 `Registration.handler.tsx`가 파일을 한 번만 받아 기존 ingest를 실행. Strict Mode effect 재실행 시 소비·취소 충돌 방지. `app/studio.css`에서 드롭·키보드 포커스 표시 추가. PDF/OCR 엔진은 변경하지 않음.
- 검증: 타입 검사 통과, 기본 테스트 63개 및 UI 계약 테스트 6개 통과, `TEACHWAY_BUILD_DIR=.next-registration npm run build` 통과. 생성된 next-env 참조는 기존 `.next`로 복원.
- 브라우저: `scripts/verify-library-intake.mjs` 추가·실행. localhost:3003의 임시 Chrome 컨텍스트에서 선택 취소, 키보드로 이미지 2개 선택, 모달 자동 전달, 닫기·뒤로/앞으로 후 중복 없음, 드롭 강조 및 이미지 전달, 저장 후 목록 갱신, 기존 등록 링크, 직접 새로고침 확인. pageerror 없음. 390px 모바일 가로 넘침 없음 및 데스크톱/모바일 스크린샷 시각 확인. 최초 검증 스크립트는 닫힘 애니메이션 중 드롭하는 경합으로 실패해 닫힘·URL 복귀 대기를 추가한 뒤 통과.
- 미실행 검증: 새 진입 경로의 실제 PDF/HWP/HWPX 파일 처리 재현, OCR 정확도 재평가. 기존 KB-001~005 유지.
- 다음 행동: 사용자의 실제 파일 흐름 피드백에 따라 조정. 페이지별 미리보기는 별도 미완료 항목.
- Git: 커밋·푸시하지 않음. 사용자 저장 자료와 기존 서버 프로세스 보존.

## 2026-09-23 — 현재 프로젝트와 세션 분석

- 요청: 현재 프로젝트 구조, 구현 상태, 이전 세션 인수인계와 실제 코드의 일치 여부 분석.
- 확인: 브라우저 IndexedDB 저장 및 로컬 진입 플래그, PDF 등록의 `analyzePdf()` 연결, `legacy` OCR 정책, 전체 파일 완료 후 검토 상태 갱신을 확인. 페이지별 즉시 미리보기의 연결 부재를 KB-001에 추가하고 README 불일치를 KB-005로 기록.
- 변경: `kb/issues.md`, `kb/05-handoff.md`, `kb/worklog.md`만 갱신. 앱 코드·OCR 규칙은 변경하지 않음.
- 실행한 검증: `npm test` 63개 통과, `npm run test:ui` 6개 통과, `npm run typecheck -- --incremental false` 통과. 프로세스 조회에서 해당 프로젝트 경로의 Next.js 개발 서버 실행 확인. 서버 응답·포트는 검증하지 않음.
- 미실행 검증: 프로덕션 빌드, 브라우저 화면·모바일 확인, 실제 PDF/OCR 재현, 원격 fetch. 남은 이슈 KB-001~005.
- 다음 행동: 우선순위 제안은 페이지별 미리보기 연결, 로그인 모바일 검증, README 정리. 구현 요청 전에는 분석 결과로 유지.
- Git: 분석 시작 시 `main...origin/main`, HEAD `b6fe8b0`, `AGENTS.md`와 `kb/` 미추적. 커밋·푸시하지 않음.

## 2026-09-23 — 세션 지식과 자동 인수인계 구성

- 요청: 세션 내용을 kb Markdown으로 저장하고, 다음 에이전트가 읽고 이슈·작업 내역·방향을 계속 기록하도록 구성.
- 변경: 제품, PDF 엔진, UI 디자인, 구현·검증 기록, 인수인계 문서를 `kb/`에 작성. 루트 `AGENTS.md`에서 세션 시작 필독 및 종료 시 갱신 절차 연결. `issues.md`, `worklog.md` 추가.
- 검증: 생성 파일과 상대 링크 존재 확인, `git diff --check` 확인. 문서 작업이며 앱 테스트는 새로 실행하지 않음.
- 남은 사항: KB-001~004 참고. 기존 기능의 불확실성을 해결된 것으로 기록하지 않음.
- Git: 이 문서 변경은 아직 커밋·푸시하지 않음. 작성 전 기준 main/origin/main은 `b6fe8b0`.
- 다음 행동: 새 작업 시작 시 AGENTS 지침과 인수인계를 읽고 해당 작업의 실제 코드를 확인.

## 2026-09-22 — 로그인 디자인 확정 및 푸시

- 변경: 로그인 종이·격자 테마, 마우스 반응 SVG 도면, 느린 원호 회전, 단계 안내 간소화, 헤더·푸터 제거, 본문 위 로고 배치.
- 관련 파일: `app/studio.css`, `src/screens/session/`.
- 검증: 배경 구현 시점의 타입 검사 및 UI 테스트 6개 통과, 데스크톱 화면 확인. 마지막 소규모 수정은 diff 검사. 최종 모바일 검증은 KB-002.
- Git: `b6fe8b0` 커밋, origin/main push 성공 확인.

## 2026-09-22 — 작업 화면 종이 테마와 등록 UI 푸시

- 변경: 로고/메뉴/푸터 정돈, Pretendard 자체 호스팅·preload, 빈 보관함 재구성, 빈 상태 등록 버튼 및 검색·정렬 숨김, 등록 모달과 진행 UI.
- 검증: Pretendard 적용 뒤 격리 빌드 및 preload 태그 확인, UI 테스트 6개 통과, 주요 화면 시각 확인. 상세 검증 범위는 구현 기록 참고.
- Git: `4f9b03a` 커밋, origin/main push 성공 확인.

## 기록 양식

```md
## YYYY-MM-DD — 작업명
- 요청:
- 변경/관련 파일:
- 실행한 검증/결과:
- 미실행 검증/남은 이슈:
- 결정/다음 행동:
- Git:
```
