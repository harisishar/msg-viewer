# Phase 1: Unified Interface Foundation - Research

**Researched:** 2026-04-01
**Domain:** TypeScript interface design + mechanical codebase refactor (browser-based email viewer)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Type Contract Design**
- `Message.file` (CompoundFile): Claude decides the cleanest approach for the unified interface — likely drop or internalize, since UI components shouldn't need raw file access
- `bodyRTF`: Keep as optional field (`bodyRTF?: Buffer`) — present for MSG, absent for EML
- Attachment content type: Claude decides the most practical unified type (Uint8Array is browser-native and most portable)
- UnifiedMessage must not leak OLE2/MSG-specific types into UI component signatures

**Embedded Message Handling**
- Use pre-parsed nested messages: `embeddedMessage?: UnifiedMessage` on attachments
- Both formats pre-parse nested messages during initial parse (not lazy)
- No depth limit on nested message parsing — real-world emails rarely exceed 3-4 levels
- MSG parser must change from storing `DirectoryEntry` to pre-parsing via `parseDir()` recursively

**Migration Strategy**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | EML parser is a separate module alongside msg-parser following the same structural pattern | UnifiedMessage interface placed at `lib/scripts/types/unified-message.ts` — the shared contract both parsers will implement; MSG parser updated in this phase proves the contract shape is correct before the EML parser is built |
| ARCH-02 | Both parsers produce a unified message interface consumed by shared UI components | All UI components updated in this phase to consume `UnifiedMessage`; the MSG parser migration is the regression checkpoint proving the interface works end-to-end |
| UI-02 | User sees identical rendering regardless of whether the source file was .msg or .eml | Achieved structurally by this phase: all UI components are format-agnostic after migration; identical rendering is guaranteed because both format paths feed the same components with the same type |
</phase_requirements>

---

## Summary

Phase 1 is a pure TypeScript refactor with no new behaviour. The existing `.msg` viewer currently passes `Message` (a type defined inside `lib/scripts/msg/types/message.d.ts`) from the MSG parser to every UI component. After this phase, all components accept `UnifiedMessage` (defined at `lib/scripts/types/unified-message.ts`), and the MSG parser produces that type natively. The existing `.msg` functionality must be identical before and after — this is the regression checkpoint that validates the new interface shape is correct before the EML parser is built.

The scope is bounded: one new interface file, updates to `msg-parser.ts` and its type definitions, and import changes across five UI components. The most consequential design decision is the `UnifiedAttachment` shape — specifically whether embedded MSG attachments are pre-parsed eagerly or resolved lazily via a stored parse context. The CONTEXT.md locks eager pre-parsing (no lazy option), which simplifies the UI layer but requires `parseDir()` to call itself recursively during initial parse.

The second consequential change is the `recipients` model. The existing `recipient/index.ts` uses a fragile string-split on `message.content.toRecipients` and `message.content.ccRecipients` to classify recipients as to/cc. Adding a `type: 'to' | 'cc' | 'bcc'` field directly on `UnifiedRecipient` eliminates this workaround and makes the EML path (which has explicit To:/Cc: headers) trivially implementable.

**Primary recommendation:** Define `UnifiedMessage` first, update msg-parser.ts to return it, run a build verification, then update the five UI components. Direct refactor (not adapter wrapper) — lower indirection, lower risk for a co-located package.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (existing) | Interface definitions and type checking | Already in use; no changes |
| Bun | 1.1+ (existing) | Runtime and build tool | Already in use; `bun-plugin-html` handles the HTML template imports |

No new dependencies are required for Phase 1. This is a refactor, not a feature addition.

**Version verification:** No packages to install. The existing `package.json` at project root and `lib/scripts/msg/package.json` need version bump only (the `@molotochok/msg-viewer` package is co-located so the version bump is optional but recommended for clarity).

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── scripts/
│   ├── index.ts                          # Existing — unchanged in Phase 1
│   ├── types/
│   │   └── unified-message.ts            # NEW: single data contract for all parsers/components
│   ├── msg/
│   │   ├── msg-parser.ts                 # UPDATED: returns UnifiedMessage instead of Message
│   │   ├── types/
│   │   │   └── message.d.ts              # UPDATED or kept as internal-only type
│   │   ├── compound-file/                # Unchanged
│   │   ├── streams/                      # Unchanged
│   │   └── rtf/                          # Unchanged
│   └── utils/                            # Unchanged
├── components/
│   ├── message/index.ts                  # UPDATED: import UnifiedMessage
│   ├── attachment/index.ts               # UPDATED: import UnifiedAttachment
│   ├── recipient/index.ts                # UPDATED: import UnifiedMessage, use recipient.type
│   ├── embedded-msg/index.ts             # UPDATED: import UnifiedAttachment, use embeddedMessage
│   └── error/index.ts                    # Unchanged (no Message dependency)
└── utils/                                # Unchanged
```

### Pattern 1: UnifiedMessage Interface Definition

**What:** Single source-of-truth type file at `lib/scripts/types/unified-message.ts`. Both future parsers write to it; all UI components read from it.

**When to use:** Always. This file must exist before any other Phase 1 work.

**Recommended interface (based on direct codebase inspection + CONTEXT.md constraints):**

```typescript
// lib/scripts/types/unified-message.ts
// Source: direct analysis of lib/scripts/msg/types/message.d.ts + ARCHITECTURE.md

export interface UnifiedMessage {
  content: UnifiedMessageContent;
  attachments: UnifiedAttachment[];
  recipients: UnifiedRecipient[];
}

export interface UnifiedMessageContent {
  date: Date | null;
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;       // plain text
  bodyHTML: string;   // HTML body (preferred for rendering)
  bodyRTF?: Uint8Array; // MSG only — absent for EML
  headers: string;    // raw header block
}

export interface UnifiedAttachment {
  fileName: string;
  displayName: string;
  mimeType: string;
  content?: Uint8Array;               // binary content — absent when embeddedMessage is present
  embeddedMessage?: UnifiedMessage;   // replaces embeddedMsgObj: DirectoryEntry
}

export interface UnifiedRecipient {
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';         // replaces toRecipients/ccRecipients string split
}
```

**Key design decisions explained:**

- `file: CompoundFile` is DROPPED entirely from the public interface. It is an OLE2 internal type and must not appear in `UnifiedMessage`. The MSG parser's `parseDir()` is called recursively during parse to pre-resolve embedded messages — `CompoundFile` is consumed internally and never surfaces in the output.
- `Uint8Array` is chosen for `content` and `bodyRTF`. It is the browser-native binary type, already produced in the MSG parser's `PtypBinary` stream reading path (`new Uint8Array(Number(entry.streamSize))`). The existing `attachment.content` is typed as `Buffer` (Node.js) in `message.d.ts` but is already a `Uint8Array`/`DataView` structurally — the existing `attachmentsFragment()` calls `new Blob([attachment.content])` which accepts `Uint8Array` without change.
- `bodyRTF?: Uint8Array` is kept as optional per CONTEXT.md lock. The existing parser produces it as `DataView` — the MSG parser update must convert to `Uint8Array` or keep `DataView` consistently. `Uint8Array` is simpler.
- `embeddedMessage?: UnifiedMessage` replaces `embeddedMsgObj: DirectoryEntry`. `DirectoryEntry` is an OLE2 binary tree node with no meaning outside the MSG format.
- `type: 'to' | 'cc' | 'bcc'` on `UnifiedRecipient` eliminates the brittle string-splitting in `recipient/index.ts`.
- `content?: Uint8Array` is optional because an attachment slot can be either a binary file OR an embedded message — not both. When `embeddedMessage` is set, `content` will be absent.

### Pattern 2: Direct Refactor of MSG Parser (not an Adapter Wrapper)

**What:** Update `msg-parser.ts` to return `UnifiedMessage` directly. The `parseDir()` function signature changes from `Message` to `UnifiedMessage`. The internal `getContent()`, `getAttachments()`, `getRecipients()` helpers are updated accordingly.

**When to use:** The package source is co-located with the app (`lib/scripts/msg/`). A separate adapter wrapper would add an indirection layer with no benefit here.

**Rationale for direct refactor over adapter:**
- The adapter pattern is useful when you cannot or should not modify the upstream library. Here the MSG parser source is co-located and directly editable.
- Adapter would require maintaining two type representations (old `Message` + new `UnifiedMessage`) in perpetuity.
- Direct refactor results in zero runtime overhead and a clean single representation.
- Risk is low: the type changes are mechanical — field renames and one type substitution (`Buffer` → `Uint8Array`).

**Key changes in msg-parser.ts:**

```typescript
// BEFORE:
export function parse(view: DataView): Message { ... }
export function parseDir(file: CompoundFile, dir: DirectoryEntry): Message { ... }

// AFTER:
export function parse(view: DataView): UnifiedMessage { ... }
// parseDir becomes internal — called recursively for embedded messages
// The public parse() handles the CompoundFile internally
```

The `parseDir()` function may remain exported (for backwards compatibility or testing), but its return type changes to `UnifiedMessage`. The `file: CompoundFile` parameter is retained internally because the recursive call needs it, but this internal detail does not leak to callers beyond the parser module.

### Pattern 3: Embedded MSG Pre-Parsing (Recursive)

**What:** When the MSG parser encounters an attachment with `PtypObject` type (property ID `3701` with `embeddedMsgObj`), it calls `parseDir(file, entry)` immediately during the initial parse and stores the result as `embeddedMessage: UnifiedMessage`.

**When to use:** All embedded MSG attachments. CONTEXT.md locks this as eager (no lazy option).

**Current behavior (to be replaced):**
```typescript
// lib/scripts/msg/streams/property/properties.ts — current
{ id: "3701", name:"embeddedMsgObj", type: PtypObject, source: PropertySource.Stream },
// Returns a DirectoryEntry stored on the attachment object

// lib/scripts/index.ts — current lazy resolution
renderMessage($msg,
  () => parseDir(message.file, dir),  // re-parses on click
  ...
);
```

**New behavior:**
```typescript
// In getAttachments() or a post-processing step in msg-parser.ts:
// For each attachment where embeddedMsgObj (DirectoryEntry) was returned,
// call parseDir(file, directoryEntry) and store result as embeddedMessage

// lib/components/embedded-msg/index.ts — updated click handler:
fragment.children[0].addEventListener("click", () => onClick(attachment.embeddedMessage!));
// onClick in index.ts now calls renderMessage() with the pre-parsed UnifiedMessage
```

**Implementation note:** The `getValues<T>()` generic function in `msg-parser.ts` currently returns both `content` (PtypBinary → DataView) and `embeddedMsgObj` (PtypObject → DirectoryEntry) from the same property ID (`3701`). After the refactor, the attachment builder must handle this ambiguity: if `embeddedMsgObj` is present (a DirectoryEntry), call `parseDir()` and set `embeddedMessage`; if `content` is present (binary bytes), set `content` as `Uint8Array`.

### Pattern 4: Recipient Type Migration

**What:** The `UnifiedRecipient.type` field allows the recipient component to replace the current string-split approach.

**Current (fragile) approach in recipient/index.ts:**
```typescript
const toRecipients = toSet(message.content.toRecipients);   // splits "Name1; Name2\x00"
const ccRecipients = toSet(message.content.ccRecipients);
for (const recipient of message.recipients) {
  if (toRecipients.has(recipient.name)) { to.push(recipient); }
  else if (ccRecipients.has(recipient.name)) { cc.push(recipient); }
}
```

**New approach (after migration):**
```typescript
// recipientsFragments(message: UnifiedMessage):
const to = message.recipients.filter(r => r.type === 'to');
const cc = message.recipients.filter(r => r.type === 'cc');
```

**MSG parser must populate `type`:** The existing `toRecipients` and `ccRecipients` strings from `ROOT_PROPERTIES` are used to classify each `Recipient`. During the MSG parser update, add classification logic: for each recipient, check whether its name appears in the toRecipients string to assign `type: 'to'`, ccRecipients for `type: 'cc'`, else default `type: 'to'`.

Note: `toRecipients` and `ccRecipients` fields on `UnifiedMessageContent` can be dropped once the migration to `type` on `UnifiedRecipient` is complete. The `headers` field already contains raw headers if needed.

### Anti-Patterns to Avoid

- **Keeping `file: CompoundFile` in UnifiedMessage:** CompoundFile is an OLE2 parse artifact. It must stay internal to msg-parser.ts. Storing it on the output type means every consumer (UI components, tests) gets contaminated with a binary format concept.
- **Keeping `embeddedMsgObj: DirectoryEntry` on UnifiedAttachment:** Same issue. DirectoryEntry is meaningless to EML. Any null-check in UI code is a format leak.
- **Adapter wrapper around unchanged Message:** Adds indirection with no value when the source is co-located and editable.
- **Keeping `toRecipients`/`ccRecipients` as strings in UnifiedMessageContent:** The string-split in `recipient/index.ts` is fragile (null-byte termination, semicolon delimiter). The `type` field on `UnifiedRecipient` is the correct solution.
- **Using `Buffer` (Node.js) instead of `Uint8Array`:** Buffer is not a browser-native type. The existing code already uses `Uint8Array` internally in the stream reader — the `Buffer` in `message.d.ts` is a type annotation mismatch with the runtime reality.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type coercion from `DataView` to `Uint8Array` | Custom binary converter | `new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength)` | One-liner; already used in `getValueFromStream()` |
| Recipient to/cc classification | String parsing on `toRecipients`/`ccRecipients` | `type` field populated during parse | String-split approach is already fragile with null-byte termination |
| Embedded message resolution on click | Re-parsing `DirectoryEntry` at click time | Pre-parse in `parseDir()` and store `embeddedMessage: UnifiedMessage` | Simpler UI layer; pre-parsing is locked by CONTEXT.md |

**Key insight:** Every "don't hand-roll" item here is about not replicating existing complexity in the new interface. The parser is the right place to normalize format differences — UI components should see clean, typed data.

---

## Common Pitfalls

### Pitfall 1: Property ID 3701 Used Twice in ATTACH_PROPERTIES

**What goes wrong:** The MSG stream property ID `3701` is mapped twice in `properties.ts` — once for `content` (PtypBinary) and once for `embeddedMsgObj` (PtypObject). The `getValueFromStream()` switch handles both types, returning `DataView` for binary and `DirectoryEntry` for object. After migration, this dual-mapping must be preserved or restructured to correctly populate either `content: Uint8Array` or `embeddedMessage: UnifiedMessage`.

**Why it happens:** An attached file and an embedded message use the same MAPI property tag (0x3701) but different property types. The parser uses the type to distinguish them.

**How to avoid:** During the attachment mapping step in `msg-parser.ts`, check whether `embeddedMsgObj` (DirectoryEntry) is present. If yes: call `parseDir(file, entry)` → set `embeddedMessage`. If no: convert the `DataView` content to `Uint8Array` → set `content`. One or the other, never both.

**Warning signs:** Attachments that are embedded messages appearing as zero-byte binary downloads, or vice versa (embedded message UI not appearing for attachments that are embedded messages).

### Pitfall 2: `DataView` vs `Uint8Array` Type Mismatch

**What goes wrong:** The existing `getValueFromStream()` for PtypBinary returns `new DataView(chunks.buffer)`. The existing `message.d.ts` types `content` as `Buffer`. The unified interface uses `Uint8Array`. These are three different types for the same data.

**Why it happens:** The type annotation in `message.d.ts` was written for Node.js (Buffer) but the runtime value is actually a DataView. TypeScript has been allowing this silently because Buffer and DataView are structurally compatible in some contexts.

**How to avoid:** In the updated `msg-parser.ts`, change the PtypBinary return to `new Uint8Array(chunks.buffer)` directly. The existing `Blob` usage in `attachmentsFragment()` accepts `Uint8Array` without change. The `bytesWithUnits(attachment.content.byteLength)` call also works on `Uint8Array`.

**Warning signs:** TypeScript errors on `.byteLength` if you use `ArrayBuffer` instead of `Uint8Array` (ArrayBuffer has `byteLength` too so this won't error, but be consistent).

### Pitfall 3: `toRecipients`/`ccRecipients` Null-Byte Termination

**What goes wrong:** The `toSet()` function in `recipient/index.ts` has special-case handling for null-byte terminated strings (`recipStr.endsWith('\x00')`). If this classification logic is reimplemented in the MSG parser without carrying over the null-byte handling, recipient classification breaks.

**Why it happens:** MSG format stores some strings with a null terminator. The existing parser reads the raw string including the null byte.

**How to avoid:** When the MSG parser classifies recipients (to populate `type: 'to' | 'cc' | 'bcc'`), apply the same null-strip logic before splitting on `"; "`. Or trim null bytes from all PtypString values at read time. After migration the `toSet()` function in `recipient/index.ts` is deleted — don't leave it there as dead code.

**Warning signs:** All recipients showing as `type: 'to'` when some should be `cc`.

### Pitfall 4: `lib/scripts/index.ts` Uses `message.file` Directly

**What goes wrong:** `lib/scripts/index.ts` currently passes `message.file` (CompoundFile) to `parseDir()` for lazy embedded message resolution:

```typescript
() => parseDir(message.file, dir),
```

After migration, `UnifiedMessage` has no `file` field and embedded messages are pre-parsed. The `renderMessage()` function in `index.ts` must be updated to use `attachment.embeddedMessage` directly instead of calling `parseDir()` on click.

**Why it happens:** The current lazy approach is the only pattern — `parseDir()` is the public API. After migration, `embeddedMessage` is already resolved.

**How to avoid:** The `messageFragment()` signature changes from `(message: Message, renderDir: (dir: DirectoryEntry) => void)` to `(message: UnifiedMessage, onEmbedded: (message: UnifiedMessage) => void)`. In `index.ts`, the callback becomes `(embedded) => renderMessage($msg, () => embedded, ...)` — no re-parse, just render.

**Warning signs:** TypeScript errors on `message.file` in `index.ts` — TypeScript will catch this at compile time if types are updated correctly.

### Pitfall 5: Existing XSS in `message/index.ts` `senderName` Field

**What goes wrong:** `html-template-util.ts` uses direct string substitution (`{{key}}` → value) without HTML-escaping. The `senderName` field from the MSG parser is inserted into the HTML template raw. A crafted `.msg` with HTML in the sender name field could inject script tags or event handlers.

**Why it happens:** The template utility uses `element.innerHTML` assignment after string replacement — values are not escaped before insertion.

**How to avoid:** Phase 1 is a migration phase, not a security fix phase (security is out of scope per CONTEXT.md). However, this is worth noting as a separate issue. The `getName()` function in `message/index.ts` already partially mitigates by wrapping the email in `&lt;`/`&gt;` HTML entities, but `senderName` itself is not escaped.

**Warning signs:** The issue exists today in the current code. Phase 1 does not worsen it — just carry it forward as-is.

---

## Code Examples

Verified patterns from direct codebase inspection:

### UnifiedMessage Interface (complete)

```typescript
// lib/scripts/types/unified-message.ts
// NEW FILE — defines the shared data contract

export interface UnifiedMessage {
  content: UnifiedMessageContent;
  attachments: UnifiedAttachment[];
  recipients: UnifiedRecipient[];
}

export interface UnifiedMessageContent {
  date: Date | null;
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;
  bodyHTML: string;
  bodyRTF?: Uint8Array;  // MSG only; absent for EML
  headers: string;
}

export interface UnifiedAttachment {
  fileName: string;
  displayName: string;
  mimeType: string;
  content?: Uint8Array;
  embeddedMessage?: UnifiedMessage;
}

export interface UnifiedRecipient {
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';
}
```

### Updated msg-parser.ts Signature

```typescript
// lib/scripts/msg/msg-parser.ts (updated)
import type { UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient } from "../types/unified-message";

export function parse(view: DataView): UnifiedMessage {
  const file = CompoundFile.create(view);
  const dir = file.directory.entries[0];
  return parseDir(file, dir);
}

export function parseDir(file: CompoundFile, dir: DirectoryEntry): UnifiedMessage {
  const pStreamEntry = getPropertyStreamEntry(file, dir)!;
  const rawContent = getValue<RawContent>(file, ROOT_PROPERTIES, dir, pStreamEntry);
  const rawAttachments = getValues<RawAttachment>(file, dir, ATTACH_PROPERTIES, "attach");
  const rawRecipients = getValues<RawRecipient>(file, dir, RECIP_PROPERTIES, "recip");

  return {
    content: mapContent(rawContent),
    attachments: mapAttachments(file, rawAttachments),
    recipients: mapRecipients(rawContent, rawRecipients),
  };
}
```

### Updated embedded-msg Component

```typescript
// lib/components/embedded-msg/index.ts (updated)
import type { UnifiedMessage, UnifiedAttachment } from "../../scripts/types/unified-message";

export function embeddedMsgsFragment(
  message: UnifiedMessage,
  onClick: (embedded: UnifiedMessage) => void
): DocumentFragment {
  const elements = message.attachments
    .filter(attachment => attachment.embeddedMessage)
    .map(attachment => {
      const model: EmbeddedMsgViewModel = { name: attachment.displayName };
      const fragment = createFragmentFromTemplate(template, model);
      fragment.children[0].addEventListener("click", () => onClick(attachment.embeddedMessage!));
      return fragment;
    });

  const fragment = document.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}
```

### Updated recipient Component

```typescript
// lib/components/recipient/index.ts (updated)
import type { UnifiedMessage, UnifiedRecipient } from "../../scripts/types/unified-message";

export function recipientsFragments(message: UnifiedMessage): DocumentFragment[] {
  const to = message.recipients.filter(r => r.type === 'to');
  const cc = message.recipients.filter(r => r.type === 'cc');
  return [recipientHTML(to), recipientHTML(cc)];
}
```

### Updated index.ts renderMessage

```typescript
// lib/scripts/index.ts (updated embedded-msg callback)
fragment = messageFragment(message, (embedded: UnifiedMessage) => {
  renderMessage($msg,
    () => embedded,  // no re-parse — already a UnifiedMessage
    (fragment) => {
      for (let i = 0; i < $msg.children.length; i++) {
        ($msg.children[i] as HTMLElement).classList.add("hidden");
      }
      $msg.appendChild(fragment);
    }
  );
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Message` with `file: CompoundFile` exposed | `UnifiedMessage` with no format-specific fields | Phase 1 | UI components become format-agnostic; EML support possible |
| `Attachment.embeddedMsgObj: DirectoryEntry` (lazy) | `UnifiedAttachment.embeddedMessage?: UnifiedMessage` (eager) | Phase 1 | UI click handler simplified; no re-parse on embedded message open |
| `Recipient` classified via toRecipients/ccRecipients string split | `UnifiedRecipient.type: 'to' | 'cc' | 'bcc'` field | Phase 1 | Fragile string splitting eliminated; EML recipient types map directly |
| `content: Buffer` (Node.js type) | `content?: Uint8Array` (browser-native) | Phase 1 | Type matches runtime reality; EML parser can use same type |

**Deprecated after Phase 1:**
- `Message`, `MessageContent`, `Attachment` (old), `Recipient` (old) from `lib/scripts/msg/types/message.d.ts`: kept as internal types if needed for intermediate parsing steps, but must not be used in any public function signature visible to UI components.
- `message.file` access pattern in `index.ts`: replaced by pre-parsed `embeddedMessage`.
- `toSet()` function in `recipient/index.ts`: replaced by `type` field filtering.

---

## Open Questions

1. **Should `parseDir()` remain a public export from msg-parser.ts after migration?**
   - What we know: `index.ts` currently imports `parseDir` from `@molotochok/msg-viewer`. After migration, embedded messages are pre-parsed and `index.ts` no longer needs to call `parseDir` on click.
   - What's unclear: Whether any other consumer depends on `parseDir` being exported. Given the package is `@molotochok/msg-viewer` (co-located), this is controllable.
   - Recommendation: Keep `parseDir` exported but with updated signature `(file: CompoundFile, dir: DirectoryEntry): UnifiedMessage`. Remove the import from `index.ts` after confirming it's unused there.

2. **`bodyRTF` type: `Uint8Array` vs `DataView`?**
   - What we know: CONTEXT.md says keep as optional field. The parser produces a `DataView` for binary streams. RTF decompressor in `lib/scripts/msg/rtf/` takes some input type (not yet inspected).
   - What's unclear: Whether the RTF decompressor consumes `DataView` or `Uint8Array`.
   - Recommendation: Check `lib/scripts/msg/rtf/` before implementing. Use whatever the RTF consumer expects. If `DataView`, type `bodyRTF?: DataView` rather than converting unnecessarily.

3. **Should `message.d.ts` be deleted or kept as internal types?**
   - What we know: The old `Message`, `MessageContent`, `Attachment`, `Recipient` types in `message.d.ts` will become unused externally after migration.
   - What's unclear: Whether intermediate parsing steps in `msg-parser.ts` benefit from having named internal types.
   - Recommendation: Inline internal types directly in `msg-parser.ts` (e.g., `RawContent`, `RawAttachment`) or delete `message.d.ts` entirely if the generic `getValue<T>()` approach makes explicit intermediate types unnecessary. Keeping the file creates confusion about which type is canonical.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built into Bun runtime — no install needed) |
| Config file | None — see Wave 0 |
| Quick run command | `bun test lib/scripts/msg/msg-parser.test.ts` |
| Full suite command | `bun test` |

**Note:** No test files currently exist in the project (confirmed by filesystem scan). The test infrastructure is Wave 0 work. Bun has built-in test support via `bun test` with Jest-compatible API — no additional packages needed.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | UnifiedMessage interface exists at `lib/scripts/types/unified-message.ts` and is importable | unit (type-check) | `bun build lib/scripts/types/unified-message.ts` | ❌ Wave 0 |
| ARCH-02 | `parse()` from msg-parser returns a value matching UnifiedMessage shape | unit | `bun test lib/scripts/msg/msg-parser.test.ts` | ❌ Wave 0 |
| ARCH-02 | All UI component imports resolve to UnifiedMessage (no Message type) | unit (type-check) | `bunx tsc --noEmit` | ❌ Wave 0 (tsconfig needed) |
| UI-02 | Rendering a .msg file produces the same HTML output before and after migration | integration | `bun test lib/tests/integration/msg-render.test.ts` | ❌ Wave 0 |
| ARCH-02 | Embedded attachment has `embeddedMessage: UnifiedMessage` (not `DirectoryEntry`) | unit | `bun test lib/scripts/msg/msg-parser.test.ts` | ❌ Wave 0 |
| ARCH-02 | Recipients have `type: 'to' | 'cc' | 'bcc'` populated correctly | unit | `bun test lib/scripts/msg/msg-parser.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun build lib/index.html` (build verification — catches TypeScript errors via Bun bundler)
- **Per wave merge:** `bun test` (full suite when test files exist)
- **Phase gate:** Build succeeds AND all unit tests pass before `/gsd:verify-work`

**Pragmatic note for Phase 1:** Since this is a pure TypeScript refactor with no new behaviour, the primary validation signal is "does the build still succeed and does a real .msg file render correctly in the browser?" The TypeScript compiler (via `bunx tsc --noEmit` if a tsconfig exists) and a successful `bun build` are the key automated gates. End-to-end rendering validation against real .msg fixture files is the most valuable test.

### Wave 0 Gaps

- [ ] `lib/scripts/msg/msg-parser.test.ts` — unit tests for `parse()` returning UnifiedMessage shape; needs at least one real .msg fixture file in `lib/tests/fixtures/`
- [ ] `lib/tests/integration/msg-render.test.ts` — render output comparison before/after migration
- [ ] `lib/tests/fixtures/` — directory with 1-3 real .msg files for parser testing
- [ ] TypeScript config (`tsconfig.json`) — for `bunx tsc --noEmit` type checking; project currently uses `jsconfig.json` only

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `lib/scripts/msg/types/message.d.ts` — current Message, Attachment, Recipient, MessageContent interfaces
- Direct codebase inspection: `lib/scripts/msg/msg-parser.ts` — parse(), parseDir(), getValues(), getValueFromStream() implementation
- Direct codebase inspection: `lib/scripts/msg/streams/property/properties.ts` — ATTACH_PROPERTIES dual mapping of property ID 3701
- Direct codebase inspection: `lib/components/message/index.ts` — messageFragment() signature and Message consumption
- Direct codebase inspection: `lib/components/attachment/index.ts` — Blob creation with attachment.content
- Direct codebase inspection: `lib/components/recipient/index.ts` — toSet() string-split logic for to/cc classification
- Direct codebase inspection: `lib/components/embedded-msg/index.ts` — DirectoryEntry click handler pattern
- Direct codebase inspection: `lib/scripts/index.ts` — renderMessage(), parseDir() usage for embedded messages
- `.planning/research/ARCHITECTURE.md` — UnifiedMessage interface design, data flow diagrams, anti-patterns
- `.planning/research/SUMMARY.md` — architecture confidence HIGH, pitfalls, recommended build order
- `.planning/phases/01-unified-interface-foundation/01-CONTEXT.md` — locked decisions, migration strategy

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — ARCH-01, ARCH-02, UI-02 requirement text
- TypeScript `Uint8Array` vs `Buffer` browser compatibility: Uint8Array is the WHATWG Encoding Standard binary type; Buffer is Node.js-only — standard browser TypeScript practice

### Tertiary (LOW confidence)

- Bun test documentation (bun.sh) — assumed Jest-compatible API based on general knowledge; verify `bun test --help` before writing tests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing tools confirmed from codebase
- Architecture: HIGH — based on direct source code inspection of every affected file
- Pitfalls: HIGH — identified from actual code inspection (property ID 3701 dual-mapping, DataView/Buffer mismatch, index.ts parseDir usage, toSet null-byte handling are all confirmed in source)
- Interface design: HIGH — UnifiedMessage shape derived from CONTEXT.md locks + ARCHITECTURE.md research + existing type analysis

**Research date:** 2026-04-01
**Valid until:** Stable — no external dependencies change; valid until codebase changes
