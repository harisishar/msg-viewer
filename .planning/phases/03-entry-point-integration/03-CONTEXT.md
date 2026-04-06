# Phase 3: Entry Point Integration - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire both parsers (MSG + EML) into the application entry point with format detection, unified file picker, and drag-and-drop support. After this phase, users can load either .msg or .eml files through the same interface.

</domain>

<decisions>
## Implementation Decisions

### Format Detection
- Detect format by file extension (`.msg` vs `.eml`) — simple, reliable, consistent with how email clients work
- No content/magic-byte inspection needed — extensions are unambiguous for these formats
- Unsupported extensions show a clear error message via the existing `errorFragment()` component

### File Picker Changes
- Update `accept` attribute on file input in `lib/index.html` from `.msg` to `.msg,.eml`
- Single file picker — no separate inputs or mode switching

### Drag-and-Drop Changes
- Update the `.msg` extension guard in `lib/scripts/index.ts` line 25 to accept both `.msg` and `.eml`
- Unsupported file types show error rather than silently ignoring

### Parser Dispatch
- `parseEml` is async (returns `Promise<UnifiedMessage>`), `parse` (MSG) is sync — `updateMessage` must handle both
- Make `renderMessage`'s `getMessage` parameter accept async: `getMessage: () => UnifiedMessage | Promise<UnifiedMessage>`
- Or make `updateMessage` async and await `parseEml` before calling `renderMessage`

### Error Messages
- Update error text from ".msg file" to "email file" (generic, covers both formats)
- Unsupported format error: "Unsupported file format. Please select a .msg or .eml file."

### Claude's Discretion
- Exact async/await pattern for handling the sync MSG parser vs async EML parser
- Whether to extract format detection into a utility function or keep inline
- How to handle edge cases (no extension, double extensions)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Entry Point (file to modify)
- `lib/scripts/index.ts` — Current entry point with file handling, drag-and-drop, and rendering orchestration
- `lib/index.html` — HTML with file input element and accept attribute

### Parsers (both must be wired)
- `lib/scripts/msg/msg-parser.ts` — MSG parser: `parse(view: DataView): UnifiedMessage` (sync)
- `lib/scripts/eml/eml-parser.ts` — EML parser: `parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage>` (async)

### Type Contract
- `lib/scripts/types/unified-message.ts` — Both parsers produce this shape

### Error Component
- `lib/components/error/index.ts` — `errorFragment()` for displaying parse errors

</canonical_refs>

<code_context>
## Existing Code Insights

### Specific Changes Needed
- `lib/index.html`: Change `accept=".msg"` to `accept=".msg,.eml"`
- `lib/scripts/index.ts` line 25: Change `!files[0].name.endsWith(".msg")` to accept both extensions
- `lib/scripts/index.ts` line 36: Add format detection + dispatch to correct parser
- `lib/scripts/index.ts` line 59: Change error message from ".msg file" to "email file"

### Established Patterns
- `parse()` from `@molotochok/msg-viewer` takes `DataView`, returns `UnifiedMessage` synchronously
- `parseEml()` takes `string | ArrayBuffer`, returns `Promise<UnifiedMessage>` asynchronously
- `renderMessage()` currently expects sync `getMessage` callback

### Integration Points
- `updateMessage(files: FileList)` — the dispatch point where format detection happens
- File extension determines which parser to call

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward wiring phase. User trusts Claude's decisions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-entry-point-integration*
*Context gathered: 2026-04-06*
