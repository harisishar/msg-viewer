---
phase: 2
slug: eml-parser-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (bun:test) — established in Phase 1 |
| **Config file** | none — uses bun built-in test runner |
| **Quick run command** | `bun test tests/eml-parser.test.ts` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/eml-parser.test.ts`
- **After every plan wave:** Run `bun test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual .eml file test in browser
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | — | install | `bun test` (deps available) | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | EML-01, EML-02, EML-03 | unit | `bun test tests/eml-parser.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | EML-04, EML-05, EML-06, EML-07, EML-08, EML-09, EML-10 | unit | `bun test tests/eml-parser.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | SEC-01, SEC-02 | unit + manual | `bun test tests/eml-parser.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `postal-mime@2.7.4` installed via `bun add postal-mime`
- [ ] `dompurify@3.3.3` installed via `bun add dompurify`
- [ ] `@types/dompurify` installed via `bun add -D @types/dompurify`
- [ ] `tests/eml-parser.test.ts` — test stubs for EML parser covering all 12 requirement IDs
- [ ] Test fixture `.eml` files in `tests/fixtures/` for multipart, plain text, HTML, encoded headers

*Wave 0 tasks install dependencies and create test infrastructure before parser implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HTML email body renders correctly in browser | EML-05 | Visual rendering — DOMPurify requires browser DOM | 1. Serve app locally. 2. Load an HTML-heavy .eml. 3. Verify body renders without script execution. |
| Remote images blocked in HTML body | SEC-02 | Network behavior — requires browser context | 1. Load .eml with `<img src="https://...">`. 2. Verify image does not load (check Network tab). |
| International characters display correctly | EML-08 | Visual — character rendering depends on browser font | 1. Load .eml with non-ASCII subject/body. 2. Verify characters render correctly. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
