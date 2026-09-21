# UI 구조

`../love/AGENTS.md`의 화면 분리 규칙을 웹에 적용합니다. 디자인은 webay의 블루와 현재 화면 구성을 유지합니다.

```text
app/**/page.tsx                 라우트와 Screen 연결
src/screens/<feature>/
  <Feature>Screen.tsx           화면 조립
  _area/*.area.tsx              정적 제목·설명·구역 배치
  _action/*.action.tsx          use client 인터랙션 컴포넌트
  _handler/*.handler.tsx        상태에 따른 분기·이벤트 흐름 조율
  _state/use*Store.ts           Zustand 상태와 useShallow 선택자
  _lib/*.lib.ts                 비동기 데이터 접근·엔진 호출 어댑터·계산
  _model/*.model.ts             화면 상태 타입
  _component/*.tsx             카드 등 개별 UI
src/components/modal/          공통 모달
```

화면별 Zustand Provider를 사용해 다른 화면이나 SSR 요청과 상태를 공유하지 않습니다. 브라우저 IndexedDB가 영속 데이터의 원본이며 Zustand에는 화면 상태만 보관합니다. React ref는 파일 입력, 취소 컨트롤러, 자동 저장 Promise 큐 등 렌더링 외의 수명 관리에 사용합니다.

`_area`에는 입력 이벤트, 상태 변경, 비동기 작업을 작성하지 않습니다. `_action`은 화면 조작을 처리하고 `_handler`에 흐름을 위임합니다. 저장소 접근은 `_lib`에 둡니다. 현재 저장소는 IndexedDB이므로 Server Actions나 서버 전용 인증을 추가하지 않습니다.

Tailwind v4의 `@theme`에 브랜드 색·서체를 정의하고 화면 배치는 JSX 유틸리티로 표현합니다. 반복되는 공통 UI는 `studio.css`의 `@apply`를 사용합니다. 특수 문서 검토 및 A4 인쇄 스타일은 `globals.css`에 유지합니다. CSS 레이어는 `components → studio → utilities` 순서이며 인쇄 규칙을 별도로 유지합니다.

`lib/documents`, `lib/pdf-region-engine`, `lib/layout.ts`, `lib/print.ts`, 문서 검토·자르기·시험지 렌더러는 기존 엔진 경계입니다. 화면 리팩터링을 위해 해당 구현을 수정하지 않습니다.

검증: `npm run typecheck`, `npm run test:ui`, `npm test`, `npm run build`. 실행 환경은 package.json에 지정된 Node.js 22.13 이상입니다.
