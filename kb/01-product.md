# Product

- teachbay (repo directory: teachway). Individual teachers: import -> question library -> exam composition/print -> reopen saved exams. Not school administration.
- Image-first; preserve aspect/quality/source provenance. Subject/difficulty/tags optional. JPG/PNG/WebP, PDF, HWP/HWPX; real HWP coverage remains unverified.
- Browser IndexedDB owns assets/questions/exams; no image Base64 in localStorage. Saved exam snapshots survive source edits/deletion. Logout preserves data.
- Entry flag is not secure authentication. Server sync/auth/OCR hosting/billing are not implemented claims. Keep browser-storage disclosure.
- Routes: `/login`, `/questions`, `/exams/new`, `/exams`, `/exams/[id]`. Soft `/questions/new` opens intercept modal; hard/reload redirects `/questions` (also `/question/new`).
- 2026-09-23: empty library accepts click/drop before modal; cancellation stays put. Navigation has library/exams; registration is an action.
- 2026-09-23: initial import auto-bundles existing passage links; supersedes manual-only default. One library row/exam snapshot; ordered passage+question fragments and child records retained. Range edit/ungroup/undo; no retroactive rewrite of stored data.
- Discussion only: free extraction limits/quality caveat and paid enhancement/editable math. Earlier no-watermark/free-print goal; pricing unresolved. No billing, AI typing, class management, or organization permissions.
- Preloaded public exams discussed; distribution rights not established. Review rights before shipping content.
