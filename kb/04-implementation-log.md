# 구현·검증·Git 기록

## 저장소와 환경

- 로컬: `/Users/byoungyoonlee/orca/projects/teachway`
- 원격: `git@github.com:webay-studio/teachbay.git`
- 주 브랜치: `main`
- Next.js App Router, TypeScript, Tailwind CSS, Zustand, Framer Motion.
- 세션 중 확인한 설치 버전: Next.js 15.5.25, React 19.
- 화면은 `src/screens`의 area/action/handler/state 구조를 따른다.
- 데이터는 브라우저 IndexedDB에 있으며 Git push로 사용자 문제 데이터가 올라가는 구조가 아니다.

## 확인된 커밋

2026-09-23 로컬 `git log` 및 상태 조회 기준:

| 커밋 | 내용 |
| --- | --- |
| `a011f41` | Initial commit |
| `34ca932` | init |
| `02c7dfe` | Refactor teachbay UI with Tailwind and LOVE screen architecture |
| `4f9b03a` | Refine paper-style workspace and question registration UI |
| `b6fe8b0` | Restyle login with interactive paper backdrop and minimal layout |

`4f9b03a`, `b6fe8b0`는 도구 출력으로 `main -> main` push 성공을 확인했다. 마지막 UI push 뒤 working tree는 깨끗했고 main과 origin/main이 동기화된 상태였다. 이 kb 작성은 이후의 새 로컬 변경이다.

## 라우트 모달 및 레이아웃

- parallel slot `app/@modal`, `(.)questions/new`, default/root/catch-all null 경로.
- `RegistrationScreen`의 modal 옵션으로 기존 provider/handler 재사용.
- native dialog 및 Framer Motion. ESC/배경 클릭/닫기 동작, 저장 중·처리 중 가드.
- 미저장 작업 확인은 닫기 버튼/ESC 경로에서 제공. 브라우저 뒤로가기는 즉시 종료하는 한계가 기록됐다.
- 문제 저장 후 목록 화면 복귀 시 재조회.
- body 전체 대신 main-wrap/landing-body 스크롤로 정리.

## PDF 처리 중 페이지 미리보기의 상태 변동

사용자는 ‘한 파일 전체 완료’가 아닌 ‘동일 PDF의 한 페이지 완료 즉시 원본·영역·문항 크롭 표시’를 원했다.

세션 중에는 다음을 구현하고 검증했다는 도구 기록이 있다.

- `onPageReady(page, regions)` 콜백.
- 기존 OCR 관측으로 페이지별 `buildStructure` / `combineRegions` 수행.
- `ProgressiveReviewAction`에서 왼쪽 원본+박스, 오른쪽 문항 크롭.
- 중간 결과 읽기 전용, 최종 문서 연결 분석 후 수정·저장 허용.
- 한국지리 4쪽 PDF에서 1/4 시점 5문항 표시, 2/4·3/4 진행 상태, 최종 20문항 및 pageerror 없음 확인.

**그러나 이후 엔진 설명 요청에서 소스를 다시 읽었을 때 `analyze-pdf.ts`에 onPageReady 호출이 없었고, 최종 커밋 변경 목록에도 엔진 파일·ProgressiveReviewAction이 포함되지 않았다.** 그 사이의 변경 주체나 이유는 확인되지 않았다. 현재 배포 상태에 페이지별 미리보기가 확실히 존재한다고 말하지 말고 최신 경로를 재확인한다. 과거 검증 로그는 해당 시점의 구현에 대한 결과다.

## 실행한 검증 기록

- 엔진·저장 관련 테스트 63개 통과 기록.
- UI 계약 테스트 6개 통과. 로그인 배경 변경 뒤에도 재실행 통과.
- TypeScript 검사 통과. 로그인 배경 변경 시점까지 재실행.
- Pretendard 적용 후 격리 프로덕션 빌드 통과.
- 생성된 `.next-registration/server/app/questions.html`에서 WOFF2 preload link 확인.
- 실제 Chrome에서 내 문제 빈 상태 및 로그인 도면 배경의 시각적 결과 확인.
- 기존 모달 검증: 열기/닫기/ESC/뒤로·앞으로/직접 접속/이미지 저장/복귀 목록 갱신/모바일 가로 넘침 확인 기록.
- 기존 스크롤 검증: 데스크톱·모바일에서 헤더 위치 유지와 본문 스크롤 확인 기록.
- 이번 세션의 모든 마지막 CSS 조정마다 전체 프로덕션 빌드나 모바일 회귀를 다시 실행한 것은 아니다. `git diff --check`는 마지막 수정 및 커밋 전 확인.

검증 스크립트는 당시 UI에 의존한다. 실행하기 전에 현재 클래스·라벨·서버 주소와 일치하는지 확인한다.

## 개발 서버·캐시 주의

동일 `.next`를 여러 개발/프로덕션 프로세스가 공유하면서 webpack 런타임 오류가 발생한 이력이 있다. 사용자 오류는 `__webpack_require__.n is not a function`이었다. 특정 원인을 확정하지 않고 빌드 산출물 충돌 가능성을 구분해야 한다.

검증 시 기존 개발 서버를 방해하지 않도록 별도 디렉터리를 사용했다.

```bash
TEACHWAY_BUILD_DIR=.next-registration npm run build
TEACHWAY_BUILD_DIR=.next-registration npm run start -- --port 3037
```

격리 빌드가 `next-env.d.ts`의 routes 참조를 `.next-registration`으로 바꿀 수 있다. 실제 커밋 전 기본 `.next/types/routes.d.ts`로 복원했다.

사용자 캐시 삭제 요청 때 실행한 것은 `.next/cache`, `.next-registration/cache` 삭제와 teachbay 탭 강력 새로고침이다. 저장 문제·시험지 IndexedDB는 삭제하지 않았다. 브라우저 모든 HTTP 캐시나 Tesseract 언어 데이터 저장소 전체 삭제를 수행했다고 주장하지 않는다.

## Git 문제 안내 이력

사용자는 다른 터미널에서 Xcode 라이선스, SSH publickey, failed to push some refs를 문의했다.

- Xcode 라이선스: `sudo xcodebuild -license` 후 사용자가 직접 약관 동의.
- GitHub CLI: `brew install gh`, `gh auth login`, `gh auth setup-git`.
- SSH 실패 시 HTTPS remote로 전환하는 명령을 안내했지만 이 저장소의 실제 remote는 마지막 조회에서 SSH였다.
- `git log --oneline --graph --decorate -20`, `git reflog -20`, `git status` 안내.
- 사용자가 ‘여기 말고 명령어로’라고 한 백업 요청은 직접 실행하지 않고 `git checkout -b backup/current-work` 등 명령만 제공했다. 백업 브랜치가 생성됐다고 가정하지 않는다.
- push 실패는 로컬 커밋 삭제를 의미하지 않는다. 강제 push/reset/clean을 임의로 실행하지 않았다.
