# Handoff · 2026-09-23

## 현재
- main: 등록/editor 누적 구현 `5543512` origin/main push 확인(2026-09-23). AGENTS/kb 포함; 후속 문서 기록은 이 커밋 이후. 실제 최신 HEAD는 git log/status 확인.
- `/questions/new` 직접 접속/새로고침 → `/questions`; `/question/new` 별칭도 동일. 내부 이동은 인터셉트 모달 유지.
- 빈 보관함 클릭/드롭 → File 메모리 1회 전달 → 등록 모달 자동 처리; 선택 취소는 열지 않음.
- 분석: 실제 원본·쪽수·진행선·중앙 종이 모션. 원본 스캔 선 제거(최신 결정). PDF 실제 stage별 쉬운 설명+재확인 이유. OCR 규칙/패스 유지.
- 검토 최신: 거의 전체 화면 모달, 원본/오른쪽≈52:48. desktop 한 쪽 fit + zoom. 오른쪽 번호 목록 전체 펼침(내부 스크롤 없음)/폭 전체 상시 preview/지문 범위. 긴 내용은 sidebar·모달 본문 scroll. 헤더 저장·확인·X, 파일 추가/제외 버튼 삭제. 세부 옵션 및 이름·연결·정밀 설정/합치기·분할/재분석·trace UI 삭제. 이전 큰 원본 비중 대체. 빈 곳 드래그 추가, 영역 이동, 8방향 resize, undo/Escape/delete/방향키, zoom. preview 접기 없음. 원본·프래그먼트/지문 의존성 보존.
- 최신: 페이지 확인 사항 숨김. 이미지 번호·배점 자동 제거 유지(toggle 삭제); 자동 인식 실패는 지우기 드래그/undo. preview/save 공통 mask, 원본 보존. `lib/documents/print-cleanup.ts`; KB-009 스캔 번호 한계. 제목 텍스트 변경 아님.
- 묶음 식별: 소속 문제 클릭도 전체 preview+번호 범위/개수 안내, chip 연결 아이콘, 보관함 이미지에 지문 묶음·범위 badge.
- 초기 자동 묶음(2026-09-23): PDF/한글 import에서 기존 materialIds의 지문별 문제를 bundleQuestionIds로 설정. 수동 묶기 기본값 대체. 연결 겹침/영역 충돌은 추정 병합 안 함; 검토 편집·해제 시 자동 재적용 없음.
- 지문 범위 묶기: `passage-group-editor.tsx`, `passage-bundles.ts`. 명시적 bundleQuestionIds로 전체 선택/해제. 각각 compose 후 지문→문제 fragments를 한 library row로 묶음; 원본 child records/자산 유지. 범위 변경/해제/undo; 기존 일반 materialIds 독립 선택 유지.
- 핵심: `components/documents/{document-review,region-canvas}.tsx`, `lib/documents/region-edit.ts`, `app/studio.css`; 진행 UI `src/screens/registration/`.

## 선호/운영
- kb agent-only, 토큰 최소화: 사실·근거·검증·미완료만. 최신 지시 우선.
- 바로 구현, 불필요한 확인·배너·중복 버튼 줄이기. 종이/회색 격자/얇은 선, 기존 키컬러, 활성 페이지 밑줄.
- UI 때문에 OCR 정확도 변경 금지; 원본·사용자 변경 보존. 기술 OCR 용어/횟수 대신 실제 작업+이유.
- 시작 git status; 기록을 현재 코드로 확인. 기존 localhost:3003 서버 보존.
- 빌드 `TEACHWAY_BUILD_DIR=.next-registration npm run build`; 이후 next-env 참조 `.next/types/routes.d.ts` 복원(KB-003).

## 검증/다음
- editor: 타입·기본66+UI6 통과. Chrome: 직접 추가/이동/resize/undo/Escape/삭제 복구/zoom/쪽 이동/모바일 폭/IndexedDB 좌표 저장 통과. 기존 등록 smoke도 통과.
- 초기 자동 묶음: 기본81·타입·국어 앞3쪽 Chrome 저장/reload 통과. 전체20쪽은 180초 timeout(KB-011).
- 최신 빌드 결과는 worklog 참조. 광범위 OCR 정확도·실제 HWP는 이번 미검증.
- KB-001 잠정 문항 크롭 선표시 미구현(원본 선표시는 완료); KB-002 로그인 모바일; KB-004 한국지리20 하단; KB-005 README; KB-007 HWP 소수 진행률.
- 별도 범위: 실제 인증/서버 저장·동기화/OCR 서버·요금/자료 권한.
- 검증 스크립트 `scripts/verify-{library-intake,registration-progress,region-editor}.mjs`; 임시 Chrome 컨텍스트 사용.
- 로컬 자료: Downloads `1111.pdf`, `2222.pdf`, `exam_region_regression.json`, `korean_exam_patch_plan.md`, `korean_exam_regression.json`, `국어영역_문제지.pdf`, `사회탐구영역_문제지/03 한국지리_문제.pdf`; Documents `2024 2-2 중간 미적분 04회 상산고.pdf`. 한글 NFD 유의; 내용 kb 저장 금지.
