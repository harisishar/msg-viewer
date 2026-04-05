---
phase: 01-unified-interface-foundation
plan: 02
subsystem: ui
tags: [typescript, unified-message, components, migration]

# Dependency graph
requires:
  - phase: 01-unified-interface-foundation/01-01
    provides: UnifiedMessage/UnifiedAttachment/UnifiedRecipient type definitions and MSG parser returning UnifiedMessage
provides:
  - All UI components (message, attachment, recipient, embedded-msg) consume UnifiedMessage exclusively
  - Entry point index.ts wires UnifiedMessage through full render pipeline without parseDir or message.file
  - Recipient classification via type field filtering (not string-splitting)
  - Embedded message click handler passes pre-parsed UnifiedMessage directly
affects:
  - 02-eml-parser (will feed EML-parsed UnifiedMessage through same rendering pipeline)
  - Any future format additions feeding UnifiedMessage to UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI components accept UnifiedMessage, not format-specific types"
    - "Recipient classification via type field (not string-split of toRecipients/ccRecipients strings)"
    - "Embedded message rendering via pre-parsed embeddedMessage field (no lazy re-parse)"

key-files:
  created: []
  modified:
    - lib/components/message/index.ts
    - lib/components/attachment/index.ts
    - lib/components/recipient/index.ts
    - lib/components/embedded-msg/index.ts
    - lib/scripts/index.ts

key-decisions:
  - "Recipient filtering uses r.type field — toSet() and string-split logic removed entirely"
  - "Embedded message callback receives UnifiedMessage directly — no DirectoryEntry or parseDir in rendering layer"
  - "CSS build failure in bun build lib/index.html is pre-existing (wrong relative paths in styles.css) — unrelated to this plan"

patterns-established:
  - "Component signature pattern: fn(message: UnifiedMessage) — all rendering components use same interface"
  - "Embedded navigation pattern: onClick(attachment.embeddedMessage!) — pre-parsed, no lazy re-parse"

requirements-completed: [ARCH-02, UI-02]

# Metrics
duration: 15min
completed: 2026-04-01
---

# Phase 01 Plan 02: UI Component Migration to UnifiedMessage Summary

**All rendering components and entry point migrated from Message/DirectoryEntry to UnifiedMessage, completing a format-agnostic rendering pipeline where recipients filter by type field and embedded messages use pre-parsed data**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-01T00:20:00Z
- **Completed:** 2026-04-01T00:35:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed all imports of `Message`, `Recipient`, and `DirectoryEntry` from UI layer
- Replaced string-split recipient classification (`toSet()`) with `r.type === 'to'` / `r.type === 'cc'` filtering
- Replaced lazy `parseDir(message.file, dir)` embedded message re-parse with direct `() => embedded` pass-through
- Entry point `index.ts` no longer imports `parseDir` or accesses `message.file`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update UI components to consume UnifiedMessage** - `1549e47` (feat)
2. **Task 2: Update index.ts entry point to use UnifiedMessage** - `2ac5ce6` (feat)

**Plan metadata:** (docs commit — see final_commit step below)

## Files Created/Modified
- `lib/components/message/index.ts` - Signature changed to `messageFragment(message: UnifiedMessage, onEmbedded: (embedded: UnifiedMessage) => void)`; removed DirectoryEntry import
- `lib/components/attachment/index.ts` - Signature changed to `attachmentsFragment(message: UnifiedMessage)`; Uint8Array works with Blob and byteLength unchanged
- `lib/components/recipient/index.ts` - Replaced `toSet()`/string-split logic with `message.recipients.filter(r => r.type === 'to')`; removed `toSet` function entirely
- `lib/components/embedded-msg/index.ts` - `embeddedMsgObj` replaced with `embeddedMessage`; onClick receives `UnifiedMessage` not `DirectoryEntry`
- `lib/scripts/index.ts` - Removed `Message` and `parseDir` imports; `renderMessage` typed with `UnifiedMessage`; embedded callback uses `() => embedded`

## Decisions Made
- Recipient filtering: `toSet()` function deleted — the `type` field established in Plan 01 makes string-split classification obsolete
- Embedded message navigation: `() => embedded` replaces `() => parseDir(message.file, dir)` — pre-parsed data eliminates need for compound-file access at render time
- CSS build error noted as pre-existing (styles.css uses `./lib/styles/root.css` which is incorrect relative to the file location) — confirmed by git stash test; TypeScript compiles cleanly via `bun build lib/scripts/index.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`bun build lib/index.html --outdir /tmp/msg-viewer-build` fails with CSS resolution errors. Confirmed pre-existing via `git stash` test — the error existed before this plan's changes. TypeScript compilation verified clean via `bun build lib/scripts/index.ts` (bundled 25 modules, 28.89 KB, no errors).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The full rendering pipeline is now format-agnostic: any parser returning `UnifiedMessage` can feed directly into the UI
- Phase 02 (EML parser) can wire its output through the same components without any UI changes
- Concern from STATE.md remains: DOMPurify allowlist configuration for email HTML needs targeted testing during Phase 2

---
*Phase: 01-unified-interface-foundation*
*Completed: 2026-04-01*
