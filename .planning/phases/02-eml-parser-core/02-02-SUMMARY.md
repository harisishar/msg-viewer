---
phase: 02-eml-parser-core
plan: "02"
subsystem: security
tags: [dompurify, xss, sanitization, html, email-security]

# Dependency graph
requires:
  - phase: 02-01
    provides: parseEml() with unsanitized bodyHTML from postal-mime
provides:
  - DOMPurify HTML sanitization integrated into parseEml() — bodyHTML safe for DOM insertion
  - Remote image blocking (http/https src stripped)
  - Dangerous protocol blocking (javascript: and vbscript: in href/src)
  - Email-safe tag/attribute allowlist (tables, inline styles, links, images)
affects:
  - 02-03 (any further EML parser plans)
  - 03-eml-file-picker (bodyHTML will be rendered into the DOM — sanitization already active)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOMPurify SANITIZE_CONFIG defined once as module-level constant — single source of truth"
    - "uponSanitizeAttribute hook registered at module init via initSanitizer() IIFE pattern"
    - "sanitizeHTML() private helper wraps DOMPurify.sanitize() with config — not exported"

key-files:
  created: []
  modified:
    - lib/scripts/eml/eml-parser.ts

key-decisions:
  - "SANITIZE_CONFIG defined as module-level constant — config is not recreated on each parse call"
  - "initSanitizer() called once at module load — hook registered once, not per sanitize call"
  - "blob: and data: src protocols are not blocked — needed for CID object URL images in Phase 4"
  - "Plain text body field bypasses DOMPurify entirely — only HTML needs sanitization"
  - "Hook uses both .trim() and .toLowerCase() for robustness against whitespace/case variants"

patterns-established:
  - "Remote image blocking: strip http:// and https:// from src attributes via addHook"
  - "Dangerous protocol blocking: strip javascript: and vbscript: from href attributes via addHook"

requirements-completed: [EML-05, SEC-01, SEC-02]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 02 Plan 02: EML DOMPurify Sanitization Summary

**DOMPurify sanitization integrated into parseEml() with email-safe allowlist, remote image blocking, and dangerous protocol stripping**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-06T08:26:54Z
- **Completed:** 2026-04-06T08:28:03Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `import DOMPurify from 'dompurify'` and module-level `SANITIZE_CONFIG` with full email-safe allowlist (tables, formatting tags, links, images, inline styles)
- Registered `uponSanitizeAttribute` hook at module load to strip remote http/https images and dangerous javascript:/vbscript: protocols
- Applied `sanitizeHTML()` to `bodyHTML` in `mapContent()` — all HTML body content from parseEml() is now safe for DOM insertion
- Security audit confirmed no blocked tags (script, iframe, object, embed, form, input, etc.) or event handlers in allowlist

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DOMPurify sanitization config and integration** - `e0a43f6` (feat)
2. **Task 2: Verify no blocked elements leak through sanitization** - no new commit (verification only, no code changes needed)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/scripts/eml/eml-parser.ts` — Added DOMPurify import, SANITIZE_CONFIG constant, initSanitizer() hook registration, sanitizeHTML() helper, and bodyHTML sanitization in mapContent()

## Decisions Made

- `SANITIZE_CONFIG` defined as a module-level constant so config is not recreated on every parse call
- `initSanitizer()` called once at module load — the DOMPurify hook is registered once, not on every sanitize invocation
- `blob:` and `data:` src protocols are intentionally not blocked — Phase 4 will use object URLs for CID inline images
- Plain text `body` field bypasses DOMPurify entirely — only HTML requires sanitization
- Hook uses `.trim()` and `.toLowerCase()` for robustness against whitespace/case variants like `" HTTP://example.com"`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — DOMPurify was already installed as a project dependency (`dompurify@^3.3.3` and `@types/dompurify@^3.0.5` in package.json). No Rule 3 blocking issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `parseEml()` now returns a fully sanitized `bodyHTML` — safe for direct DOM insertion
- SEC-01 (HTML sanitized) and SEC-02 (remote images blocked) requirements fulfilled
- EML-05 (HTML body rendered with sanitization) requirement fulfilled
- Phase 3 file picker integration can safely render `bodyHTML` without additional sanitization
- Remaining concern from STATE.md: unescaped senderName XSS in lib/components/message/index.ts is still out of scope for this phase

---
*Phase: 02-eml-parser-core*
*Completed: 2026-04-06*
