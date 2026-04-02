# Feature Research

**Domain:** Browser-based EML/MIME email file viewer (milestone: adding .eml support to existing .msg viewer)
**Researched:** 2026-04-01
**Confidence:** HIGH (RFC standards are stable; feature expectations verified against multiple live viewers)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Header display (Subject, From, To, CC, Date) | All email clients show this; it's the identity of an email | LOW | Maps directly to existing `MessageContent` interface fields — eml-parser must populate the same struct |
| Plain text body rendering | RFC 2045 mandates text/plain as baseline content type; every EML has it as fallback | LOW | `text/plain` MIME part; assign to `message.content.body` |
| HTML body rendering | Modern emails are HTML-first; plain-text-only rendering breaks real-world emails | MEDIUM | `text/html` part inside `multipart/alternative`; assign to `message.content.bodyHTML`; requires XSS sanitization before inserting into DOM |
| Attachment listing with download | Users open EML files specifically because they need attachments; missing this is a blocker | MEDIUM | `Content-Disposition: attachment` parts; populate `message.attachments[]`; existing `attachmentsFragment()` component reusable as-is |
| File size display per attachment | Standard UX across all email clients | LOW | Already implemented in `bytesWithUnits()` — no extra work once `content: Buffer` is populated |
| multipart/mixed support | RFC 2046 minimum compliance; body + attachments in one email | MEDIUM | Most common real-world structure; parser must handle recursion to enumerate parts |
| multipart/alternative support | Emails sent with both HTML and plain text fallback; nearly universal | MEDIUM | Pick HTML over plain text; assign accordingly to `bodyHTML` vs `body` |
| Quoted-printable decoding | Most text emails and HTML emails use QP encoding | MEDIUM | Must decode `Content-Transfer-Encoding: quoted-printable` before passing body string; implementable without a library |
| Base64 decoding | All binary attachments; many HTML bodies | LOW | `atob()` / `Uint8Array` — browser-native; no dependency needed |
| Character set handling (UTF-8, ISO-8859-*) | International characters; non-Latin scripts; broken without it | MEDIUM | Decode using `TextDecoder` with the charset from `Content-Type`; browser-native API |
| RFC 2047 encoded-word decoding in headers | Subject lines and sender names containing non-ASCII (e.g. `=?UTF-8?B?...?=`) appear in real-world email constantly | MEDIUM | Affects subject, sender name, attachment filenames; must be decoded before display |
| Unified file picker (.msg + .eml) | Project requirement; users should not see two separate inputs | LOW | Existing `accept` attribute on the file input needs updating from `.msg` to `.msg,.eml` |
| Error display for malformed files | Graceful degradation; users upload corrupt or partial files regularly | LOW | Existing `errorFragment()` component handles this; eml-parser just needs to throw a descriptive error |
| Drag-and-drop file loading | Already exists for .msg; users expect same UX for .eml | LOW | Existing handler; only change needed is MIME-type or extension check for dispatch |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline image rendering (multipart/related + CID) | Emails with embedded logos or signatures look broken without this; Zoho and Encryptomatic support it | HIGH | Requires resolving `cid:` references in HTML body against `multipart/related` image parts; create object URLs for each CID image and swap `src` attributes before rendering; must handle Outlook's non-standard use of `multipart/mixed` for CID images |
| Embedded message support (message/rfc822) | Forwarded emails containing full original messages as attachments; existing .msg viewer already supports this — feature parity expected | HIGH | Parse `message/rfc822` MIME parts recursively, producing a nested `Message` object; existing `embeddedMsgsFragment()` component can render it if the data structure matches |
| Full raw header inspection toggle | Power users (forensic, deliverability, spam analysis) need to see all headers; CoolUtils and emlreader.com offer this | LOW | The EML format carries raw headers verbatim as the preamble; store in `message.content.headers`; existing field already exists in `MessageContent` |
| Offline / client-side only operation | Privacy guarantee: no email data ever leaves the browser; meaningful for legal, medical, enterprise use cases | LOW (architecture decision, not implementation cost) | Project is already client-side-only on Cloudflare Pages; must not introduce any server calls in eml-parser |
| No new heavy dependencies | Smaller bundle = faster load; text-based MIME is parseable without a lib | MEDIUM (discipline cost) | Browser-native: `TextDecoder`, `atob()`, `Blob`, `URL.createObjectURL()` handle all required decoding; avoid `mailparser`, `emailjs-mime-parser`, `eml-parse-js` |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rendering HTML body in an unsandboxed iframe or direct innerHTML | Looks like "just showing the email" | Active XSS vector; email HTML routinely contains `<script>`, event handlers, `javascript:` hrefs, and CSS `expression()` — Roundcube, SuiteCRM have had stored XSS CVEs from exactly this | Sanitize HTML with DOMParser, strip scripts/event handlers/dangerous hrefs before setting innerHTML; or use a sandboxed iframe with `sandbox="allow-same-origin"` and no `allow-scripts` |
| Fetching remote images automatically | Users expect images to show | Leaks IP address to tracking pixels; breaks privacy guarantee of client-side-only tool; can reveal that an email was opened | Render inline CID images (embedded) freely; block `http://`/`https://` `src` attributes in HTML body by default; optionally offer "load remote images" toggle |
| MBOX / PST / NSF format support | Some users ask "can you also open my mailbox file?" | Completely different parsing problem; MBOX requires streaming large files; PST requires compound B-tree format; massively out of scope for a single-file viewer | Clearly state supported formats (.msg, .eml) in UI; scope documents (PROJECT.md) explicitly exclude mbox |
| Email export / conversion (EML to PDF, EML to MSG) | CoolUtils promotes this; seems useful | Adds significant complexity (PDF rendering, format conversion); not the core value; distracts from viewer quality | Keep as a future v2+ consideration; do not implement in the .eml milestone |
| Email compose / reply | Some users want "reply to this email" | Makes it a mail client, not a viewer; requires SMTP integration, auth, server — contradicts client-side-only constraint | Read-only viewer is the explicit product boundary (PROJECT.md: "Email sending or composing — read-only viewer") |
| winmail.dat / TNEF decoding | Outlook-generated TNEF attachments appear as `application/ms-tnef`; users can't open them | TNEF is a proprietary Microsoft binary format requiring a separate parser; adds significant complexity; relevant to .msg users more than .eml users | Out of scope for the .eml milestone; could be considered a future addition alongside .msg improvements |

## Feature Dependencies

```
[Unified file picker (.msg + .eml)]
    └──requires──> [EML format detection (by extension or magic bytes)]
                       └──requires──> [eml-parser module exists]

[HTML body rendering]
    └──requires──> [multipart/alternative support]
    └──requires──> [Base64 + Quoted-Printable decoding]
    └──requires──> [XSS sanitization]

[Inline image rendering (CID)]
    └──requires──> [multipart/related support]
    └──requires──> [HTML body rendering]
    └──requires──> [Base64 decoding for image parts]

[Attachment listing with download]
    └──requires──> [multipart/mixed support]
    └──requires──> [Base64 decoding]

[Embedded message support (message/rfc822)]
    └──requires──> [Recursive MIME part parsing]
    └──requires──> [All table-stakes features above]
    └──enhances──> [Embedded message UI — existing embeddedMsgsFragment() reusable]

[RFC 2047 header decoding]
    └──enhances──> [Header display]
    └──enhances──> [Attachment filename display]

[Character set handling]
    └──enhances──> [Plain text body rendering]
    └──enhances──> [HTML body rendering]
    └──enhances──> [RFC 2047 header decoding]
```

### Dependency Notes

- **HTML body rendering requires XSS sanitization:** These cannot be decoupled. Rendering HTML without sanitizing it first is a security vulnerability, not a feature gap — all existing email viewer CVEs stem from this exact failure.
- **Inline CID images require multipart/related support:** CID references in HTML only resolve if the parser has catalogued image parts from the MIME tree. Cannot implement inline images before the full MIME tree traversal is working.
- **Embedded message/rfc822 requires recursive parsing:** The same MIME parsing logic must be applied to the inner message. This is the highest complexity feature and should be deferred after core parsing is stable.
- **RFC 2047 decoding enhances headers and filenames:** Missing this makes subjects and attachment names show raw encoded strings (`=?UTF-8?B?...?=`) — a significant display bug rather than a missing feature.

## MVP Definition

### Launch With (v1 — EML Milestone)

Minimum viable product for the .eml milestone — full parity with the existing .msg viewer's core capabilities.

- [x] **eml-parser module** — produces a `Message`-compatible object; nothing else works without this
- [x] **multipart/mixed + multipart/alternative parsing** — the two mandatory MIME types per RFC 2046; covers the vast majority of real-world emails
- [x] **Header extraction** (Subject, From, To, CC, Date) — identity of the message; missing this = unusable
- [x] **RFC 2047 encoded-word decoding** — headers with non-ASCII characters render as garbage without this; treat as a parsing correctness issue, not an enhancement
- [x] **Plain text and HTML body extraction** — core message content
- [x] **Quoted-printable and Base64 decoding** — required to get readable content out of virtually all real-world emails
- [x] **Character set handling via TextDecoder** — international email is broken without this
- [x] **XSS sanitization before HTML rendering** — non-negotiable security requirement; must ship with HTML support
- [x] **Attachment extraction and download** — users open email files to get at attachments; this is a primary use case
- [x] **Unified file picker accepting .msg and .eml** — single UI entry point; no mode switching

### Add After Validation (v1.x)

Features to add once core EML parsing is stable and tested against real-world files.

- [ ] **Inline image rendering (CID / multipart/related)** — emails with embedded logos and signatures look broken without it; add once base HTML rendering is confirmed working
- [ ] **Full raw header toggle** — useful for power users; minimal implementation effort once `headers` field is populated
- [ ] **Embedded message/rfc822 support** — forwarded message chains; highest complexity; add after inline images

### Future Consideration (v2+)

Features to defer until the core viewer is stable.

- [ ] **TNEF / winmail.dat decoding** — separate parser problem; affects a small subset of Outlook-generated emails
- [ ] **Export to PDF** — conversion feature, not viewing; significant complexity
- [ ] **Remote image loading toggle** — privacy UX enhancement; low priority for a developer/power-user tool

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| eml-parser module (MIME tree traversal) | HIGH | MEDIUM | P1 |
| multipart/mixed + multipart/alternative | HIGH | MEDIUM | P1 |
| Header extraction (Subject, From, To, CC, Date) | HIGH | LOW | P1 |
| RFC 2047 encoded-word decoding | HIGH | LOW | P1 |
| Quoted-printable + Base64 decoding | HIGH | LOW | P1 |
| Character set handling (TextDecoder) | HIGH | LOW | P1 |
| Plain text body extraction | HIGH | LOW | P1 |
| HTML body extraction + XSS sanitization | HIGH | MEDIUM | P1 |
| Attachment extraction + download | HIGH | LOW | P1 |
| Unified .msg/.eml file picker | HIGH | LOW | P1 |
| Inline image rendering (CID) | MEDIUM | HIGH | P2 |
| Raw header inspection toggle | MEDIUM | LOW | P2 |
| Embedded message/rfc822 recursive rendering | MEDIUM | HIGH | P2 |
| TNEF / winmail.dat decoding | LOW | HIGH | P3 |
| Export to PDF | LOW | HIGH | P3 |
| Remote image loading toggle | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Encryptomatic MessageViewer | CoolUtils Online EML | Zoho EML Viewer | Our Approach |
|---------|----------------------------|-----------------------|-----------------|--------------|
| Headers display | Yes | Yes | Yes | Yes — existing UI component, eml-parser populates same struct |
| HTML body rendering | Yes | Yes | Yes | Yes — with XSS sanitization (competitors vary on this) |
| Attachment download | Yes | Yes | Yes | Yes — existing attachment component, reuse as-is |
| Inline CID images | Yes (EML Viewer Pro) | Unknown | Yes | v1.x after core is stable |
| Embedded message/rfc822 | Yes | Unknown | Unknown | v1.x deferred |
| Raw header view | Unknown | Unknown | Unknown | v1.x — low effort, high value for power users |
| Client-side only | No (server upload) | No (server upload, 24h delete) | No (server upload) | Yes — unique differentiator; privacy-first |
| No install required | Yes (extension) | Yes (web) | Yes (web) | Yes (web) |
| .msg + .eml unified | Yes | EML only | EML only | Yes — existing .msg support, adding .eml |

## MIME Content Types — Required Support Matrix

| MIME Type | Category | Why Needed | Handling |
|-----------|----------|------------|---------|
| `text/plain` | Discrete | RFC baseline; always present as fallback | Extract as `message.content.body` |
| `text/html` | Discrete | Primary body in modern emails | Extract as `message.content.bodyHTML`; sanitize before render |
| `multipart/mixed` | Composite | Body + attachments together; RFC 2046 minimum required | Enumerate parts; route by Content-Disposition and Content-Type |
| `multipart/alternative` | Composite | HTML + plain text alternatives; RFC 2046 minimum required | Prefer `text/html`; fall back to `text/plain` |
| `multipart/related` | Composite | HTML body + inline CID images together | Catalogue image parts by Content-ID; resolve `cid:` in HTML |
| `application/octet-stream` | Discrete | Generic binary attachment | Treat as downloadable attachment |
| `image/*` | Discrete | Inline images (CID) and image attachments | Decode base64; create object URL for display or download |
| `message/rfc822` | Composite | Forwarded/embedded full email messages | Parse recursively as nested Message |
| `application/ms-tnef` | Discrete | Outlook TNEF / winmail.dat | Out of scope for v1; surface as opaque attachment |

**Content-Transfer-Encodings to support:**
- `base64` — binary attachments, many HTML bodies (decode with `atob()` / `Uint8Array`)
- `quoted-printable` — text bodies, especially European-language email (implement QP decoder)
- `7bit` / `8bit` — no decoding needed; pass through
- `binary` — rare; treat as raw bytes

**Header encodings to support:**
- `=?charset?B?base64?=` — RFC 2047 base64-encoded header word
- `=?charset?Q?quoted-printable?=` — RFC 2047 QP-encoded header word

## Sources

- [RFC 2045 — MIME Part One: Format of Internet Message Bodies](https://www.rfc-editor.org/rfc/rfc2045) — Content-Transfer-Encoding, charset parameters
- [RFC 2046 — MIME Part Two: Media Types](https://www.rfc-editor.org/rfc/rfc2046.html) — multipart types; mandatory minimum: mixed + digest
- [RFC 2047 — MIME Part Three: Message Header Extensions](https://datatracker.ietf.org/doc/html/rfc2047) — encoded-word syntax for non-ASCII headers
- [MIME — Wikipedia](https://en.wikipedia.org/wiki/MIME) — multipart subtype summary
- [EML File Format — docs.fileformat.com](https://docs.fileformat.com/email/eml/) — component overview
- [Embedding Images in Email: CID, HTML Inline — Twilio](https://www.twilio.com/en-us/blog/insights/embedding-images-emails-facts) — CID inline image mechanics
- [XSS Filter Evasion — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html) — why HTML sanitization is non-negotiable
- [Cross-site scripting (XSS) — MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS) — browser XSS attack surface
- [ProtonMail jsmimeparser — GitHub](https://github.com/ProtonMail/jsmimeparser) — browser MIME parser reference implementation
- [eml-parse-js — GitHub](https://github.com/MQpeng/eml-parse-js) — alternative browser EML parser
- [Encryptomatic MessageViewer](https://www.encryptomatic.com/viewer/) — competitor feature reference
- [CoolUtils Online EML Viewer](https://www.coolutils.com/online/EMLViewer) — competitor feature reference
- [Zoho EML Viewer](https://www.zoho.com/toolkit/eml-viewer.html) — competitor feature reference

---
*Feature research for: browser-based EML/MIME email file viewer*
*Researched: 2026-04-01*
