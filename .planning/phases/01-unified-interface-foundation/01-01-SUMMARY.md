---
phase: 01-unified-interface-foundation
plan: "01"
subsystem: api
tags: [typescript, unified-interface, msg-parser, type-contract]

# Dependency graph
requires: []
provides:
  - "UnifiedMessage type contract (lib/scripts/types/unified-message.ts)"
  - "MSG parser returning UnifiedMessage with no OLE2 types in output"
  - "Recursive pre-parsing of embedded MSG attachments"
  - "Recipients typed as to/cc/bcc"
affects:
  - 01-02-eml-parser
  - 01-03-component-migration
  - all future UI rendering pipeline

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UnifiedMessage as shared interface for all parsers and UI components"
    - "Internal Raw* types isolate OLE2 specifics from public API"
    - "map* functions bridge raw parsed data to unified shape"
    - "parseRecipientString handles null-byte-terminated Windows strings"

key-files:
  created:
    - lib/scripts/types/unified-message.ts
    - tests/msg-parser.test.ts
  modified:
    - lib/scripts/msg/msg-parser.ts
    - lib/scripts/msg/types/message.d.ts

key-decisions:
  - "bodyRTF typed as DataView (not Uint8Array) to match decompressRTF(view: DataView) signature directly"
  - "CompoundFile/DirectoryEntry dropped from UnifiedMessage — OLE2 internal types must not leak into public API"
  - "Attachment.content is Uint8Array (browser-native) — DataView to Uint8Array conversion happens in mapAttachments"
  - "embeddedMsgObj DirectoryEntry replaced by pre-parsed embeddedMessage UnifiedMessage (eager, not lazy)"
  - "RawContent/RawAttachment/RawRecipient defined inline in msg-parser.ts — not exported, not in message.d.ts"
  - "message.d.ts kept with deprecation notice for reference during Phase 1 migration"

patterns-established:
  - "Parser pattern: parse() calls parseDir() which uses getValue/getValues for raw types then maps to unified"
  - "Recipient classification: parseRecipientString() handles null-byte-terminated Windows strings from toRecipients/ccRecipients"

requirements-completed: [ARCH-01, ARCH-02]

# Metrics
duration: 15min
completed: 2026-04-01
---

# Phase 01 Plan 01: UnifiedMessage Type Contract and MSG Parser Migration Summary

**UnifiedMessage interface defined and MSG parser migrated to return it natively, with typed recipients, pre-parsed embedded messages, and Uint8Array attachment content**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-01T00:00:00Z
- **Completed:** 2026-04-01T00:15:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `lib/scripts/types/unified-message.ts` exporting UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient
- Migrated `msg-parser.ts` to import from unified-message.ts and return UnifiedMessage — CompoundFile/DirectoryEntry no longer appear in public output
- Embedded MSG attachments now pre-parsed recursively via `parseDir()` into `embeddedMessage: UnifiedMessage`
- Recipients classified as to/cc/bcc by porting null-byte-aware logic from `recipient/index.ts` into `mapRecipients()`
- Binary attachment content converted from DataView to Uint8Array in `mapAttachments()`
- Added TDD tests verifying UnifiedMessage shape contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UnifiedMessage type contract** - `5025279` (feat)
2. **Task 2 RED: Add failing tests for shape contract** - `e6b9c09` (test)
3. **Task 2 GREEN: Migrate MSG parser to return UnifiedMessage** - `db7adb1` (feat)

**Plan metadata:** _(docs commit follows)_

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `lib/scripts/types/unified-message.ts` - Shared type contract for all parsers and UI components
- `lib/scripts/msg/msg-parser.ts` - Updated to return UnifiedMessage with internal Raw* types and map* functions
- `lib/scripts/msg/types/message.d.ts` - Added deprecation comment (file retained for reference)
- `tests/msg-parser.test.ts` - Type-level and shape-contract tests for UnifiedMessage

## Decisions Made
- `bodyRTF` is `DataView` (not `Uint8Array`) so `decompressRTF(view: DataView)` can consume it without conversion
- `CompoundFile` and `DirectoryEntry` are OLE2 internals — dropped entirely from the public UnifiedMessage shape
- `RawContent`/`RawAttachment`/`RawRecipient` defined inline in msg-parser.ts only — they are private implementation detail, not in message.d.ts
- Embedded messages are pre-parsed (eager) so callers never need to handle `DirectoryEntry` or know about OLE2
- message.d.ts is kept with a deprecation notice for reference during Phase 1 migration; it will be cleaned up in a later plan

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- UnifiedMessage contract is in place and ready for EML parser to implement (plan 01-02)
- MSG parser returns UnifiedMessage natively — component migration (plan 01-03) can begin
- `recipient/index.ts` still imports old `Message` type — scheduled for migration in plan 01-03
- message.d.ts deprecation note is in place; removal planned for post-Phase 1 cleanup

---
*Phase: 01-unified-interface-foundation*
*Completed: 2026-04-01*
