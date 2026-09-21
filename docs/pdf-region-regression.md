# PDF 영역 추출 수정 및 실제 회귀 검증 — 2026-09-21

이 문서는 `/lab/pdf-regions` 실험 경로의 변경 기록이다. 일반 `/questions/new` 등록 엔진을 이 실험 엔진으로 교체한 것은 아니다. 실험 화면은 원본·전처리 이미지, 영역 미리보기와 JSON을 제공하며 DB에 문항을 저장하지 않는다. 따라서 이 화면의 박스는 **문항 미리보기/JSON 범위**이지, 영구 저장 이미지가 검증됐다는 뜻이 아니다.

## 실제 실행 경로

1. `app/lab/pdf-regions/page.tsx / run()` → `lib/documents/extract-experiment.ts / extractExperiment()`.
2. PDF.js로 원본 렌더, 주석 목록/네이티브 텍스트/폰트/벡터 path 확보. 원본 Blob은 별도로 유지한다. 색상 전처리가 켜졌으면 분석 복사본에서 `ink-preprocess.ts / suppressColoredInk()` 실행.
3. `native-observations.ts / nativeObservation()`이 문자열·좌표·폰트·원본 잉크 지지를 검사한다. `preprocess=true`라는 이유로 네이티브 텍스트를 버리지 않는다. 잉크 지지/폰트 검사는 휴리스틱이며 정답 확률이 아니다.
4. 읽을 수 있는 네이티브 영역은 OCR을 건너뛴다. 스캔 기본 경로는 기존 전체 AUTO/SPARSE와 단 AUTO이며, 번호 부재/순서 충돌 단에는 SPARSE를 최대 한 번 추가한다. 최대 8개 시작 글줄 후보를 원본에서 2배 렌더링해 SINGLE_BLOCK 재인식한다. 반복 재시도는 없다. 단별 AUTO 중심 경로는 비교 옵션으로 남겼다.
5. 실제 OCR은 기존 **Tesseract.js의 kor+eng LSTM**이다. 외부 AI API·새 생성 모델은 없다. `lab-ocr-worker.ts / acquireLabOCR()`의 고정 worker 1개를 재사용하며 취소 시 폐기한다.
6. `findInkRegions()`의 연결 성분, `physicalRegions()`의 단 후보, `buildStructure()`의 텍스트 역할, `buildBlocks()`의 글줄/수식/도형/선택지 블록을 구성한다. PDF 벡터 테두리는 `pdfGeometry()`가 보완한다.
7. `hybrid-regions.ts / combineRegions()`가 블록을 문항 소속으로 묶고 `QuestionRegion.parts`에 물리 조각을 유지한다. `number-only`를 다음 읽기 영역까지 보류한다. 공통 지문을 이전 문항에 무조건 흡수하지 않는다. 불명확한 스캔의 페이지/단 연결은 확정하지 않는다.
8. 화면 `RegionPreview`와 JSON `parts[].bbox`는 같은 조각의 범위를 사용한다. 수동 경계 수정은 화면 `group.rect`와 해당 part를 함께 갱신한다.

## 확인한 원인과 변경

- 네이티브 텍스트를 전처리 옵션만으로 제외하던 경로를 제거했다. Type3 폰트의 ascent/descent가 NaN일 때 번호 좌표가 무효가 되는 것도 유효성 검사와 기본 메트릭으로 수정했다.
- 단별 bbox가 곧 최종 문항이던 구조를 논리 문항과 조각으로 분리했다. 1111의 14번(단 이동), 18번(번호-only → 다음 페이지)을 거대 사각형 없이 연결한다.
- 네이티브 `5`와 뒤의 `개의…`를 `5.`로 합성해 가짜 문항을 만들던 경로를 막았다. 원문 label과 표시 번호를 분리했다.
- 배점 아래 내용을 잘라내는 종료 결정을 최종 grouping에서 사용하지 않는다. 실제 블록의 합집합으로 범위를 계산하며 네이티브 벡터 상자와 이미지 성분을 보존한다. 이는 필기와 인쇄물을 구분했다는 뜻이 아니다.
- 혼합 OCR 줄 bbox를 그대로 확대 근거로 삼는 대신, 연결 성분의 지지 범위를 우선한다. PDF 네이티브 줄은 원본 근거를 유지한다.
- 형태 필터는 기본 `classify` 모드다. `suspected-handwriting / protected-print / unknown`, 이유·실험 파라미터·제안 마스크를 보존하며 **2차 단계는 픽셀을 삭제하지 않는다**. 인쇄와 겹친 내용을 추측 복원하지 않는다.
- 전체 OCR 패스에서 인식한 꼬리말이 단별 패스에서는 조각난 짧은 단어로 재등장하는 경우, 확인된 margin 행과 겹치는 조각에 같은 제외 근거를 적용한다. 고정 높이에서 페이지를 잘라내는 처리는 아니다.
- 원시 관측/블록/최종 조각을 분리하여 내보내고, 소속 미확정 블록 수를 실제로 계산한다. OCR 패스 중복을 독립적인 정렬 확증으로 세지 않는다.

## fixture와 재현

사용자 제공 `exam_region_regression.json`의 1-based page를 앱의 0-based pageIndex로 변환한다. column은 이 fixture에서 flow order 0/1과 비교한다. 다른 레이아웃 일반화의 증거로 해석하지 않는다.

```sh
TEACHWAY_BUILD_DIR=.next-regression npm run build
TEACHWAY_BUILD_DIR=.next-regression npm run start -- --port 3035
node scripts/verify-lab-regions.mjs final-shape /path/to/1111.pdf /path/to/2222.pdf /path/to/scan.pdf
node --import tsx scripts/check-region-fixture.ts /path/to/exam_region_regression.json /path/to/app-export.json /path/to/source.pdf 1111
```

검사기는 SHA-256 불일치 시 중단한다. 문항 개수, 각 문항의 페이지·단·조각 역할과 순서, 원본 번호 label, 네이티브 번호 앵커 44개, 두 디지털 PDF의 5번 이미지 6개씩의 포함, 좌표 왕복, 화면 group/part bbox 일치를 별도로 검사한다. 이미지 bbox 포함은 인쇄/필기 픽셀 정확도 검사와 다르다.

`scripts/render-region-stages.mjs`는 동일 페이지의 raw observations → grouped blocks → final parts를 JSON/PNG로 기록한다. JSON에는 분석 픽셀 크기, PNG 크기, 정규화 좌표, sourceToAnalysis 행렬이 있다. `scripts/replay-region-geometry.ts`는 이미 얻은 OCR을 고정한 grouping 비교이며 OCR 재실행 결과로 주장하지 않는다.

## 확인 범위와 남은 한계

- 디지털 파일의 구성/앵커/제공된 이미지 좌표 검사는 수행했지만, 전체 문항 bbox 정답이 없으므로 모든 본문·수식 픽셀이 완벽히 보존됐다는 뜻은 아니다.
- 스캔에는 번호 오인식, 필기 잔존, 넓은 필기 영역 포함이 남는다. 배점 아래 그림 보존과 불필요한 필기 제거는 별개 평가다. 모든 문항을 `needs-review`로 유지한다.
- 2.2 / 25% / 35%는 실험 파라미터다. 정답 픽셀 마스크가 없어 안전한 임계값·필기 제거 정확도를 측정하지 않았다. 비파괴 분류가 효과 없으면 그대로 보고한다.
- 원본/분석 Blob과 좌표를 보존한다. 페이지 작업 캔버스는 완료 시 해제한다. JS heap 샘플은 전체 브라우저/WASM/GPU peak memory가 아니다.
- 다단/페이지 중간 단 전환/전체 폭 지문 자동 flow 검출은 미완료다. 현재 단 검출은 기존 선 기반 + 번호 시작 x 분포 보완의 1·2단 기준선이다. 복잡한 공통 자료의 수동 관계 편집도 이번 수정에서 완성하지 않았다.
- 혼합 페이지의 네이티브 신뢰 판정은 아직 휴리스틱이다. 텍스트 레이어로 설명되지 않는 래스터 본문의 완전한 coverage 검사는 없다.
- 실제 삭제 모드의 재OCR/geometry 안전성, 인쇄/필기 정답 마스크, 사용자의 수정 시간, 전체 앱 peak memory, 새 출처 일반화는 미검증이다.
- worker 재사용/취소는 코드 경로가 있지만 이번 실파일 반복 업로드의 warm/cold 성능 비교는 별도 측정하지 않았다.

최종 실행 수치와 전후 이미지는 `output/region-regression/report.md`에 기록한다. 원본 PDF에서 나온 렌더/텍스트 결과는 `.gitignore`에 넣어 로컬에만 남긴다.
