# UI (2026-09-23)

- Paper/gray grid/thin lines/existing accent; restrained titles/banners. Screen-only decoration; white source images. Pretendard variable100..900, local WOFF2 v1.3.9+OFL in `app/fonts/`, swap+preload.
- Workspace: transparent header; symbol then library/exam links; profile right; active underline. Single row mobile. Footer symbol+slogan/browser-storage note; no side padding.
- Empty library: paper illustration + whole-area accessible picker/drop target, drag highlight. Hide toolbar/top registration only for truly empty library, not zero search results. Cancel picker leaves page unchanged. Memory intake consumed once; back/forward must not reimport.
- Registration: native dialog+Framer/reduced-motion; desktop inset8px, mobile fullscreen; shared board +280px sidebar. Board pairs600px source/640px preview, fits source/pair initially; mobile focuses one paper at readable width. Header contains filename/ack/save/X; no add-file/remove-file controls.
- Sidebar: one chip per saved bundle, separate ungrouped questions/passages; no duplicate member chips/link icons/green borders. Checkboxes+bulk actions only in selection mode, one per unit. Neutral default/active-only accent; excluded items labeled. List stays expanded (no internal scroll); sidebar/body scroll. Large always-open preview on board, not sidebar. No advanced options, page notices, name/kind/link sliders, merge/split/reanalysis/trace UI.
- Board: background/hand/Space/middle drag; wheel pan,Ctrl/Meta-wheel anchored zoom25..250%; source/preview focus and fit controls. Shared transform/grid; no internal preview scroll. Source gestures retain normalized geometry. Edit tools exit hand mode.
- Experiment: opt-in text mode on active preview; split button, positioned text editing/deletion, manual math region + LaTeX/KaTeX, undo/original restore. Uncertain content stays raster; session cache invalidates on source rect/mask changes. Explicit preview-only/no-save note. See KB-013.
- Selection: preview always names active question/passage; source caption, preview title and member tab share blue accent. Preview scope names saved bundle range; excluded units say excluded in preview/sidebar. No extra controls.
- Mouse editor: draw/add, move,8-handle resize, undo/Escape/delete/arrows/zoom; erase+undo. Auto number/score cleanup remains; toggle removed. This changes image marks, not title strings.
- Passage groups: auto on fresh import; start/end range editor, ungroup/undo. Range chip opens group; member tabs/source clicks preview only the active piece (all its fragments); group membership/save remain intact. Quiet count line; range editor collapsed by default. Delete text names the active region. Library badge shows group/range; save count uses units.
- Analysis: actual source/current-total pages/page states; central paper motion and progress segments. No original scan overlay/spinner/skeleton. Explain actual operation + retry reason; no timer-rotated messages/OCR counts. Batch states/cancel/completed-file review retained. Per-page question crops still KB-001.
- Login: logo+copy+entry+3 plain steps, no header/footer. SVG paper/grid/circles; mouse spring ~12/9px,100s arc rotation; fade bottom, pointer-events none/aria-hidden, reduced-motion/coarse-pointer support. Final mobile check KB-002.
- Files: `app/studio.css`, `components/documents/`, `src/screens/{questions,registration,session}/`; `src/_state/RegistrationIntake.tsx`.

Superseded on2026-09-23:3-column review ->2; oversized source ->balanced; hidden/compact preview ->large always-open; footer save ->header; folded advanced options ->removed; constrained number-list scroll ->expanded; manual-only grouping ->auto import. Original scan overlay was added/intensified then removed. Hard-route full-page fallback ->redirect.

2026-09-23 supersession: duplicate passage+member chip grids/always-on checks/chain icons/green group notice -> unit navigation, opt-in selection, quiet member tabs.

2026-09-23 supersession: balanced source/sidebar with bottom preview -> shared pan/zoom board, source-left/preview-right, narrow unit sidebar.

2026-09-23 supersession: whole-bundle review preview -> active-piece-only; grouping/navigation/save unchanged.
