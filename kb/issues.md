# Issues (2026-09-23)

Statuses: open / in-progress / blocked / resolved / deferred. Unknown != broken. Resolve only with evidence. Entry: ID; symptom/evidence; files; next; verification.
Paths below relative to repo; engine=`lib/pdf-region-engine/`, docs=`lib/documents/`.

## KB-001 open: progressive question crops
Evidence: analyzePdf finalizes ownership after all pages; handler awaits readDocument. Old onPageReady/ProgressiveReviewAction absent. onPageRendered source/page-progress works (3-page Chrome), provisional question crops do not.
Files: engine/analyze-pdf.ts, docs/pdf-registration.ts, src/screens/registration/.
Next: implement/verify safe per-page provisional crops without changing final ownership. Verification: source preview only; crop requirement unresolved.

## KB-002 open: final login mobile QA
Evidence: reduced-motion/responsive code exists; last header/footer/logo layout not rechecked on mobile; no confirmed failure.
Files: app/studio.css, src/screens/session/.
Next/verify: narrow overflow/contrast/entry/reduced-motion browser check; pending.

## KB-003 deferred: shared build output
Evidence: historical webpack `__webpack_require__.n is not a function`; shared .next cause is a hypothesis. Later .next/types generation race passed on retry.
Files: next.config.ts, next-env.d.ts.
Mitigation: isolate .next-registration, restore next-env route reference. Next: inspect processes/output paths if recurrence; preserve other servers. Root cause unverified.

## KB-004 open: geography q20 lower box
Evidence: earlier report of extra bottom notice; not reproduced on current code.
Files: engine/, docs/registration-integration.md (repo docs directory).
Next/verify: compare blocks/bbox against source; pending.

## KB-005 open: stale project README
Evidence: contradictory demo/sample instructions vs current entry; calls PDF engine experimental although importPdfQuestions -> analyzePdf is live.
Files: README.md, src/screens/session/_area/SessionHero.area.tsx, src/screens/registration/_lib/registration.lib.ts, docs/pdf-registration.ts.
Next: update human-facing README, preserve historic results. Mismatch confirmed; fix pending.

## KB-006 resolved: review layout/save overflow
Evidence: old3-column/batch list pushed save below viewport. Replaced by near-fullscreen2-column/header save/full preview; supersedes footer-save fix.
Files: app/studio.css, components/documents/document-review.tsx, src/screens/registration/_action/AnalysisWorkspace.action.tsx.
Verified: single/batch3-page Chrome preview/cancel/save/list/mobile width, viewport save bounds. Next: user feedback; crops tracked separately in001.

## KB-007 open: fractional HWP progress
Evidence: importer emits index+progress*0.85, UI uses current as page count; possible fractional/early completion (hypothesis), PDF integers unaffected.
Files: docs/import.ts, src/screens/registration/_action/AnalysisWorkspace.action.tsx.
Next/verify: real OCR HWP; separate completed-page count from within-page progress; add stages if needed. Not run.

## KB-008 resolved: manual region editing
Files: components/documents/{document-review,region-canvas}.tsx, docs/region-edit.ts, app/studio.css.
Verified: Chrome draw/move/8-handle resize/undo/Escape/delete restore/zoom/page/mobile/save coordinates; geometry3/core66/UI6/type/build at implementation.
2026-09-23 board: Chrome pan isolation, zoomed normalized edits/save, mobile preview focus verified; `review-board.tsx` + fixed-width canvas. Next: real touch gestures unverified.

## KB-009 open: scan label recognition
Evidence: synthetic3-question scan produced0 regions,1 misread as27; manual regions used. OCR unchanged.
Files: engine/, docs/print-cleanup.ts.
Partial fix verified: split parenthesized score tokens mask correctly (unit/Chrome). Ambiguous labels/body-merged tokens skipped; manual erase available.
Next: isolate OCR regression; real HWP/varied scores unverified. Bare scores not auto-erased.

## KB-010 resolved: bundle membership unclear
Evidence: bundle membership was unclear. Range/count notice, member tabs and library badge retain group context. 2026-09-23 user supersedes full-bundle review preview with active-piece-only; bundled save unchanged.
Files: components/documents/document-review.tsx, src/screens/questions/_component/QuestionCard.tsx, app/studio.css.
Verified: Chrome active-only preview/member-source labels/colors, bundle range/exclusion notice; ungroup/undo/one-card+exam save keeps all fragments; types. Next: real-document feedback.

## KB-011 open: long-document test limit
Evidence:20-page Korean paper hit180s smoke timeout during p6 number retry,5 pages done; not a confirmed UI error. Auto-grouping runs after analysis.
Files: scripts/verify-region-editor.mjs, engine/analyze-pdf.ts.
Verified: first3-page sample auto-group/ungroup/undo/save/reload. Next: measure full20-page completion separately; do not tune OCR for this UI task.

## KB-012 resolved: duplicate review selectors
Evidence: user screenshot repeats bundles/members with always-on checks, link icons, green borders.
Files: components/documents/{review-piece-list,document-review}.tsx, app/studio.css.
Fix: unit-only list, opt-in checkbox mode, neutral inactive states, member tabs/range disclosure.
Verified: Chrome initial/manual bundles shown once; unit selection/ungroup/undo/editor/mobile/save/reload; type/UI6/build. Next: user feedback on dense real documents.

## KB-013 open: editable reconstruction experiment limits
Files: components/documents/editable-preview.tsx, docs/{editable-preview,extract-editable-preview}.ts.
Scope: native PDF tokens or one on-demand crop OCR pass -> editable positioned text/simple symbols; residual raster retained. KaTeX renders typed LaTeX, not image-to-LaTeX recognition. Complex formulas/uncertain tokens stay raster; user can mark/replace a formula.
Limits: no paragraph reflow, semantic figure extraction, durable editable storage or edited-image export; explicit preview-only notice. Small boxes fit content; long edits can shrink. OCR/diagram overlap quality unverified broadly; source/save unchanged. Verified:85 core/6 UI/type/build; Chrome native+synthetic scan edit/KaTeX/restore/original save. Next: evaluate real math OCR and review workflow before production persistence.
