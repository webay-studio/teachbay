# Worklog (newest first)

## 2026-09-23 whiteboard/experiment release
`7f52549`:25 files; English KB/AGENTS, unit navigation, shared board, active preview/save scope, opt-in text/KaTeX experiment + smoke/unit checks. Pushed origin/main; remote accepted0e362f4..7f52549. This docs follow-up records release/handoff.
Checks: fetch confirmed no divergence; staged diff check passed. No code changes after prior85 core/6 UI/type/build/native+scan Chrome verification; checks not repeated. KB-013 preview-only/math-recognition limits remain. Private fixtures/screenshots and generated build files excluded.

## 2026-09-23 OCR/text + KaTeX experiment
Request: try editable text/math + retained images. Added lazy `components/documents/editable-preview.tsx`, `docs/{editable-preview,extract-editable-preview}.ts`, KaTeX0.18.7. Opt-in split uses native located text or one cancellable crop OCR pass; deduplicated/mask-filtered boxes, uncertain content stays raster. Edit/delete/undo/restore; manual formula region + safe bounded KaTeX; fit long text/formulas inside boxes. Session cache keyed by geometry/masks; explicit no-save notice; engine/save model unchanged. Board excludes editor controls from pan/Space interception.
Checks:85 core (4 new extraction/symbol cases),6 UI,type,final isolated build/diff pass; next-env restored. Chrome native1111 + synthetic raster PDF: split/edit/delete/undo, fraction/root/error display, image restore/cache/manual region, source geometry unchanged, original-only save; no pageerror. Final native/scan screens inspected. Initial scan run interrupted during dev reload; final stable run passed. Real complex math/HWP not assessed; no automatic image-to-LaTeX or durable edited save (KB-013). No commit/push.

## 2026-09-23 selection/save scope clarity
`document-review.tsx`: always-visible active title + bundle save range; preview/sidebar reflect excluded units. `region-canvas.tsx`/CSS: active source caption, member tab and preview title share accent; passage selection no longer stays green. No new controls or engine/storage changes.
Checks: type/diff; Chrome editor/pan/zoom/mobile/save + bundle active-only preview, matching computed colors, range/exclusion updates, undo/one-row+exam save; no pageerror. Preview screenshot waits for decoded image. Build/core/OCR not repeated. No commit/push.

## 2026-09-23 active-only preview
Request: preview clicked piece only; preserve groups. `document-review.tsx`: separate active preview from bundle member navigation. Updated bundle smoke expectations.
Checks: type/diff pass; Chrome source/member clicks switch passage/question-only preview,4 member tabs retained; range/ungroup/undo/mobile/one-card+exam save preserve all fragments. No pageerror. Build/core/OCR not rerun (render-only). No commit/push.

## 2026-09-23 shared review board
Request: move bottom preview beside source on Figma-like workspace. New `review-board.tsx`: shared transform/grid, background/hand/Space/middle pan, wheel pan/Ctrl-Meta zoom, paper focus/reset. `document-review.tsx` moves preview out of sidebar; `region-canvas.tsx` uses fixed logical width, normalized editing unchanged. CSS:280px sidebar, wide board, mobile paper focus. Edit tools exit hand mode.
Checks: type/UI6/isolated build/diff pass; next-env restored. Chrome desktop1440/1366 +390mobile: background/hand/Space pan leaves regions unchanged, wheel zoom, zoomed normalized move, draw/resize/undo/Escape/page/save; manual bundle range/ungroup/one-card/exam save; cleanup preview/saved pixels match. Visual desktop/group/mobile inspected. No pageerror. Core/OCR and real touch/HWP not rerun; KB-008 touch follow-up remains. Existing edits preserved; no commit/push.

## 2026-09-23 review declutter
Request: screenshot showed duplicate group/member chips and excessive checks/link marks. `review-piece-list.tsx`: one chip per bundle, separate singles/passages, opt-in checkbox/bulk mode; neutral states. `document-review.tsx`: member tabs, quiet group summary, folded range editor, explicit deletion target; CSS and smoke selectors updated.
Checks: type/UI6/isolated build/diff pass; next-env restored. Chrome manual bundle + direct editor/mobile/save + real Korean3-page auto-bundle/ungroup/undo/one-card/reload pass; no pageerror. Visual desktop/mobile checked. OCR/storage logic unchanged; full core suite not repeated. KB-012 resolved. English KB edits preserved; no commit/push.

## 2026-09-23 English agent KB
Request: English/minimum tokens. Rewrote AGENTS+8 KB files; deduplicated current decisions/history, retained issue IDs/status/evidence and Git references. Older prose recoverable at0e362f4.
Checks: English-only text,11 issue IDs/statuses, index paths/history refs, diff passed. Combined docs ~68% smaller by bytes (not a token count). App tests not rerun; docs only. Existing issues unchanged. No commit/push.

## 2026-09-23 release
`5543512`: accumulated intake/analysis/editor/cleanup/bundle/header/preview/list UX + agents/KB/tests. `0e362f4`: handoff. Both pushed origin/main; clean/synced verified afterward.
Checks: final isolated production build/type/diff passed; next-env restored. Earlier81 core/6 UI and scoped Chrome runs below. KB-011 remains.

## 2026-09-23 expanded number list
Files: studio.css, document-review.tsx; removed list caps/overflow/internal autoscroll, preserved sidebar/body scroll.
Checks: Chrome editor/save;1366 desktop/390 mobile overflow visible and scrollHeight<=clientHeight; desktop visual/diff. No additional type/build/core run at this step.

## 2026-09-23 initial auto-bundles + membership
Files: passage-bundles.ts, PDF/HWP import adapters, document-review.tsx, QuestionCard.tsx, studio.css.
Existing materialIds -> initial bundles; no reapply after user edits; preserve overlaps/section conflicts. Full group preview from any member, range/count/link marks/library badge.
Checks:81 core/type/diff. Chrome real Korean first3 pages: initial1-3/4-9 groups, member preview, ungroup/navigation/undo, one-card save/reload. Manual bundle smoke also passed range validation/narrowing/unit selection/one exam snapshot/source retention/mobile. Fixed test live locator to stable ID. Full20-page timeout KB-011; real HWP not run.

## 2026-09-23 review UX consolidation
Files: components/documents/, registration actions, studio.css. Fullscreen-ish52:48/page-fit; save+ack+X portal header; remove file controls/advanced editing UI; full-width persistent preview. Earlier footer save/folded options superseded.
Checks: type/UI6/isolated build; Chrome editor/intake/batch progress/cancel/save/mobile/grouping/cleanup pixels;1366/1440 layout and mobile visual; no pageerror. Source/OCR model unchanged.

## 2026-09-23 cleanup/editor/group persistence
Files: region-edit/canvas, print-cleanup/compose, passage-bundles/prepare-registration/review/types/reuse.
Mouse draw/move/resize/undo/keyboard; shared preview/save masks and original retention; explicit bundle IDs -> ordered fragments, one row/snapshot, preserved child records.
Checks at stages:66->72->79 core,UI6,type/build; Chrome geometry persistence, cleanup pixel equality/body preservation, group validation/edit/undo/save/print/reload. Scan limitation009; touch/HWP/multi-page bundle browser coverage incomplete (fragment order unit-tested).

## 2026-09-23 intake/routes/analysis
File-first one-shot memory intake; intercept modal; hard/reload routes redirect. Real source/page progress replaces skeleton; paper motion replaces spinner; original scan overlay added then removed. Actual OCR-stage reasons instead of raw counts; passes/thresholds unchanged.
Checks:63 core/UI6/type/isolated builds; Chrome cancel picker/multiple images/drop/back-forward/save/reload/direct routes/mobile; single/batch3-page progress/cancel/review/save; synthetic2-page scan stages/cache reuse; no pageerror. No provisional question crops001; HWP progress007.

## Earlier evidence
2026-09-23: KB setup/project audit identified001/005;63 core/UI6/type passed. 2026-09-22: `4f9b03a` workspace/font/preload/build/UI6/visual push; `b6fe8b0` login/type/UI6/desktop push, final mobile002.
Historical full ledger: `git show 0e362f4:kb/worklog.md`. For future entries: date/change+files/checks/skips+issue IDs/next/confirmed Git only; consolidate minor followups.
