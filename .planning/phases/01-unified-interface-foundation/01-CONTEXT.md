# Phase 1: Unified Interface Foundation - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the shared UnifiedMessage type contract and migrate the existing MSG parser and all UI components to it. After this phase, the existing .msg viewer works end-to-end through UnifiedMessage. No EML code is written in this phase — it establishes the foundation both parsers will share.

</domain>

<decisions>
## Implementation Decisions

### Type Contract Design
- `Message.file` (CompoundFile): Claude decides the cleanest approach for the unified interface — likely drop or internalize, since UI components shouldn't need raw file access
- `bodyRTF`: Keep as optional field (`bodyRTF?: Buffer`) — present for MSG, absent for EML
- Attachment content type: Claude decides the most practical unified type (Uint8Array is browser-native and most portable)
- UnifiedMessage must not leak OLE2/MSG-specific types into UI component signatures

### Embedded Message Handling
- Use pre-parsed nested messages: `embeddedMessage?: UnifiedMessage` on attachments
- Both formats pre-parse nested messages during initial parse (not lazy)
- No depth limit on nested message parsing — real-world emails rarely exceed 3-4 levels
- MSG parser must change from storing `DirectoryEntry` to pre-parsing via `parseDir()` recursively

### Migration Strategy
- Update the `@molotochok/msg-viewer` package source directly — msg-parser.ts produces UnifiedMessage natively
- Claude decides whether adapter layer or direct refactor is lower risk
- All UI components (message, attachment, recipient, embedded-msg, error) updated to consume UnifiedMessage
- This is a breaking change to the existing Message types — acceptable since the npm package and app are co-located

### Claude's Discretion
- Exact field naming and structure of UnifiedMessage interface
- Whether to use Uint8Array, ArrayBuffer, or DataView for attachment content
- Whether to keep or drop the `file` field entirely
- How to handle the `bodyRTF` → HTML conversion (if converting during parse)
- Adapter vs. direct refactor decision for migration approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Type Definitions
- `lib/scripts/msg/types/message.d.ts` — Current Message, MessageContent, Attachment, Recipient interfaces that need to become UnifiedMessage
- `lib/scripts/msg/msg-parser.ts` — Current parse() and parseDir() functions that produce Message

### UI Components (all must be updated)
- `lib/components/message/index.ts` — Main message renderer, consumes Message
- `lib/components/attachment/index.ts` — Attachment list/download, consumes Attachment
- `lib/components/recipient/index.ts` — Recipient display, consumes Recipient
- `lib/components/embedded-msg/index.ts` — Embedded message click handler, uses DirectoryEntry
- `lib/components/error/index.ts` — Error display

### Application Entry Point
- `lib/scripts/index.ts` — Imports parse() from msg-parser, orchestrates rendering, handles embedded message recursion via parseDir()

### Research Findings
- `.planning/research/ARCHITECTURE.md` — Integration architecture for unified interface
- `.planning/research/SUMMARY.md` — Key findings including UnifiedMessage design recommendations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scripts/utils/html-template-util.ts` — Template substitution (`{{key}}` replacement), used by all components
- `lib/scripts/utils/file-size-util.ts` — `bytesWithUnits()` for attachment size display
- `lib/components/*/index.html` — HTML templates co-located with component logic

### Established Patterns
- Components return `DocumentFragment` via template-based rendering
- DOM elements prefixed with `$` (e.g., `$msg`, `$btn`)
- View model interfaces (e.g., `MessageViewModel`, `AttachmentViewModel`) map parsed data to template fields
- `import type` used for type-only imports
- 2-space indentation, no linter/formatter configured

### Integration Points
- `lib/scripts/index.ts:renderMessage()` — calls `parse()` and passes result to `messageFragment()`
- `lib/components/embedded-msg/index.ts` — click handler calls `parseDir()` with `DirectoryEntry` from attachment — this is the critical integration point that changes with pre-parsed nested messages
- `lib/scripts/msg/package.json` — npm package definition, version will need bumping if types change

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants the npm package updated alongside local code (not an adapter-only approach).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-unified-interface-foundation*
*Context gathered: 2026-04-03*
