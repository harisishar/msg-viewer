# Phase 2: EML Parser Core - Research

**Researched:** 2026-04-01
**Domain:** RFC 822 / MIME email parsing in the browser; HTML sanitization; adapter to UnifiedMessage
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Use `postal-mime@2.7.4` as the MIME parsing engine — zero production dependencies, browser-native, TypeScript definitions shipped, actively maintained
- Use `DOMPurify` (latest stable) as the HTML sanitizer — industry standard, ~45KB min+gzip, well-tested against email XSS vectors
- Both installed as npm dependencies (not vendored, not custom-built)
- No other new dependencies for this phase
- Allow: `<table>`, `<tr>`, `<td>`, `<th>`, `<thead>`, `<tbody>`, `<tfoot>` (email newsletters use tables extensively)
- Allow: `style` attribute (inline styles are standard in email HTML — no external CSS sheets)
- Allow: `<img>` with `src` only for `blob:` and `data:` protocols (object URLs for CID images later, data URIs for inline)
- Block: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, event handler attributes (`onclick`, `onerror`, etc.)
- Block: `javascript:` and `vbscript:` in href/src attributes
- Block: remote images by default — `http://` and `https://` `src` attributes stripped (privacy protection, tracking pixel prevention)
- Use `DOMPurify.sanitize(html, config)` with a reusable config object defined once in the eml-parser module
- Best-effort parsing with graceful degradation — don't throw on malformed input
- If headers are parseable but body is corrupt: show headers with "Body could not be parsed" message
- If file is completely unparseable: throw a descriptive error that the existing `errorFragment()` component displays
- Missing optional headers (CC, Date) should result in empty strings / null, not errors
- Malformed MIME boundaries: fall back to treating the entire body as plain text
- Log no warnings to console in production — errors surface through the UI only
- Create `lib/scripts/eml/eml-parser.ts` mirroring `lib/scripts/msg/msg-parser.ts` structure
- Export `parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage>` (async because postal-mime is async)
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EML-01 | User can open a standard .eml file and see the parsed message content | postal-mime.parse() returns a complete Email object from any RFC 822 input |
| EML-02 | User sees correct Subject, From, To, CC, and Date headers extracted from .eml | postal-mime.Email exposes `subject`, `from`, `to`, `cc`, `bcc`, `date` as first-class fields |
| EML-03 | User sees non-ASCII header values decoded correctly (RFC 2047 encoded-words) | postal-mime decodes RFC 2047 encoded-words internally before returning `subject` and address `name` fields |
| EML-04 | User sees plain text body rendered from text/plain MIME part | postal-mime.Email.text contains the decoded plain text body |
| EML-05 | User sees HTML body rendered from text/html MIME part (with XSS sanitization) | postal-mime.Email.html contains decoded HTML; DOMPurify.sanitize() provides XSS filtering |
| EML-06 | User sees correct body when email has multipart/alternative (HTML preferred, plain text fallback) | postal-mime handles multipart/alternative internally; returns both `html` and `text` fields; adapter picks `html` first |
| EML-07 | User sees correct body and attachments when email has multipart/mixed structure | postal-mime traverses multipart/mixed recursively; attachments[] array is populated |
| EML-08 | User sees correct international characters via charset decoding (UTF-8, ISO-8859-*, etc.) | postal-mime uses TextDecoder with charset from Content-Type; handles legacy charsets via WHATWG Encoding Standard |
| EML-09 | User sees correct content decoded from quoted-printable transfer encoding | postal-mime decodes quoted-printable internally |
| EML-10 | User sees correct content decoded from base64 transfer encoding | postal-mime decodes base64 internally (tolerant of whitespace and padding issues) |
| SEC-01 | HTML body content is sanitized before rendering (no script execution, no event handlers, no dangerous hrefs) | DOMPurify.sanitize() with ALLOWED_TAGS/ALLOWED_ATTR allowlist strips all dangerous elements and attributes |
| SEC-02 | Remote images in HTML body are blocked by default (privacy protection) | DOMPurify uponSanitizeAttribute hook intercepts src attributes and rejects http:// and https:// protocols |
</phase_requirements>

---

## Summary

Phase 2 builds a single new module: `lib/scripts/eml/eml-parser.ts`. The implementation is primarily an adapter: call `PostalMime.parse(source)`, map its `Email` output to `UnifiedMessage`, and apply DOMPurify to the HTML body before returning. The heavy lifting — MIME boundary detection, header unfolding, RFC 2047 encoded-word decoding, quoted-printable and base64 decoding, charset normalization, and multipart tree traversal — is entirely handled by postal-mime. The adapter layer is estimated at 60-90 lines.

Two dependencies must be installed before implementation begins: `postal-mime@2.7.4` (already locked) and `dompurify@3.3.3` plus `@types/dompurify@3.2.0` for TypeScript. Neither has been installed yet — the current `package.json` does not include them. DOMPurify requires `document` to be available, which it is in the browser context this project targets; it must not be called in a Web Worker or Node.js context without a DOM shim.

The most consequential decision in Claude's discretion is the DOMPurify configuration shape. The locked decisions specify which elements and attributes to allow/block at a policy level; the exact implementation requires a `uponSanitizeAttribute` hook to handle the remote-image-blocking requirement (stripping `http://`/`https://` src values) since ALLOWED_URI_REGEXP alone would remove the attribute entirely rather than selectively blocking only remote protocols.

**Primary recommendation:** Build a flat `lib/scripts/eml/eml-parser.ts` (single file, no subdirectory helpers needed for this phase). Keep DOMPurify config as a module-level constant inside `eml-parser.ts`. This matches the pattern of `msg-parser.ts` — one exported function, private helpers, nothing leaked outward.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `postal-mime` | 2.7.4 | Parse RFC 822 / MIME email to structured `Email` object | Zero deps, browser-native, actively maintained (released 2026-03-17), handles all MIME edge cases, ships TypeScript types, used in Cloudflare Workers |
| `dompurify` | 3.3.3 | Sanitize HTML email body before DOM insertion | Industry standard XSS sanitizer, browser-native DOM API, well-tested against email-specific attack vectors, released 2026-03-11 |

### Supporting (type declarations)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/dompurify` | 3.2.0 | TypeScript definitions for DOMPurify | Required at dev time; DOMPurify does not ship its own .d.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `postal-mime` | Custom MIME parser | Custom covers ~90% of real-world files (MEDIUM confidence), requires ongoing maintenance for edge cases; postal-mime eliminates that entirely |
| `dompurify` | Manual allowlist with regex | Regex HTML sanitization is reliably insecure; DOMPurify uses real DOM parsing which handles encoding tricks regex cannot |

**Installation:**
```bash
npm install postal-mime dompurify
npm install --save-dev @types/dompurify
```

**Version verification (confirmed against npm registry 2026-04-01):**
- `postal-mime`: 2.7.4 (published 2026-03-17) — confirmed current
- `dompurify`: 3.3.3 (published 2026-03-11) — confirmed current
- `@types/dompurify`: 3.2.0 — confirmed current

---

## Architecture Patterns

### Recommended Project Structure

```
lib/scripts/
├── index.ts                   # Existing — NOT modified in this phase (Phase 3 wires EML in)
├── types/
│   └── unified-message.ts     # Existing Phase 1 output — do not modify
├── msg/
│   └── msg-parser.ts          # Existing — do not modify
└── eml/
    └── eml-parser.ts          # NEW: single file for this entire phase
```

The `lib/scripts/eml/` directory does not exist yet and must be created. A single `eml-parser.ts` is sufficient for Phase 2; additional helper files (mime-header-parser, mime-body-parser) are not needed because postal-mime handles all MIME internals.

### Pattern 1: Adapter over postal-mime

**What:** `eml-parser.ts` is the only file that imports from `postal-mime`. It calls `PostalMime.parse()`, receives the `Email` output, and maps each field to `UnifiedMessage`. Nothing outside `eml-parser.ts` ever sees the postal-mime type.

**When to use:** Whenever a third-party library's output shape differs from your internal contract. This prevents library churn from propagating across the codebase.

**Example:**
```typescript
// Source: postal-mime README + UnifiedMessage type contract
import PostalMime from "postal-mime";
import DOMPurify from "dompurify";
import type { UnifiedMessage } from "../types/unified-message";

export async function parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage> {
  const email = await PostalMime.parse(source);
  return {
    content: {
      date: email.date ? new Date(email.date) : null,
      subject: email.subject ?? "",
      senderName: email.from?.name ?? "",
      senderEmail: email.from?.address ?? "",
      body: email.text ?? "",
      bodyHTML: email.html ? DOMPurify.sanitize(email.html, DOMPURIFY_CONFIG) : "",
      headers: buildRawHeaders(email.headers),
    },
    attachments: mapAttachments(email.attachments ?? []),
    recipients: mapRecipients(email),
  };
}
```

### Pattern 2: DOMPurify with uponSanitizeAttribute hook for remote image blocking

**What:** DOMPurify's ALLOWED_URI_REGEXP and FORBID_ATTR are too blunt for the SEC-02 requirement. The requirement is nuanced: allow `src` on `<img>` but only for `blob:` and `data:` protocols, not `http://`/`https://`. This requires the `uponSanitizeAttribute` hook.

**When to use:** Any time attribute-level policy depends on both attribute name AND attribute value.

**Example:**
```typescript
// Source: DOMPurify addHook API (github.com/cure53/DOMPurify)
const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    // Structure
    'div', 'span', 'p', 'br', 'hr',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Text formatting
    'b', 'i', 'u', 'em', 'strong', 's', 'strike', 'sub', 'sup', 'small',
    // Links
    'a',
    // Images
    'img',
    // Tables (required for email newsletters)
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Block
    'blockquote', 'pre', 'code',
    // Font (legacy email HTML)
    'font', 'center',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height', 'align', 'valign',
    'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan',
    'color', 'bgcolor', 'face', 'size',
    'style',         // inline styles required for email newsletters
    'target',        // <a target="_blank">
    'rel',
    'class', 'id',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
  ALLOW_DATA_ATTR: false,
};

// Hook runs AFTER ALLOWED_ATTR filter — only called for attributes that survived the allowlist.
// Block http:// and https:// src values (remote image tracking prevention).
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'src') {
    const val = data.attrValue.trim().toLowerCase();
    if (val.startsWith('http://') || val.startsWith('https://')) {
      data.keepAttr = false;
    }
  }
});
```

**Critical note:** `DOMPurify.addHook()` is global and persistent. The hook must be set up once at module load, not inside the `parseEml()` call body. If `parseEml()` is ever called in a context without DOM access, DOMPurify will throw. This is safe in the browser build but would fail in a Node.js test environment.

### Pattern 3: Recipient mapping from postal-mime address arrays

**What:** postal-mime returns `email.to`, `email.cc`, `email.bcc` as arrays of Address objects (`{name: string, address: string}`). These map directly to `UnifiedRecipient` with the `type` field set based on which array they came from.

**Example:**
```typescript
// Source: postal-mime README (Address type structure)
function mapRecipients(email: Email): UnifiedRecipient[] {
  const recipients: UnifiedRecipient[] = [];
  for (const addr of email.to ?? []) {
    if ('address' in addr) recipients.push({ name: addr.name ?? "", email: addr.address ?? "", type: 'to' });
  }
  for (const addr of email.cc ?? []) {
    if ('address' in addr) recipients.push({ name: addr.name ?? "", email: addr.address ?? "", type: 'cc' });
  }
  for (const addr of email.bcc ?? []) {
    if ('address' in addr) recipients.push({ name: addr.name ?? "", email: addr.address ?? "", type: 'bcc' });
  }
  return recipients;
}
```

**Address groups:** postal-mime Address can be a group `{group: Mailbox[], name: string}` as well as a plain Mailbox. The `'address' in addr` check distinguishes them. For this phase, group addresses should be flattened (iterate `addr.group` if present). This is rare in practice but guards against a runtime exception.

### Pattern 4: Attachment mapping — content as Uint8Array

**What:** postal-mime returns `attachment.content` as `ArrayBuffer` by default (`attachmentEncoding` defaults to `"arraybuffer"`). `UnifiedAttachment.content` is `Uint8Array`. Convert at the boundary.

**Example:**
```typescript
// Source: UnifiedMessage type contract + postal-mime attachment shape
function mapAttachments(attachments: PostalAttachment[]): UnifiedAttachment[] {
  return attachments.map(att => ({
    fileName: att.filename ?? "",
    displayName: att.filename ?? "",
    mimeType: att.mimeType ?? "",
    content: att.content instanceof ArrayBuffer
      ? new Uint8Array(att.content)
      : new Uint8Array(),
  }));
}
```

**Note:** `message/rfc822` attachments are out of scope for Phase 2 (Phase 4). For now, map them like any other attachment — content as raw bytes. The Phase 4 implementation will detect `mimeType === 'message/rfc822'` and call `parseEml()` recursively to populate `embeddedMessage`.

### Pattern 5: Raw headers string reconstruction

**What:** `UnifiedMessageContent.headers` expects a raw string. postal-mime returns `email.headers` as an array of `{key: string, value: string}` objects. Reconstruct as `Key: value\n` lines.

**Example:**
```typescript
function buildRawHeaders(headers: Array<{key: string; value: string}>): string {
  return (headers ?? []).map(h => `${h.key}: ${h.value}`).join('\n');
}
```

### Anti-Patterns to Avoid

- **DOMPurify imported but hook set inside the async function:** The `addHook()` call must be at module scope (top-level), not inside `parseEml()`. Repeated calls to `addHook()` inside the function would accumulate duplicate hooks.
- **Passing `email.date` directly as `content.date`:** postal-mime returns `date` as an ISO 8601 string or the original string if parsing fails. Always wrap in `new Date()` and check for `NaN` — use `isNaN(date.getTime())` to fall back to `null`.
- **Calling DOMPurify.sanitize() on `email.text`:** The plain text body should never be passed through DOMPurify. It is rendered as plain text (via `textContent` or `white-space: pre-wrap`), not as HTML. Sanitizing it with DOMPurify would escape angle brackets in code-containing emails.
- **Modifying `DOMPURIFY_CONFIG` object at runtime:** Define it as a `const` at module scope. DOMPurify uses the config reference; mutating it between calls could cause subtle state bugs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME boundary detection | Custom split on `--boundary` | postal-mime | Boundaries can be quoted, have leading whitespace, appear in folded headers; the RFC has 15+ edge cases |
| RFC 2047 encoded-word decoding | `=?charset?encoding?text?=` regex | postal-mime | Multi-line folding, whitespace collapsing between adjacent encoded words, B vs Q encoding variants, charset-per-word |
| Quoted-printable decoding | `=XX` hex replacement | postal-mime | Soft line breaks (`=\r\n`), trailing space handling, long lines without breaks |
| Base64 MIME decoding | `atob()` directly | postal-mime | atob() throws on whitespace; real emails have `\r\n` in base64 content; missing padding characters |
| Charset normalization | `new TextDecoder(rawCharset)` | postal-mime | TextDecoder throws RangeError for unrecognized labels; Windows-1252 vs ISO-8859-1 ambiguity; postal-mime uses WHATWG Encoding Standard mapping |
| HTML XSS sanitization | Custom allowlist + regex | DOMPurify | Regex cannot safely parse HTML; encoding tricks (e.g., `&#106;avascript:`) bypass regex; DOMPurify uses the browser's own DOM parser |
| Remote image blocking | `src.startsWith('http')` string check | DOMPurify uponSanitizeAttribute hook | String checks can be bypassed via whitespace, mixed-case protocols, or data: URI with http content; hook runs post-parsing on normalized attribute values |

**Key insight:** Every "simple" MIME operation has a long tail of RFC-compliant edge cases that only appear with emails from older clients, non-English senders, or unusual configurations. postal-mime's test suite covers these exhaustively; any custom implementation starts with those gaps.

---

## Common Pitfalls

### Pitfall 1: DOMPurify addHook accumulating on repeated parses

**What goes wrong:** If `DOMPurify.addHook('uponSanitizeAttribute', ...)` is called inside the `parseEml()` function body, each parse call adds another hook instance. After 10 parses, 10 hook functions fire per attribute. The result is unexpected behavior and a memory leak.

**Why it happens:** `addHook()` is a module-level side-effect function that appends to a global hooks list, not a per-call configuration.

**How to avoid:** Call `DOMPurify.addHook()` exactly once, at module initialization time (top level of `eml-parser.ts`, outside any function). Alternatively, use `DOMPurify.removeAllHooks()` + `addHook()` in a setup function called once.

**Warning signs:** Increasingly slow parses; security policy inconsistently applied on second/third parse of the same file.

### Pitfall 2: email.date NaN propagation

**What goes wrong:** postal-mime returns `email.date` as a string (ISO 8601 or the original date header if it can't parse it). `new Date("garbage date string").getTime()` returns `NaN`. If this is stored in `content.date`, downstream rendering calls like `.toLocaleDateString()` produce `"Invalid Date"` visible to the user.

**Why it happens:** postal-mime documents `date` as an ISO string but does not throw if the source header is malformed — it returns the raw string instead.

**How to avoid:**
```typescript
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
```

**Warning signs:** Date field in UI shows "Invalid Date" for certain emails.

### Pitfall 3: postal-mime address group entries causing runtime exceptions

**What goes wrong:** RFC 5322 allows "group syntax" in address headers (`Friends: alice@x.com, bob@y.com;`). postal-mime returns these as `{group: Mailbox[], name: string}` objects, not `{name: string, address: string}` mailboxes. Code written assuming all address entries have an `address` property will throw `TypeError: cannot read property of undefined` at runtime.

**Why it happens:** Developer tests against normal emails. Group syntax is rare in personal email but appears in mailing list software and CRM-sent emails.

**How to avoid:** Type-guard every address entry with `'address' in addr` before accessing `.address`. For group entries, iterate `.group` to flatten into individual recipients.

**Warning signs:** TypeError crash when opening a specific .eml file; recipient list renders correctly for some emails but crashes for others.

### Pitfall 4: DOMPurify called in test environment without DOM

**What goes wrong:** `bun test` runs in a Node.js-like environment. DOMPurify uses `document` (and `window`) APIs. Calling `DOMPurify.sanitize()` in a test without a DOM shim throws `ReferenceError: document is not defined`.

**Why it happens:** The application is browser-only, but tests run in Bun which does not provide a browser DOM by default. DOMPurify requires `document` at the time `sanitize()` is called.

**How to avoid:** Tests for `eml-parser.ts` should be integration tests (or use a headless browser like `happy-dom` / `jsdom`). For unit tests that need to run in Bun's Node.js context, mock the DOMPurify import and assert that `DOMPurify.sanitize` was called with the expected arguments rather than testing the sanitization output directly.

Alternatively: structure the parser so the sanitizer is injected as a parameter in tests, with DOMPurify as the default. This allows tests to pass a no-op sanitizer.

**Warning signs:** `ReferenceError: document is not defined` when running `bun test` for eml-parser.

### Pitfall 5: Incorrect `content` handling for message/rfc822 attachments

**What goes wrong:** postal-mime returns `message/rfc822` parts in `email.attachments` with `content` as `ArrayBuffer`. Blindly constructing `new Uint8Array(content)` works, but if Phase 4 later expects `embeddedMessage` on these attachments, a planner might attempt to call `parseEml(attachment.content)` — however, `attachment.content` has already been consumed (ArrayBuffer is detached after `new Uint8Array()` construction if `.buffer` is used).

**Why it happens:** `new Uint8Array(arrayBuffer)` creates a view into the buffer; the original ArrayBuffer is still valid. This is safe. The actual risk is assuming the Uint8Array `.buffer` property equals the original ArrayBuffer when using `byteOffset !== 0` subarray slices — postal-mime may return sub-ArrayBuffers.

**How to avoid:** For Phase 2, always construct `new Uint8Array(att.content)` when `att.content instanceof ArrayBuffer`. This creates a copy-safe view. For Phase 4 recursion, pass `att.content` (the original ArrayBuffer) directly to `PostalMime.parse()` rather than converting first.

**Warning signs:** Corrupted embedded message content; ArrayBuffer detached errors in Phase 4.

---

## Code Examples

Verified patterns from official sources:

### Complete eml-parser.ts skeleton

```typescript
// lib/scripts/eml/eml-parser.ts
// Source: postal-mime API (github.com/postalsys/postal-mime README)
//         DOMPurify API (github.com/cure53/DOMPurify)
//         UnifiedMessage contract (lib/scripts/types/unified-message.ts)

import PostalMime from "postal-mime";
import type { Email, Attachment as PostalAttachment, AddressOrGroup } from "postal-mime";
import DOMPurify from "dompurify";
import type { UnifiedMessage, UnifiedAttachment, UnifiedRecipient } from "../types/unified-message";

// --- DOMPurify configuration (module-level constant) ---

const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'b', 'i', 'u', 'em', 'strong', 's', 'sub', 'sup', 'small',
    'a', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup', 'caption',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'blockquote', 'pre', 'code',
    'font', 'center',   // legacy email HTML
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height',
    'align', 'valign', 'cellpadding', 'cellspacing', 'border',
    'colspan', 'rowspan', 'color', 'bgcolor', 'face', 'size',
    'style',    // inline styles are standard in email HTML
    'target', 'rel',
    'class', 'id',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  ALLOW_DATA_ATTR: false,
};

// Block remote images (SEC-02). Hook set once at module load.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'src') {
    const val = data.attrValue.trim().toLowerCase();
    if (val.startsWith('http://') || val.startsWith('https://')) {
      data.keepAttr = false;
    }
  }
});

// --- Public API ---

export async function parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage> {
  let email: Email;
  try {
    email = await PostalMime.parse(source);
  } catch (e) {
    throw new Error(`Failed to parse EML file: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    content: {
      date: parseDate(email.date),
      subject: email.subject ?? "",
      senderName: email.from?.name ?? "",
      senderEmail: email.from?.address ?? "",
      body: email.text ?? "",
      bodyHTML: email.html ? DOMPurify.sanitize(email.html, DOMPURIFY_CONFIG) as string : "",
      headers: buildRawHeaders(email.headers ?? []),
    },
    attachments: mapAttachments(email.attachments ?? []),
    recipients: mapRecipients(email),
  };
}

// --- Private helpers ---

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function buildRawHeaders(headers: Array<{key: string; value: string}>): string {
  return headers.map(h => `${h.key}: ${h.value}`).join('\n');
}

function mapRecipients(email: Email): UnifiedRecipient[] {
  const recipients: UnifiedRecipient[] = [];
  function addAddrs(addrs: AddressOrGroup[] | undefined, type: 'to' | 'cc' | 'bcc') {
    for (const addr of addrs ?? []) {
      if ('address' in addr) {
        recipients.push({ name: addr.name ?? "", email: addr.address ?? "", type });
      } else if ('group' in addr) {
        for (const member of addr.group) {
          recipients.push({ name: member.name ?? "", email: member.address ?? "", type });
        }
      }
    }
  }
  addAddrs(email.to, 'to');
  addAddrs(email.cc, 'cc');
  addAddrs(email.bcc, 'bcc');
  return recipients;
}

function mapAttachments(attachments: PostalAttachment[]): UnifiedAttachment[] {
  return attachments.map(att => ({
    fileName: att.filename ?? "",
    displayName: att.filename ?? "",
    mimeType: att.mimeType ?? "",
    content: att.content instanceof ArrayBuffer
      ? new Uint8Array(att.content)
      : new Uint8Array(),
  }));
}
```

### postal-mime parse() call signatures

```typescript
// Source: postal-mime README (github.com/postalsys/postal-mime)

// From string (text content of the .eml file)
const email = await PostalMime.parse(emlString);

// From ArrayBuffer (File.arrayBuffer() result)
const email = await PostalMime.parse(arrayBuffer);

// Both work identically — postal-mime auto-detects input type.
// No options needed for Phase 2 (defaults handle multipart, charset, encoding).
```

### DOMPurify.sanitize() call

```typescript
// Source: DOMPurify README (github.com/cure53/DOMPurify)
// Returns string when no RETURN_DOM or RETURN_DOM_FRAGMENT option is set.
const cleanHTML: string = DOMPurify.sanitize(dirtyHTML, DOMPURIFY_CONFIG) as string;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `atob()` for MIME base64 | postal-mime internal decoder with whitespace tolerance | postal-mime v1+ | Eliminates InvalidCharacterError for real-world emails |
| Manual RFC 2047 regex decode | postal-mime decodes automatically before returning `subject`/`name` | postal-mime v1+ | Subject and sender name always arrive pre-decoded |
| `emailjs-mime-parser` (low-level) | `postal-mime` (high-level, returns structured Email) | postal-mime v2.0 (2024) | 10x less adapter code needed |
| DOMPurify v2.x config | DOMPurify v3.x with FORBID_TAGS as explicit list | DOMPurify v3.0 (2023) | Breaking change: some options renamed; FORCE_BODY behavior changed |

**Deprecated/outdated:**
- `emailjs-mime-parser`: Last published 7 years ago, abandoned. Do not use.
- `eml-format` (papnkukn): Callback-based, no TypeScript, unmaintained.
- `atob()` directly on MIME content: Throws on whitespace; never use for MIME base64.

---

## Open Questions

1. **DOMPurify in Bun test environment**
   - What we know: DOMPurify requires `document`; Bun's test runner does not provide a browser DOM
   - What's unclear: Whether `happy-dom` (Bun's built-in DOM experiment) is available and sufficient for DOMPurify's needs in this project's Bun version
   - Recommendation: Write eml-parser tests as integration-style tests that skip DOMPurify calls, OR mock the sanitizer. Do not block implementation on this — test the sanitization behavior manually in the browser. The existing test pattern (shape contracts, type checks) suggests this project does not do deep runtime unit tests.

2. **postal-mime `email.from` nullability**
   - What we know: RFC 5322 requires a `From` header but malformed emails may omit it; postal-mime types `from` as potentially undefined
   - What's unclear: Exact TypeScript type exported — whether it is `Address | undefined` or always present
   - Recommendation: Always null-guard with `email.from?.name ?? ""` and `email.from?.address ?? ""`. Verified safe pattern.

3. **DOMPurify `style` attribute and CSS injection risk**
   - What we know: Allowing the `style` attribute enables CSS injection attacks (e.g., `expression()`, `url()` for data exfiltration via CSS). The locked decision permits `style` for newsletter compatibility.
   - What's unclear: Whether DOMPurify 3.x sanitizes CSS property values within `style` attributes by default
   - Recommendation: DOMPurify does NOT sanitize CSS values inside `style` attributes — it only checks whether the attribute itself is allowed. Accept this tradeoff per the locked decision (CSS injection is lower severity than script injection in a read-only viewer). This is a known email security tradeoff made by all major email clients.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in, no separate install) |
| Config file | none — Bun auto-discovers `*.test.ts` files |
| Quick run command | `bun test tests/eml-parser.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EML-01 | parseEml() is exported and returns a promise | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-02 | Subject, From, To, CC, Date mapped to correct UnifiedMessage fields | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-03 | RFC 2047 encoded subject decoded (postal-mime handles internally — test adapter maps result correctly) | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-04 | Plain text body in `content.body` | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-05 | HTML body in `content.bodyHTML` after sanitization | manual (requires DOM) | browser smoke test | ❌ Wave 0 |
| EML-06 | multipart/alternative: html preferred over plain text | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-07 | multipart/mixed: attachments[] populated | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-08 | Charset decoding (postal-mime internal — test that non-ASCII text is not garbled in output) | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-09 | QP decoding (postal-mime internal) | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| EML-10 | Base64 decoding (postal-mime internal) | unit | `bun test tests/eml-parser.test.ts` | ❌ Wave 0 |
| SEC-01 | Script tags stripped from HTML body (manual — needs DOM for DOMPurify) | manual | browser smoke test | ❌ Wave 0 |
| SEC-02 | Remote image src stripped from HTML body (manual — needs DOM for DOMPurify) | manual | browser smoke test | ❌ Wave 0 |

**Note on DOM requirement:** Tests for EML-05, SEC-01, and SEC-02 require DOMPurify which requires a browser DOM. These must be validated manually in the browser or via a DOM-capable test environment. The unit tests in `eml-parser.test.ts` should mock DOMPurify for EML-05 and assert it was called, while validating the sanitization policy in a separate manual test pass.

### Sampling Rate

- **Per task commit:** `bun test tests/eml-parser.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green (`bun test`) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/eml-parser.test.ts` — covers EML-01 through EML-10 (unit tests with mocked DOMPurify for DOM-dependent tests)
- [ ] `tests/fixtures/simple.eml` — minimal RFC 822 fixture for EML-01/EML-02
- [ ] `tests/fixtures/multipart-alternative.eml` — fixture for EML-04/EML-05/EML-06
- [ ] `tests/fixtures/multipart-mixed.eml` — fixture for EML-07/EML-10
- [ ] `lib/scripts/eml/` — directory does not exist yet; must be created with `eml-parser.ts`

---

## Sources

### Primary (HIGH confidence)

- `https://github.com/postalsys/postal-mime` — official repo; parse() API, Email type, Address type, Attachment type, PostalMimeOptions all verified from README
- `https://github.com/cure53/DOMPurify` — official repo; Config interface, addHook API, uponSanitizeAttribute hook, ALLOWED_TAGS/ALLOWED_ATTR/FORBID_TAGS options verified
- `lib/scripts/types/unified-message.ts` — direct code inspection; confirmed exact field names and types
- `lib/scripts/msg/msg-parser.ts` — direct code inspection; confirmed structural pattern to mirror
- `npm view postal-mime version` (2026-04-01) — confirmed 2.7.4 is current, published 2026-03-17
- `npm view dompurify version` (2026-04-01) — confirmed 3.3.3 is current, published 2026-03-11

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — pre-existing research; critical pitfalls cross-referenced against official RFC specs and Mozilla Bugzilla post-mortems
- `.planning/research/STACK.md` — pre-existing stack research with rationale
- `.planning/research/ARCHITECTURE.md` — pre-existing architecture research; adapter pattern and project structure

### Tertiary (LOW confidence)

- DOMPurify CSS injection behavior for `style` attribute: inferred from library design and documentation — not explicitly confirmed via current official docs. Treat as known behavior requiring browser verification.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed against npm registry 2026-04-01; APIs verified from official repos
- Architecture: HIGH — based on existing code inspection (msg-parser.ts pattern) and locked decisions from CONTEXT.md
- Pitfalls: HIGH — documented in pre-existing PITFALLS.md research which cross-references RFC specs and Mozilla Bugzilla
- DOMPurify CSS behavior: LOW — not confirmed from current official docs; flagged as open question

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (postal-mime and DOMPurify are actively maintained; verify versions before implementing if more than 30 days elapse)
