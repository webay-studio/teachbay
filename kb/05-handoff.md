# Handoff 2026-09-23

- Implementation=`7f52549`, pushed origin/main (2026-09-23): review declutter/whiteboard/active preview/text-math experiment + English KB. This docs follow-up records the confirmed push; verify live git status for current HEAD.
- Latest preference: agent KB in terse English, minimum tokens, no human-facing narrative. Rules/index: `../AGENTS.md`, `README.md`.
- Current UX: file-first intake; soft-route modal/hard-route redirect; real analysis stages; direct region editor; header save/X; source/large active-piece preview side-by-side on pan/zoom board; expanded unit list (bundles once), opt-in checkboxes, member editing tabs; matched active labels/colors and explicit preview bundle-save/exclusion scope. Details/superseded choices: `03-ui-design.md`.
- Import auto-bundles existing passage links once. Range/ungroup/undo remain; one saved unit, all original fragments/child records retained. Image number/score masking != title editing. Source/OCR invariants: `02-pdf-engine.md`.
- Preserve localhost:3003 and user data. Build: `TEACHWAY_BUILD_DIR=.next-registration npm run build`; restore next-env route reference to `.next/types/routes.d.ts` (KB-003). Do not share build dirs across servers.
- Latest checks:85 core/6 UI/type/build; Chrome experimental native+scan editing/math/original-save. Prior board: pan/zoom/editor/save/masks/manual bundle; Chrome intake/editor/progress/masks/bundle save/reload. Exact scope in `worklog.md`; docs changes do not rerun app tests.
- Experimental preview: opt-in text split/edit/delete + KaTeX, retained raster; original-only save, session-only edits. Complex math OCR/persistence out of prototype scope (KB-013).
- Open: KB-001 progressive crops;002 login mobile;003 build collision;004 geography20;005 README;007 HWP fractional progress;009 scan label;01120-page timeout;013 editable reconstruction limits. Use `issues.md`, not inherited success claims.
- Browser runners: `scripts/verify-{library-intake,registration-progress,region-editor}.mjs`; disposable contexts/local demo flag. Bundle/cleanup runners imported by region editor.
- Local fixtures: Downloads `1111.pdf`/`2222.pdf` and exam regression JSONs; Korean/geography papers and Sangsango scan filenames recoverable from old handoff at `0e362f4`. Normalize NFD names. `/tmp` screenshots/samples are disposable; never copy private content into KB.
