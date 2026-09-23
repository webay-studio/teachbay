# Engine

Invariant: preserve original regions/provenance; do not tune OCR for UI. No external generative API; Tesseract is ML. No universal accuracy claim.
Entry: `lib/pdf-region-engine/analyze-pdf.ts`; adapter: `lib/documents/pdf-registration.ts`. Verify constants in code before changing them.

Pipeline (2026-09-23): PDF.js/50MB check -> sequential render (rotation/crop; scale <=2.5, width2200/height3200 caps) -> retain original -> optional annotation exclusion/color suppression -> physical columns/4-connected components -> native text/font validation + image/vector geometry -> native/scan/mixed classification -> OCR as needed -> non-destructive shape classification (`suppressIsolatedInk(..., false)`) -> original-ink fallback on trusted-text conflict -> `buildStructure`/`combineRegions`/`assignDocumentOwnership` after all pages -> adapter.
- Color suppression targets some red/blue; can affect printed color. Not general black-handwriting removal. Scores are not definitive content ends.
- `onPageRendered` reuses rendered blobs; no extra OCR. UI stages report actual work/retry reasons, not simulated progress. HWP uses older messages; KB-007.
- `autoBundlePassages` runs only in fresh PDF/HWP import, using materialIds. Skip overlapping ownership/section conflicts. No reapply after edits/ungroup. Does not alter OCR, bbox, or ownership inference.

OCR registration policy=`legacy`; `adaptive` exists, not selected. Sufficient native text skips OCR. Otherwise: page AUTO + SPARSE_TEXT; column AUTO; <=2 missing/discontinuous-number regions SPARSE_TEXT; <=8 start crops at2x SINGLE_BLOCK; conditional header digits pass. Typical 2-column conditional max14/15, not constant. Retry candidates are not exclusively proven bad numbers.
`ocr-result-cache.ts`: bounded tab memory keyed by pixels/dimensions/PSM/whitelist. Hits != passes; worker reuse and language-model cache are separate.

Files in `lib/pdf-region-engine/`: `structure.ts` line roles/dedup; `question-number.ts` evidence validation (same-location passes not independent votes); `hybrid-regions.ts` flow/anchors/content; `document-ownership.ts` material/dependency ownership; `ocr-retries.ts` crop candidates.
- Distinguish candidate vs actual content bounds. Preserve formulas/figures/choices; not just rectangles extending to next number.
- Preserve fragment order/page/rect/transforms/source, stable IDs, section restarts, labels, material/dependency relations, review state. Multiple fragments/material pages allowed. Unknown relations stay candidates; never fabricate missing content.
- `lib/documents/print-cleanup.ts`: confident isolated number/parenthesized-score masks; preview/save share masks; originals unchanged. Ambiguous text skipped; manual erase/undo remains (KB-009).

Reported regression expectations, not new ground-truth validation:
- `1111.pdf`:22 questions/24 fragments; q14 crosses columns p2; q18 number-only p2 -> body p3. `1111.pdf`/`2222.pdf`: native1..22 once reported, not proof of bbox accuracy. q5 diagrams/choice figures must survive. `2222.pdf`: omit solution whitespace; no false question in last empty column.
- Sangsango scan: q18 figure below score; p3-4 handwriting/formula overlap; p6 restarts1..4 after1..18; raster/no native text/annotations, alternating90/270 rotations reported.
- Geography: intermittent missing left column discussed; q20 extra lower box KB-004.
Evaluate misses/false detections/merge/split/content loss/relations/order/print erasure/manual effort, not count or IoU alone. Broad layout/color/long-passage/missing-page accuracy and server costs unverified.

Editable experiment (2026-09-23): `docs/extract-editable-preview.ts` reuses native supported printTokens or runs one crop SPARSE_TEXT pass via shared cancellable OCR lease. Registration passes unchanged. `editable-preview.ts` filters clipped/masked/overlapping tokens, keeps uncertain text raster, only maps explicit linear symbols to LaTeX. No spatial formula inference. KaTeX0.18.7 renders with trust=false, bounded expansion/size; loaded only in experimental UI. KB-013.
