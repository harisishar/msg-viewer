---
phase: 1
slug: unified-interface-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no test framework configured |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `bun run build.ts` (type-check + build) |
| **Full suite command** | `bun run build.ts` (no test suite exists) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run build.ts` (type-check verifies interface contracts)
- **After every plan wave:** Run `bun run build.ts` + manual .msg file load test
- **Before `/gsd:verify-work`:** Build must succeed, .msg file renders correctly
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ARCH-02 | type-check | `bun run build.ts` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | ARCH-01 | type-check | `bun run build.ts` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 2 | UI-02 | type-check + manual | `bun run build.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. TypeScript compiler serves as the primary validation tool for interface contract changes. No additional test framework needed for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| .msg file renders identically before and after migration | UI-02 | Visual comparison — no automated visual regression | 1. Open a .msg file before migration, screenshot. 2. Open same file after migration, compare visually. |
| Embedded messages still open on click | UI-02 | Interaction test — no test framework | 1. Open .msg with embedded attachment. 2. Click embedded message. 3. Verify nested message renders. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
