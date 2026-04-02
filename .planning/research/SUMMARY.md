# Project Research Summary

**Project:** msg-viewer — EML/MIME Support Milestone
**Domain:** Browser-based multi-format email file viewer (.msg + .eml)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

This is a well-scoped milestone addition to an existing, working product. The existing `.msg` viewer already has a clean three-layer pipeline (parse → unified data → render) and established UI components for headers, attachments, recipients, and embedded messages. Adding `.eml` support means inserting a parallel parse path that produces the same data shape and feeds the identical render layer — the render components need no functional changes, only a type update to consume a new `UnifiedMessage` interface.

The recommended approach is: install `postal-mime` (one zero-dependency npm package, actively maintained, browser-first, TypeScript-native), write a thin adapter module at `lib/scripts/eml/eml-parser.ts` that maps `postal-mime`'s `Email` output to the shared `UnifiedMessage` interface, then wire format detection into the existing entry point. The entire EML milestone is approximately 200-400 lines of production TypeScript. The risk is not in writing the code — it is in correctness against real-world MIME edge cases that most developers only discover after launch.

The key risks are all parseable: CRLF line-ending variance, non-recursive multipart traversal missing nested bodies, raw HTML body rendering without XSS sanitization, and missing RFC 2047 encoded-word decoding that makes subjects and sender names display garbage. Every one of these risks has a documented prevention strategy and is addressed before any feature is considered complete. Shipping HTML rendering without DOMPurify sanitization is the single highest-severity mistake to avoid — it turns any crafted `.eml` file into an XSS vector.

## Key Findings

### Recommended Stack

The existing stack (TypeScript 5, Bun 1.1+, browser runtime, Cloudflare Pages) is fixed. The only addition required is `postal-mime@2.7.4`: zero production dependencies, ships its own TypeScript definitions, browser-first design using `ArrayBuffer`/`Uint8Array`, actively maintained (last release 2026-03-17), and already used by Cloudflare Email Workers — the same deployment target as this project. Every alternative library is either abandoned, Node.js-specific, or in beta. Building a custom MIME parser is viable but requires 2-4 weeks to match `postal-mime`'s correctness on real-world edge cases.

**Core technologies:**
- `postal-mime@2.7.4`: EML parsing — only viable actively-maintained browser-native option; MIT-0 license; zero transitive dependencies
- Browser `TextDecoder` API: charset decoding — already available; handles full WHATWG encoding label set including Windows-1252 and ISO-8859-*
- Browser `File.arrayBuffer()`: file reading — already used for `.msg`; same API works for `.eml`
- TypeScript 5 (existing): adapter layer — maps `postal-mime` `Email` output to `UnifiedMessage`; ~50-80 lines

### Expected Features

The MVP for this milestone is full feature parity with the existing `.msg` viewer. All P1 features use already-existing UI components — the eml-parser is the only new code required to unlock them.

**Must have (table stakes — v1 EML milestone):**
- Header display (Subject, From, To, CC, Date) — identity of the message; maps to existing UI
- Plain text and HTML body rendering — core content; HTML requires XSS sanitization (non-negotiable)
- Attachment listing with download — primary use case; existing `attachmentsFragment()` component reusable as-is
- RFC 2047 encoded-word decoding in headers — treat as parsing correctness, not enhancement; missing it shows raw `=?UTF-8?B?...?=` in subject
- Quoted-printable and base64 decoding — required to get readable content from virtually all real-world emails
- Character set handling via `TextDecoder` — international email is broken without it; default to `windows-1252` not `us-ascii` when charset is absent
- Unified `.msg`/`.eml` file picker — single UI entry point; update `accept` attribute and drag-and-drop handler
- `multipart/mixed` + `multipart/alternative` parsing — RFC 2046 minimum; covers the vast majority of real-world emails

**Should have (v1.x — add once core is stable):**
- Inline image rendering via CID/`multipart/related` — emails with embedded logos look broken without it; HIGH complexity; defer until HTML body rendering is confirmed stable
- Full raw header inspection toggle — power users (forensics, deliverability); LOW effort once `headers` field is populated
- Embedded `message/rfc822` recursive rendering — forwarded email chains; HIGH complexity; matches existing `.msg` recursive navigation

**Defer (v2+):**
- TNEF/winmail.dat decoding — separate parser problem; small subset of Outlook emails
- Export to PDF — conversion, not viewing; significant complexity
- Remote image loading toggle — privacy UX enhancement; low priority for developer/power-user tool
- MBOX/PST/NSF format support — completely different parsing problem; out of scope

**Anti-features to explicitly avoid:**
- Rendering HTML via unsandboxed `iframe` or direct `innerHTML` without sanitization — active XSS vector
- Auto-fetching remote images — leaks IP to tracking pixels; breaks client-side-only privacy guarantee
- Email compose/reply — makes it a mail client; contradicts read-only viewer constraint

### Architecture Approach

The architecture follows a strict parallel-paths-to-unified-interface pattern. Both the MSG parser and the new EML parser produce a single `UnifiedMessage` type. The UI components are format-agnostic — they consume `UnifiedMessage` only. Format detection lives at the entry point (`index.ts`) as a single dispatch function. This means adding EML support requires zero changes to any UI component beyond updating a TypeScript import.

**Major components:**
1. `lib/scripts/types/unified-message.ts` (new) — single data contract shared by all parsers and all components; must be defined before any other work begins
2. `lib/scripts/eml/eml-parser.ts` (new) — wraps `postal-mime`, maps `Email` → `UnifiedMessage`; only file that imports from `postal-mime`
3. `lib/scripts/index.ts` (updated) — adds format detection by extension, dispatches to correct parser, updates file accept filter
4. `lib/scripts/msg/msg-parser.ts` (updated) — mechanical type update to return `UnifiedMessage` instead of the existing `Message` type
5. `lib/components/**` (updated) — import updated from `msg/types/message` to `types/unified-message`; no functional changes

**Key patterns:**
- Adapter pattern: parsers adapt to `UnifiedMessage`; UI never sees parser-internal types or library types
- Pre-parsed embedded messages: `message/rfc822` parts parsed fully inside `eml-parser.ts` and stored as `UnifiedAttachment.embeddedMessage: UnifiedMessage` — the UI receives a complete data tree
- `DirectoryEntry` removed from unified interface: replaced by `embeddedMessage?: UnifiedMessage`; OLE2-specific types do not leak into the shared contract

**Build order (dictated by dependency chain):**
1. Define `UnifiedMessage` interface — all other work depends on this
2. Update MSG parser to produce `UnifiedMessage` — regression checkpoint on existing functionality
3. Update UI components to consume `UnifiedMessage` — validates interface is complete
4. Build EML parser internals — header parser → body parser → top-level `eml-parser.ts`
5. Wire EML parser into `index.ts` — format detection, drag-and-drop update, file picker update
6. Add embedded `message/rfc822` support — depends on complete body parser and working embedded-msg component

### Critical Pitfalls

1. **HTML body rendered unsanitized** — Use `DOMPurify.sanitize()` with a strict allowlist before any `innerHTML` assignment. Existing `.msg` renderer has a documented XSS issue (`senderName` unescaped in HTML templates); audit both paths together. This is the highest-severity issue — ship nothing to production without it.

2. **Non-recursive multipart traversal** — Parse the MIME tree recursively without assuming depth. Outlook and Exchange produce `multipart/mixed > multipart/related > multipart/alternative` nesting. Flat iteration misses the HTML body entirely for these emails. Flat iteration is never acceptable — recursion must be built from the first commit.

3. **RFC 2047 encoded-word headers not decoded** — Apply a decode pass to every extracted header value. Missing this causes subjects and sender names to display `=?UTF-8?B?...?=` — immediately visible to users. Treat as a parsing correctness issue, not a polish item.

4. **CRLF/LF line ending not normalized** — Normalize `\r\n` → `\n` once at the top of the parse function before any splitting or boundary detection. Missing this causes boundary detection failures on files from Windows clients or mixed sources.

5. **Base64 decoded via raw `atob()`** — Strip all whitespace and normalize padding before decoding. `atob()` throws on MIME-standard line-broken base64. Affects 10-20% of real-world emails. Never call `atob()` directly on a MIME part.

## Implications for Roadmap

Based on research, the dependency chain from ARCHITECTURE.md dictates a clear 4-phase structure. Phases 1-2 are infrastructure and regression-safety; Phases 3-4 are the new user-facing value.

### Phase 1: Unified Interface Foundation

**Rationale:** Every subsequent piece of work depends on `UnifiedMessage` being stable. Updating the MSG parser and all UI components to use it first means Phase 3 (EML parser) can be wired in without touching components again. Doing this first also creates a regression checkpoint — if the existing `.msg` functionality works end-to-end through the new type, the interface is correct.

**Delivers:** A defined `UnifiedMessage` type contract; MSG parser updated to produce it; all UI components updated to consume it; existing `.msg` functionality fully verified through the new interface.

**Addresses:** Architectural anti-pattern prevention (no format-specific branches in UI components; `DirectoryEntry` removed from shared interface).

**Avoids:** The anti-pattern of extending the existing `Message` type with EML-specific fields; OLE2 types leaking into the unified contract.

**Research flag:** Standard patterns, skip research-phase. This is a mechanical TypeScript refactor with clear source and target types from the existing codebase.

### Phase 2: EML Parser Core

**Rationale:** The header parser is a prerequisite for the body parser (Content-Type and charset come from headers). All critical pitfalls from PITFALLS.md manifest in this phase and must be addressed here — not deferred. XSS sanitization is mandatory before any HTML body is rendered; it cannot be added later as a polish pass.

**Delivers:** A complete `parseEml(arrayBuffer): Promise<UnifiedMessage>` function that correctly handles: CRLF normalization, recursive multipart traversal, RFC 2047 encoded-word header decoding, charset-aware body decoding via `TextDecoder`, base64/quoted-printable attachment decoding with padding normalization, HTML body XSS sanitization via DOMPurify, and plain-text fallback when no HTML part is present.

**Uses:** `postal-mime@2.7.4` as the MIME parsing engine; browser `TextDecoder`; DOMPurify.

**Addresses (FEATURES.md P1):** eml-parser module, multipart/mixed + multipart/alternative, header extraction, RFC 2047 decoding, QP/base64 decoding, charset handling, plain text + HTML body extraction, XSS sanitization, attachment extraction.

**Avoids (PITFALLS.md critical):** All 7 critical pitfalls — CRLF normalization, multipart recursion, charset defaults, RFC 2047 headers, base64 decoding, HTML sanitization, message/rfc822 foundation.

**Research flag:** Standard patterns; `postal-mime` handles the MIME heavy lifting. The adapter layer is well-specified. DOMPurify integration is documented. No phase research needed.

### Phase 3: Entry Point Integration and File Handling

**Rationale:** Wires the complete EML parser into the application. This phase is intentionally narrow — no new parsing logic, just connecting existing pieces. Keeping it separate from Phase 2 ensures the parser is fully testable in isolation before being exposed to user file input.

**Delivers:** Format detection at `index.ts`; updated drag-and-drop handler accepting `.eml`; updated file picker `accept` attribute; unified `parseFile(file)` dispatch function; error handling for unsupported formats; loading state for large files.

**Addresses (FEATURES.md P1):** Unified `.msg`/`.eml` file picker; drag-and-drop file loading.

**Avoids (PITFALLS.md integration):** Silent rejection of `.eml` files in drag-and-drop (current line 26 issue); file picker showing only `.msg`; `file.type` fallback for OS-specific MIME type exposure.

**Research flag:** Standard patterns; straightforward integration. No phase research needed.

### Phase 4: Enhanced EML Features (v1.x)

**Rationale:** Deferred from Phase 2 because these features have HIGH complexity and depend on the core parser being stable and tested against real-world files. Inline CID images require a working HTML body renderer. Embedded `message/rfc822` recursive rendering requires the full MIME tree traversal to be correct. Raw header toggle is LOW complexity but LOW priority until core features are validated.

**Delivers:** Inline image rendering via CID/`multipart/related` (resolve `cid:` references, create object URLs, swap `src` attributes in HTML before sanitization); embedded `message/rfc822` recursive rendering (recursive `parseEml` call inside parser, `UnifiedAttachment.embeddedMessage` populated, existing `embeddedMsgsFragment()` reused); raw header inspection toggle (populate `headers` field in `UnifiedMessageContent`, add UI toggle).

**Addresses (FEATURES.md P2):** Inline CID images, raw header toggle, embedded message/rfc822.

**Avoids (PITFALLS.md):** Recursion depth limit for `message/rfc822` (cap at 10 levels); CID reference resolution done before DOMPurify sanitization pass; unreferenced parts in `multipart/related` surfaced as attachments not silently dropped.

**Research flag:** Inline CID image resolution may benefit from a focused research pass — the interaction between object URL lifecycle, DOMPurify allowlist configuration, and Outlook's non-standard `multipart/mixed` CID embedding has real-world edge cases. Embedded message recursion is well-specified by `postal-mime`'s `forceRfc822Attachments` option.

### Phase Ordering Rationale

- **Interface before parsers:** `UnifiedMessage` must exist before any parser can return it. Updating the existing MSG parser to use it first gives a regression test for free — existing `.msg` files must still work after Phase 1.
- **Parser before wiring:** The EML parser should be fully unit-testable in isolation before it touches the entry point. Bugs caught at the parser level are easier to diagnose than bugs encountered via the file input UI.
- **Core before enhancements:** Inline CID images and recursive embedded messages are both HIGH complexity. Shipping them before the core is validated against diverse real-world EML files invites compounding bugs. Phase 3 creates the validation gate.
- **XSS sanitization is not a phase — it is a requirement of Phase 2:** DOMPurify must be part of the HTML body rendering in Phase 2. Moving it to a later phase would mean shipping an XSS vulnerability to production.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (CID inline images):** Object URL lifecycle management, DOMPurify `ADD_TAGS`/`ADD_ATTR` configuration for `img src` with object URLs, and Outlook's non-standard CID embedding in `multipart/mixed` rather than `multipart/related` are all edge cases worth a targeted research pass before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Mechanical TypeScript refactor; source and target types are fully known from the existing codebase.
- **Phase 2:** `postal-mime` is the parsing engine; the adapter layer is straightforward; pitfall mitigations are fully documented.
- **Phase 3:** File input and drag-and-drop integration follows browser standard patterns; no novel techniques.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `postal-mime` verified via official repo, changelog, and docs. Zero alternatives are competitive. Version 2.7.4 confirmed stable with recent releases. |
| Features | HIGH | RFC standards are stable and definitive. Feature expectations cross-verified against 3 live competitors (Encryptomatic, CoolUtils, Zoho). MIME content type matrix sourced from RFCs directly. |
| Architecture | HIGH | Based on direct codebase inspection. Existing `Message` type, component structure, and entry point behaviour all confirmed from source. `UnifiedMessage` interface design follows well-established adapter pattern. |
| Pitfalls | HIGH | Critical pitfalls verified against RFC specs, Mozilla Bugzilla post-mortems (multiple bug IDs), and library source analysis. All 7 critical pitfalls have cited sources. |

**Overall confidence: HIGH**

### Gaps to Address

- **DOMPurify allowlist configuration for email HTML:** The specific `DOMPurify.sanitize()` options needed to preserve valid email formatting (tables, inline styles for layout, `img` tags with object URL `src`) while stripping dangerous content are not fully specified in research. Needs a targeted test against real marketing/newsletter HTML during Phase 2 implementation.
- **`postal-mime` bundle size exact figure:** Research notes approximately 50-60 KB minified but flags this as LOW confidence (bundlephobia was not confirmed). Should be checked against current project bundle baseline before Phase 2 work begins. Unlikely to be a blocker given existing `@molotochok/msg-viewer` bundle.
- **Existing XSS in `.msg` renderer:** PITFALLS.md documents an existing unescaped `senderName` in `lib/components/message/index.ts`. This is out of scope for the EML milestone but should be flagged as a separate ticket. Phase 1 component updates are an opportunity to fix it.

## Sources

### Primary (HIGH confidence)
- `postal-mime` official repo — https://github.com/postalsys/postal-mime — version, deps, TypeScript support, browser compatibility confirmed
- `postal-mime` official docs — https://postal-mime.postalsys.com/ — browser/Worker support confirmed
- RFC 2045 — https://www.rfc-editor.org/rfc/rfc2045 — Content-Transfer-Encoding, charset defaults
- RFC 2046 — https://www.rfc-editor.org/rfc/rfc2046.html — multipart types, boundary rules
- RFC 2047 — https://datatracker.ietf.org/doc/html/rfc2047 — encoded-word header syntax
- WHATWG Encoding Standard — https://encoding.spec.whatwg.org/ — TextDecoder label normalization
- Existing codebase: `lib/scripts/msg/types/message.d.ts`, `lib/components/`, `lib/scripts/index.ts` — direct inspection

### Secondary (MEDIUM confidence)
- Mozilla Bugzilla #505172, #76323, #269826, #87653, #463129, #493544 — multipart/CRLF/RFC2047 real-world failure post-mortems
- Encryptomatic MessageViewer, CoolUtils Online EML, Zoho EML Viewer — competitor feature comparison
- OWASP XSS Filter Evasion Cheat Sheet — HTML sanitization requirements
- Refactoring Guru adapter pattern (TypeScript) — architectural pattern reference

### Tertiary (LOW confidence)
- bundlephobia postal-mime — bundle size estimate (~50-60 KB); unconfirmed exact figure; check before Phase 2

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
