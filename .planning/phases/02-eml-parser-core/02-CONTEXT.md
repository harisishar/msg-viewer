# Phase 2: EML Parser Core - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete `parseEml()` function that handles all real-world MIME structures correctly and safely. Takes a string/ArrayBuffer `.eml` file, returns `UnifiedMessage`. Covers: header extraction, RFC 2047 decoding, multipart traversal, body extraction (HTML + plain text), charset handling, transfer encoding decoding (base64 + quoted-printable), and XSS sanitization. Does NOT include: file picker integration (Phase 3), attachment download UI (Phase 4), inline CID images (Phase 4), or embedded message/rfc822 rendering (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Dependency Approach
- Use `postal-mime@2.7.4` as the MIME parsing engine — zero production dependencies, browser-native, TypeScript definitions shipped, actively maintained
- Use `DOMPurify` (latest stable) as the HTML sanitizer — industry standard, ~45KB min+gzip, well-tested against email XSS vectors
- Both installed as npm dependencies (not vendored, not custom-built)
- No other new dependencies for this phase

### HTML Sanitization (DOMPurify Config)
- Allow: `<table>`, `<tr>`, `<td>`, `<th>`, `<thead>`, `<tbody>`, `<tfoot>` (email newsletters use tables extensively)
- Allow: `style` attribute (inline styles are standard in email HTML — no external CSS sheets)
- Allow: `<img>` with `src` only for `blob:` and `data:` protocols (object URLs for CID images later, data URIs for inline)
- Block: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, event handler attributes (`onclick`, `onerror`, etc.)
- Block: `javascript:` and `vbscript:` in href/src attributes
- Block: remote images by default — `http://` and `https://` `src` attributes stripped (privacy protection, tracking pixel prevention)
- Use `DOMPurify.sanitize(html, config)` with a reusable config object defined once in the eml-parser module

### Error Handling
- Best-effort parsing with graceful degradation — don't throw on malformed input
- If headers are parseable but body is corrupt: show headers with "Body could not be parsed" message
- If file is completely unparseable: throw a descriptive error that the existing `errorFragment()` component displays
- Missing optional headers (CC, Date) should result in empty strings / null, not errors
- Malformed MIME boundaries: fall back to treating the entire body as plain text
- Log no warnings to console in production — errors surface through the UI only

### postal-mime Adapter Pattern
- Create `lib/scripts/eml/eml-parser.ts` mirroring `lib/scripts/msg/msg-parser.ts` structure
- Export `parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage>` (async because postal-mime is async)
- Adapter maps `postal-mime`'s `Email` output to `UnifiedMessage`:
  - `email.from` → `content.senderName` + `content.senderEmail`
  - `email.to/cc/bcc` → `recipients[]` with `type` field
  - `email.subject` → `content.subject` (already RFC 2047 decoded by postal-mime)
  - `email.date` → `content.date` (parse to Date object)
  - `email.html` → `content.bodyHTML` (after DOMPurify sanitization)
  - `email.text` → `content.body`
  - `email.headers` → `content.headers` (raw headers string)
  - `email.attachments` → `attachments[]` mapped to `UnifiedAttachment`
- `bodyRTF` is always undefined for EML (no RTF in MIME)

### Claude's Discretion
- Exact DOMPurify config object shape (specific ALLOWED_TAGS, ALLOWED_ATTR lists)
- Whether to create a shared sanitizer utility or keep it inline in eml-parser
- How to handle `email.date` parsing edge cases (timezone normalization)
- Whether `parseEml` should accept `string` only or also `ArrayBuffer` (postal-mime accepts both)
- Internal module structure within `lib/scripts/eml/` (flat or nested)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Type Contract (Phase 1 output — source of truth)
- `lib/scripts/types/unified-message.ts` — UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient interfaces. EML parser MUST produce this exact shape.

### Existing Parser Pattern (mirror this)
- `lib/scripts/msg/msg-parser.ts` — MSG parser implementation. EML parser should follow same structural pattern: single exported parse function, internal mapping helpers.

### Research Findings
- `.planning/research/STACK.md` — postal-mime recommendation with rationale
- `.planning/research/FEATURES.md` — MIME content types to support, feature priorities
- `.planning/research/PITFALLS.md` — Critical pitfalls: CRLF normalization, atob() whitespace, multipart recursion, XSS
- `.planning/research/ARCHITECTURE.md` — Integration architecture, adapter pattern details
- `.planning/research/SUMMARY.md` — Synthesized findings, phase ordering

### Requirements
- `.planning/REQUIREMENTS.md` — EML-01 through EML-10, SEC-01, SEC-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scripts/types/unified-message.ts` — Target output interface (MUST match exactly)
- `lib/scripts/utils/file-size-util.ts` — `bytesWithUnits()` for attachment size (reusable in EML attachments)
- `lib/scripts/utils/html-template-util.ts` — Template substitution (used by UI components that will render EML output)

### Established Patterns
- Parser modules export a single parse function: `parse(view: DataView): UnifiedMessage` for MSG
- EML equivalent: `parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage>`
- Internal helpers are private functions, not exported
- Type-only imports with `import type`
- kebab-case file names, camelCase function names

### Integration Points
- `lib/scripts/index.ts` — Will need to import `parseEml` and dispatch based on file extension (Phase 3, not this phase)
- Phase 3 will wire `parseEml` into the file picker — this phase just builds and exports the parser

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user trusts Claude's decisions based on research. Key constraint: postal-mime + DOMPurify as the dependency stack, not custom parsing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-eml-parser-core*
*Context gathered: 2026-04-06*
