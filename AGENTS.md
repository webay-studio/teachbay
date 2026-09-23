# teachbay agent instructions

- Agent-only docs: concise English, minimum tokens. Keep non-English only for required literal identifiers. No narrative, repeated summaries, or human-facing explanations.
- Start: `git status --short --branch`; read `kb/README.md`, `kb/05-handoff.md`, `kb/issues.md`, latest `kb/worklog.md` entries. Read topic files only when relevant.
- Latest user instructions override recorded decisions. Code/runtime evidence overrides notes; verify inherited implementation claims before relying on them.
- Preserve user data, existing edits, source assets, and OCR accuracy. Do not change extraction rules, thresholds, or OCR passes for UI work. Distinguish disposable caches from persistent data.
- Record new bugs, regressions, unverified risks, and blockers in `kb/issues.md`: ID, status, evidence, files, next action, verification. Label hypotheses; never mark resolved without verification.
- When direction changes, update its topic file and handoff. Date the replacement; retain one concise supersession note instead of duplicate history.
- At meaningful completion, prepend a compact worklog entry: date, request/change/files, checks actually run/results, skipped checks/open IDs, next action, confirmed Git operations. Consolidate small related edits.
- Keep handoff current; link to topic details rather than duplicating them. Record only confirmed tests, browser checks, commits, and pushes.
- Never store credentials, student data, or private question text/images in kb. Git history holds verbose old notes; do not duplicate them in archives.
- Documentation updates are part of work. Commit/push only within user authorization. Explanation-only requests do not authorize implementation.
