# Stack Research

**Domain:** Browser-based EML/MIME email file parsing (milestone addition to existing .msg viewer)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Context

This is a milestone addition — not a greenfield project. The existing stack is fixed:
TypeScript 5, Bun 1.1+, browser-only runtime, Cloudflare Pages deployment, `@molotochok/msg-viewer`
for .msg parsing. The question is specifically: what to add for `.eml` (RFC 822 / MIME) parsing.

The existing `Message` interface (from `msg/types/message.d.ts`) is the target output shape. Any
EML parser must produce data compatible with `MessageContent`, `Attachment[]`, and `Recipient[]`.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `postal-mime` | 2.7.4 | Parse raw RFC 822 EML bytes into structured email object | Actively maintained (v2.7.4 released 2026-03-17), zero production dependencies, ships full TypeScript definitions, browser-first design (not a Node.js lib ported to browser), works with `ArrayBuffer`/`Uint8Array`/`Blob` — exactly what the File API gives you. Used by Cloudflare Email Workers (same deployment target as this project). MIT-0 license. |

No other new production dependencies are recommended.

### Supporting Libraries

None. The existing stack already provides everything else needed:

| Already Available | Provides |
|-------------------|----------|
| Browser `TextDecoder` API | Charset decoding (postal-mime uses this internally) |
| Browser `FileReader` / `File.arrayBuffer()` | Reading the dropped/selected `.eml` file as `ArrayBuffer` |
| TypeScript 5 (existing) | Type-safe adapter layer mapping `postal-mime` output → `Message` |
| Existing `Message` interface | Target data shape — no new interfaces needed |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing `bun test` | Unit tests for the eml-parser adapter | No new test runner needed |
| Existing `build.ts` (Bun Build API) | Bundles postal-mime into the output | Bun's bundler handles ESM packages natively; postal-mime exports both ESM and CJS |

---

## Installation

```bash
# Single production dependency
npm install postal-mime
```

postal-mime has zero production dependencies. Adding it adds one entry to `package.json` and
nothing else transitively.

---

## Architecture Note: Adapter Pattern

`postal-mime` returns its own `Email` object shape (different from the existing `Message` interface).
The work is writing a thin adapter module at `lib/scripts/eml/eml-parser.ts` that:

1. Calls `PostalMime.parse(arrayBuffer)` — returns `Promise<Email>`
2. Maps `Email` fields → `MessageContent` / `Attachment[]` / `Recipient[]`
3. Returns a `Message`-compatible object (minus `.file` which is OLE2-specific; can be `null`)

This is ~50-80 lines of TypeScript with no logic complexity. The heavy lifting (MIME boundary
splitting, quoted-printable / base64 decoding, header unfolding, encoded-word decoding,
nested `message/rfc822` parts, charset detection) is all handled by postal-mime.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `postal-mime` 2.7.4 | `eml-parse-js` 1.2.0-beta | Never — beta version, ~13k weekly downloads vs postal-mime's much higher adoption, no clear feature advantage for this use case |
| `postal-mime` 2.7.4 | `emailjs-mime-parser` 2.0.7 | Never — last published 7 years ago, abandoned, low-level raw API requiring manual assembly of email parts |
| `postal-mime` 2.7.4 | `ProtonMail/jsmimeparser` | Never — archived/unmaintained ProtonMail internal lib, no npm release, not meant for external use |
| `postal-mime` 2.7.4 | `eml-format` (papnkukn) | Never — callback-based API, no TypeScript, last meaningful release years ago |
| `postal-mime` 2.7.4 | Zero-dependency custom parser | Only if bundle size is a hard constraint below ~20 KB and the team is willing to own a MIME parser indefinitely. MIME has many edge cases (folded headers, encoded-words in different positions, nested multipart/mixed inside multipart/alternative, non-ASCII boundary strings, malformed base64). postal-mime handles all of these and has active security fixes (e.g. DoS prevention for deeply nested structures added 2025-11). Building this is 2-4 weeks of work for equivalent correctness. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nodemailer/mailparser` | Node.js-specific — requires `stream` and `buffer` modules not available in the browser. Would need a polyfill bundle adding significant weight. | `postal-mime` |
| `emailjs-mime-parser` | Abandoned (7 years, no updates). Low-level API emits raw `Uint8Array` chunks per MIME node — caller must assemble the email manually. More work, less correctness. | `postal-mime` |
| `eml-parser` (netas-ch) | Minimal, no TypeScript types, no active maintenance. Limited encoding support. | `postal-mime` |
| Any Node.js `Buffer`-dependent package | The existing project targets browser runtime explicitly. `Buffer` is not a browser global. | Browser-native `ArrayBuffer` / `Uint8Array` |

---

## Stack Patterns by Variant

**If the project must stay zero-dependency (no new npm packages):**
- Build a custom MIME parser using `TextDecoder`, `String.prototype.split`, and regex for header
  parsing and boundary detection
- Implement quoted-printable and base64 decoding natively (both are ~20-30 lines)
- Implement RFC 2047 encoded-word decoding for non-ASCII headers (~30 lines)
- Accept that edge cases (malformed boundaries, nested multipart, unusual charsets) will require
  ongoing fixes
- Confidence this covers 90% of real-world EML files: MEDIUM. Covers 99%: LOW.

**If bundle size is a hard constraint:**
- `postal-mime` minified is approximately 50-60 KB (unverified exact figure — check bundlephobia).
  Given the existing app already bundles `@molotochok/msg-viewer`, this is unlikely to be
  a regression issue.

**If deep nested EML parsing is required (message/rfc822 attachments):**
- `postal-mime` handles `message/rfc822` MIME parts natively — they appear as attachments with
  `mimeType: 'message/rfc822'` and their content is the raw sub-message bytes, which can be
  fed back into `PostalMime.parse()` recursively. Exact same approach as the existing
  `embeddedMsgObj` handling in the .msg parser.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `postal-mime@2.7.4` | TypeScript 5.x | Ships its own `.d.ts`; no `@types/postal-mime` needed |
| `postal-mime@2.7.4` | Bun 1.1+ bundler | Exports both ESM (`src/postal-mime.js`) and CJS (`dist/postal-mime.cjs`); Bun resolves ESM by default |
| `postal-mime@2.7.4` | Cloudflare Pages | Zero dependencies; produces standard browser JS; no Node.js builtins used |
| `postal-mime@2.7.4` | Existing `Message` interface | Requires adapter layer — `Email.from` → `senderName`/`senderEmail`, `Email.html` → `bodyHTML`, `Email.attachments[]` → `Attachment[]`, etc. Not a drop-in replacement, but a straightforward mapping. |

---

## Sources

- https://github.com/postalsys/postal-mime — official repo, package.json version 2.7.4 verified, zero production deps confirmed, TypeScript definitions confirmed
- https://postal-mime.postalsys.com/ — official docs, browser support and TypeScript readiness confirmed
- https://github.com/postalsys/postal-mime/blob/master/CHANGELOG.md — release history 2024-2026 verified
- https://github.com/emailjs/emailjs-mime-parser — npm page, last published 7 years ago confirmed
- https://www.npmjs.com/package/eml-parse-js — beta version status, ~13k weekly downloads confirmed
- https://bundlephobia.com/package/postal-mime — bundle size page (exact figures not confirmed; LOW confidence on size estimate)

---

*Stack research for: EML/MIME parsing milestone on msg-viewer*
*Researched: 2026-04-01*
