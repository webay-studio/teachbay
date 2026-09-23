# Architecture / older evidence

Repo: Next App Router/TS/Tailwind/Zustand/Framer, LOVE `src/screens` area/action/handler/state. Observed Next15.5.25/React19; consult package/lock for current versions. Assets in IndexedDB, not Git.
- Modal: `app/@modal/(.)questions/new`, null default/root/catch-all; RegistrationScreen shares provider/handler. Dialog ESC/backdrop/X guarded for unsaved work/busy; browser-back immediate exit was a recorded limitation. Library refresh after save.
- Historical `onPageReady`/ProgressiveReviewAction was reportedly verified on4-page geography then absent in later source/commit. Cause unknown; do not claim deployed progressive crops (KB-001). Current source preview is separate.
- Prior cache cleanup covered `.next/cache`, `.next-registration/cache`, tab hard reload only; not IndexedDB/all HTTP/Tesseract storage.
- Older tests:63 core+6 UI, typecheck/build, WOFF2 preload, desktop/login/modal/navigation/storage checks. Not every final CSS adjustment got full regression; latest ledger in `worklog.md`.
- Confirmed pushes: `4f9b03a` workspace/font; `b6fe8b0` login; `5543512` registration; `0e362f4` handoff. Earlier roots: `a011f41`, `34ca932`, LOVE `02c7dfe`.
- Past Xcode-license/gh-auth/HTTPS-remote/backup-branch instructions were advice, not proof of execution. Remote observed SSH. Never infer a backup exists; no unsolicited force/reset/clean.

Verbose pre-compaction history: `git show 0e362f4:kb/worklog.md` or `git show 0e362f4:kb/04-implementation-log.md`. Historical claims are time-scoped; code/runtime wins.
