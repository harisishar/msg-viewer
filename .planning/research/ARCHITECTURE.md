# Architecture Research

**Domain:** Browser-based multi-format email file viewer (.msg + .eml)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

The existing architecture is a clean three-layer pipeline: parse → data → render. Adding EML support means inserting a parallel parse path that feeds the same data layer, keeping the render layer untouched.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Application Layer                          │
│  lib/scripts/index.ts                                             │
│  File input, drag-and-drop, format detection, error boundary      │
├────────────────────────┬─────────────────────────────────────────┤
│    MSG Parse Path      │         EML Parse Path (new)             │
│  ┌──────────────────┐  │  ┌───────────────────────────────────┐  │
│  │  CompoundFile    │  │  │  MIME Header Parser               │  │
│  │  (OLE2 binary)   │  │  │  (RFC 822 headers, text-based)    │  │
│  └────────┬─────────┘  │  └─────────────┬─────────────────────┘  │
│  ┌────────▼─────────┐  │  ┌─────────────▼─────────────────────┐  │
│  │  Stream/Property │  │  │  MIME Body Parser                  │  │
│  │  Layer           │  │  │  (multipart, base64, QP decode)    │  │
│  └────────┬─────────┘  │  └─────────────┬─────────────────────┘  │
│  ┌────────▼─────────┐  │  ┌─────────────▼─────────────────────┐  │
│  │  msg-parser.ts   │  │  │  eml-parser.ts (new)               │  │
│  │  parse()         │  │  │  parseEml()                        │  │
│  └────────┬─────────┘  │  └─────────────┬─────────────────────┘  │
├───────────┴────────────┴────────────────┴───────────────────────┤
│                     Unified Message Interface                      │
│  UnifiedMessage — same shape consumed by all UI components        │
├─────────────────────────────────────────────────────────────────┤
│                        UI Component Layer                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ message/  │ │attachment/│ │recipient/ │ │ embedded-msg/    │  │
│  │ index.ts  │ │ index.ts  │ │ index.ts  │ │ index.ts         │  │
│  └───────────┘ └───────────┘ └───────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `lib/scripts/index.ts` | File loading, format detection, error boundary, recursive render | All parsers, UI components |
| `lib/scripts/msg/msg-parser.ts` | Parse OLE2 binary .msg → UnifiedMessage | Application layer |
| `lib/scripts/eml/eml-parser.ts` (new) | Parse text-based .eml → UnifiedMessage | Application layer |
| `lib/scripts/types/unified-message.ts` (new) | Shared data contract between parsers and UI | Both parsers, all UI components |
| `lib/components/message/` | Render message metadata and body | UnifiedMessage |
| `lib/components/attachment/` | Render attachment list with download links | UnifiedMessage.attachments |
| `lib/components/recipient/` | Render To/CC recipient lists | UnifiedMessage.recipients |
| `lib/components/embedded-msg/` | Render embedded message entries, trigger drill-down | UnifiedMessage.attachments (embedded only) |

## Recommended Project Structure

```
lib/
├── scripts/
│   ├── index.ts                    # Application entry — updated for .eml + format detect
│   ├── types/
│   │   └── unified-message.ts      # NEW: shared interface replacing msg-specific Message
│   ├── msg/
│   │   ├── msg-parser.ts           # Existing — updated to return UnifiedMessage
│   │   ├── compound-file/          # Unchanged
│   │   ├── streams/                # Unchanged
│   │   ├── rtf/                    # Unchanged
│   │   └── types/
│   │       └── message.d.ts        # Existing — keep for internal msg parsing only
│   └── eml/
│       ├── eml-parser.ts           # NEW: top-level EML parse function
│       ├── mime-header-parser.ts   # NEW: parse RFC 822 / MIME headers
│       ├── mime-body-parser.ts     # NEW: parse multipart body, decode base64/QP
│       └── types/
│           └── eml-message.d.ts    # NEW: internal EML intermediate types
├── components/
│   ├── message/                    # Updated to use UnifiedMessage
│   ├── attachment/                 # Updated to use UnifiedMessage
│   ├── recipient/                  # Updated to use UnifiedMessage
│   └── embedded-msg/               # Updated to use UnifiedMessage
└── utils/
    ├── file-size-util.ts           # Unchanged
    └── html-template-util.ts       # Unchanged
```

### Structure Rationale

- **`scripts/types/unified-message.ts`:** Single source of truth for the data contract. Both parsers write to it; all UI components read from it. Kept separate from both format-specific type files so neither parser's internals bleed into the shared interface.
- **`scripts/eml/`:** Mirrors the `scripts/msg/` folder convention. Isolated subtree means the EML parser can grow its own helper modules without polluting shared namespaces.
- **Components unchanged structurally:** All components already consume an interface; updating the import to `UnifiedMessage` is a low-risk mechanical change with no structural reorganization needed.

## Architectural Patterns

### Pattern 1: Unified Message Interface (Adapter Pattern)

**What:** Define a single `UnifiedMessage` interface that both parsers must produce. Neither parser returns its own internal type to the application layer — both adapt to the same contract.

**When to use:** Whenever two data sources need to feed a single render pipeline. This is the core pattern here.

**Trade-offs:** Small additional indirection; the MSG adapter must map `CompoundFile`-specific fields (e.g., `embeddedMsgObj: DirectoryEntry`) to format-agnostic equivalents. EML embedded messages use a different mechanism (message/rfc822 MIME parts) but must produce the same surface shape.

**Example:**
```typescript
// lib/scripts/types/unified-message.ts
export interface UnifiedMessage {
  content: UnifiedMessageContent;
  attachments: UnifiedAttachment[];
  recipients: UnifiedRecipient[];
  // Format-specific metadata kept opaque — parsers may attach extra context
  // needed for recursive parsing (e.g. CompoundFile for .msg, raw string for .eml)
  _parseContext?: unknown;
}

export interface UnifiedMessageContent {
  date: Date | null;
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;        // plain text fallback
  bodyHTML: string;    // HTML body (preferred for rendering)
  headers: string;     // raw header block (for display)
}

export interface UnifiedAttachment {
  fileName: string;
  displayName: string;
  mimeType: string;
  content: Uint8Array;         // always binary; eml-parser decodes base64/QP here
  embeddedMessage?: UnifiedMessage; // replaces DirectoryEntry — pre-parsed for EML
}

export interface UnifiedRecipient {
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';  // EML has explicit type in headers; MSG infers from toRecipients/ccRecipients strings
}
```

### Pattern 2: Format Detection at the Application Boundary

**What:** Detect file format from file extension (and optionally magic bytes) in `index.ts` before dispatching to the correct parser. The dispatch point is a single `parseFile(file: File): Promise<UnifiedMessage>` function.

**When to use:** Any time multiple formats share a rendering pipeline.

**Trade-offs:** Keeps format knowledge in one place. The alternative — multiple file input handlers for each format — scatters detection logic and duplicates error handling.

**Example:**
```typescript
// lib/scripts/index.ts (updated)
async function parseFile(file: File): Promise<UnifiedMessage> {
  if (file.name.endsWith('.msg')) {
    const buffer = await file.arrayBuffer();
    return parseMsgToUnified(new DataView(buffer));
  }
  if (file.name.endsWith('.eml')) {
    const text = await file.text();
    return parseEml(text);
  }
  throw new Error(`Unsupported format: ${file.name}`);
}
```

### Pattern 3: EML Embedded Message Recursion via Pre-Parsing

**What:** Unlike MSG (which stores embedded messages as `DirectoryEntry` references parsed lazily on click), EML embedded messages (MIME type `message/rfc822`) should be fully pre-parsed at load time. The recursive call happens inside `eml-parser.ts`, not in the UI layer.

**When to use:** EML format only. The MSG approach uses lazy re-parsing because `CompoundFile` must stay in scope; EML is text and can be parsed completely upfront.

**Trade-offs:** Slightly higher memory for deeply nested messages at load time vs. lazy MSG approach. In practice, nesting beyond 2-3 levels is extremely rare in real .eml files. Pre-parsing simplifies the UI component — the embedded-msg component receives a full `UnifiedMessage` and calls `renderMessage()` directly rather than triggering a fresh parse.

**Example:**
```typescript
// eml-parser.ts handles nesting internally
function parseEmlPart(mimeNode: MimePart): UnifiedMessage | null {
  if (mimeNode.contentType === 'message/rfc822') {
    return parseEml(mimeNode.content as string); // recurse
  }
  return null;
}
```

## Data Flow

### File Load → Render (Updated Flow)

```
User drops/selects file (.msg or .eml)
    ↓
index.ts: detect format by extension
    ↓
.msg → parseMsgToUnified(DataView)         .eml → parseEml(string)
    ↓                                           ↓
msg-parser.ts (existing)              eml-parser.ts (new)
    ↓                                           ↓
UnifiedMessage ←──────────────────────────────────
    ↓
renderMessage(UnifiedMessage)
    ↓
messageFragment(unifiedMessage)
    ├─ recipientsFragments()        ← reads recipients[]
    ├─ attachmentsFragment()        ← reads attachments[] (content field, Uint8Array)
    └─ embeddedMsgsFragment()       ← reads attachments[] where embeddedMessage != null
    ↓
DOM update
```

### Embedded Message Drill-Down (Updated)

```
User clicks embedded message entry
    ↓
embedded-msg component fires onClick(attachment)
    ↓
index.ts: renderMessage(attachment.embeddedMessage)
    ↓  (no re-parse needed — UnifiedMessage already in attachment)
messageFragment(embeddedMessage)
    ↓
Parent message hidden, embedded message rendered
```

**Key change from current behavior:** MSG currently passes a `DirectoryEntry` reference to `parseDir()` on click. With the unified interface, both formats pass a pre-resolved `UnifiedMessage`. MSG embedded messages should be pre-parsed at load time as well (or kept lazily parsed with the context stored in `_parseContext`). The lazy approach for MSG can be preserved by storing the `{file: CompoundFile, dir: DirectoryEntry}` in `_parseContext` and resolving in `index.ts`.

### EML MIME Body Parsing (Internal to eml-parser)

```
Raw .eml string
    ↓
mime-header-parser.ts: split header block / body block
    ↓
Extract Content-Type, Content-Transfer-Encoding, charset
    ↓
If multipart:
    Locate boundary string → split into MIME parts
    For each part:
        Recursively parse headers
        If message/rfc822 → parseEml(partContent) → UnifiedAttachment.embeddedMessage
        If application/* or image/* → decode base64/QP → UnifiedAttachment
        If text/html → bodyHTML
        If text/plain → body
    ↓
Assemble UnifiedMessage
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `index.ts` ↔ `msg-parser.ts` | Direct import, synchronous | Existing. Update return type to `UnifiedMessage`. |
| `index.ts` ↔ `eml-parser.ts` | Direct import, synchronous (text input) | New. EML parsing is CPU-only, no I/O inside parser. |
| `msg-parser.ts` → `UnifiedMessage` | Adapter mapping | `message.file` (CompoundFile) maps to `_parseContext`; `bodyRTF` has no EML equivalent and is internal. |
| `eml-parser.ts` → `UnifiedMessage` | Direct construction | EML parser builds `UnifiedMessage` natively; no adapter needed. |
| Components ↔ `UnifiedMessage` | TypeScript import | All components update their import from `../scripts/msg/types/message` to `../scripts/types/unified-message`. |
| `embedded-msg` component ↔ recursive render | Callback `(attachment: UnifiedAttachment) => void` | `index.ts` passes callback; component invokes on click. No format-specific logic in component. |

### Handling `Attachment.content` Type Difference

The existing `Attachment.content` is typed as `Buffer` (Node.js type from the msg package). The unified `UnifiedAttachment.content` should be `Uint8Array`, which is browser-native and a structural match. The attachment component already calls `new Blob([attachment.content], ...)` — `Uint8Array` is valid here.

### Handling `Recipient` Type Difference

The existing recipient split (to/cc) is derived from `message.content.toRecipients` and `message.content.ccRecipients` strings. EML has explicit `To:` and `Cc:` headers. Adding a `type: 'to' | 'cc' | 'bcc'` field on `UnifiedRecipient` simplifies the recipient component and removes the need for the string-split workaround currently in `recipient/index.ts`.

## Scaling Considerations

This is a static client-side tool. Scaling is purely about file complexity, not user volume.

| Concern | Approach |
|---------|----------|
| Large attachments (10MB+) | `Uint8Array` in memory is fine; base64 decode from string adds ~33% overhead during parse only |
| Deeply nested messages | Recursive pre-parsing with depth guard (max 10 levels) prevents stack overflow |
| Very large headers (spam mail) | Header parsing is O(n) on header size; not a concern in practice |
| RTF body in MSG | Existing RTF decompressor already handles this; no change needed |
| Multipart/alternative (text + HTML) | Prefer HTML body; fall back to text. Standard MIME priority. |

## Anti-Patterns

### Anti-Pattern 1: Format-Specific Branches in UI Components

**What people do:** Add `if (message.format === 'eml') { ... }` checks inside components.

**Why it's wrong:** Defeats the purpose of the unified interface. Every new format adds more branches. Components become impossible to reason about.

**Do this instead:** Ensure parsers produce a fully normalized `UnifiedMessage`. If EML and MSG produce different shapes in one field, normalize in the parser — not in the component.

### Anti-Pattern 2: Passing Raw EML String into the UI Layer

**What people do:** Pass the raw EML text alongside a parsed message so the UI can re-parse embedded messages.

**Why it's wrong:** Puts format-specific parsing logic into the application/UI layer. Breaks separation of concerns. The UI layer should never know about MIME boundaries or RFC 822 header syntax.

**Do this instead:** Parse embedded messages (message/rfc822 parts) fully inside `eml-parser.ts`. Store the resulting `UnifiedMessage` in `UnifiedAttachment.embeddedMessage`. The UI receives a complete data tree.

### Anti-Pattern 3: Keeping `DirectoryEntry` in the Unified Interface

**What people do:** Expose `embeddedMsgObj: DirectoryEntry` from the existing `Attachment` type on `UnifiedAttachment`, making EML fill it with `null`.

**Why it's wrong:** Leaks an OLE2-specific concept (binary directory entry) into the shared interface. EML cannot meaningfully implement it. Components must null-guard a format-specific field.

**Do this instead:** Replace `embeddedMsgObj: DirectoryEntry` with `embeddedMessage?: UnifiedMessage` on `UnifiedAttachment`. For MSG, pre-parse the embedded dir entry on load (or defer via `_parseContext` and resolve in the click handler in `index.ts`).

### Anti-Pattern 4: Using a Third-Party EML Library as the Parser Boundary

**What people do:** Expose `postal-mime`'s `Email` type directly from `eml-parser.ts` to the rest of the application.

**Why it's wrong:** Couples the entire codebase to the library's output shape. If the library is replaced or updated, the breakage propagates everywhere.

**Do this instead:** `eml-parser.ts` is the only file that imports from the EML parsing library. It maps the library output to `UnifiedMessage` internally. The rest of the codebase never sees the library type.

## Library Recommendation for EML Parsing

**Recommended: `postal-mime`** (confidence: MEDIUM — browser compatibility verified via official docs, output structure verified from GitHub README)

Rationale:
- Zero external dependencies — does not inflate bundle size
- Explicitly supports browsers, Web Workers, and Cloudflare Workers (matching current deployment target)
- Output matches UnifiedMessage closely: `subject`, `from`, `to`, `cc`, `html`, `text`, `attachments` with `filename`, `mimeType`, `content: ArrayBuffer`
- Handles `message/rfc822` nested parts natively with `forceRfc822Attachments` option
- RFC 5322 compliant (superset of RFC 822)

Alternative: Hand-roll a MIME parser using browser-native `TextDecoder` + string splitting. Viable because EML is text-based and MIME structure is well-specified. Eliminates any dependency. Recommended only if `postal-mime` bundle size is a concern or if the project has a strict zero-dependency constraint for the EML module. Complexity is moderate — quoted-printable decoding and boundary parsing are ~150 lines each.

## Build Order Implications

The dependency chain dictates the following implementation sequence:

1. **Define `UnifiedMessage` interface** — all other work depends on this contract being stable. No code can be written until both parsers and all components agree on the shape.

2. **Update MSG parser to produce `UnifiedMessage`** — mechanical mapping. Validates that the interface is correct by running the existing functionality through it.

3. **Update UI components to consume `UnifiedMessage`** — after step 2, all existing functionality should work end-to-end with the new type. This is a regression checkpoint.

4. **Build EML parser internals** — `mime-header-parser.ts` → `mime-body-parser.ts` → `eml-parser.ts`. Header parsing is a prerequisite for body parsing.

5. **Wire EML parser into `index.ts`** — add format detection, update drag-and-drop filter to accept `.eml`, update error messages.

6. **Handle embedded messages for EML** — depends on MIME body parser being complete and the embedded-msg component working with `UnifiedMessage.embeddedMessage`.

## Sources

- Existing codebase: `lib/scripts/msg/types/message.d.ts`, `lib/components/`, `lib/scripts/index.ts` (direct code inspection)
- postal-mime output structure: [https://github.com/postalsys/postal-mime](https://github.com/postalsys/postal-mime) (HIGH confidence — official repository README)
- postal-mime browser compatibility: [https://postal-mime.postalsys.com/docs/](https://postal-mime.postalsys.com/docs/) (HIGH confidence — official docs)
- Adapter pattern in TypeScript: [https://refactoring.guru/design-patterns/adapter/typescript/example](https://refactoring.guru/design-patterns/adapter/typescript/example) (MEDIUM confidence — authoritative pattern reference)
- eml-parse-js (considered, not recommended): [https://www.npmjs.com/package/eml-parse-js](https://www.npmjs.com/package/eml-parse-js) (LOW confidence — limited documentation on browser compatibility edge cases)
- MIME multipart streaming parser: [https://github.com/ApelegHQ/ts-multipart-parser](https://github.com/ApelegHQ/ts-multipart-parser) (MEDIUM confidence — for reference if hand-rolling)

---
*Architecture research for: browser-based EML/MIME integration with existing .msg viewer*
*Researched: 2026-04-01*
