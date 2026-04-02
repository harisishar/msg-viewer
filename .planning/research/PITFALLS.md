# Pitfalls Research

**Domain:** Browser-based EML/MIME email file parsing (adding .eml support to existing .msg viewer)
**Researched:** 2026-04-01
**Confidence:** HIGH (critical pitfalls verified across RFC specifications, Mozilla Bugzilla post-mortems, and library source analysis)

---

## Critical Pitfalls

### Pitfall 1: Treating CRLF and LF as Interchangeable

**What goes wrong:**
The MIME boundary delimiter must be preceded by a CRLF (`\r\n`) sequence per RFC 2046. Parsers that split only on `\n` will either miss boundaries entirely (treating the whole message as one part) or produce boundary lines with a dangling `\r` prepended to the first line of each part's content. Real-world `.eml` files come from multiple OS contexts — files saved on Linux may use bare LF, Windows clients produce CRLF, and mixed files exist. A parser that is strict about one convention will silently fail on the other.

**Why it happens:**
JavaScript's `String.split('\n')` is the path of least resistance. Developers test against one real-world file and ship. The breakage only appears with `.eml` files exported from a different OS or client than the one used during testing.

**How to avoid:**
Normalize line endings to `\n` at the top of the parse function (replace all `\r\n` with `\n`) before any splitting or boundary detection logic. Do this once on the raw string, not per-section. This is the approach taken by PostalMime and mailparser.

**Warning signs:**
- Body content starts with a literal `\r` character
- Boundary not found despite visually correct file
- Attachments show as zero bytes or as a single raw blob of the entire message body
- Test only with `.eml` files exported from one specific client

**Phase to address:** EML Parser foundation (first implementation phase)

---

### Pitfall 2: Misreading the Multipart Structure Hierarchy

**What goes wrong:**
Real-world emails routinely violate the expected nesting. The correct pattern for an email with both HTML and attachments is `multipart/mixed` containing `multipart/alternative` (for text/plain + text/html) plus attachment parts. Outlook and many other clients invert this or use `multipart/related` to wrap inline images, producing structures like `multipart/mixed > multipart/related > multipart/alternative`. A parser that assumes a flat two-level structure will either fail to find the HTML body or will surface inline images as standalone attachments and suppress the body entirely.

Confirmed real-world bugs in Thunderbird (Bugzilla #505172, #76323, #667019) demonstrate this has tripped up mature email clients for years.

**Why it happens:**
Developers test with emails they generate themselves (which follow the spec). Production traffic comes from Outlook, Exchange, Apple Mail, and mobile clients that produce non-spec-compliant or at least non-obvious nesting.

**How to avoid:**
Parse the MIME tree recursively without assuming depth. For body selection, prefer HTML over plain text found at any depth of `multipart/alternative`. Surface as attachments any part with `Content-Disposition: attachment` regardless of nesting level. Do not skip parts inside `multipart/related` — they may contain the message body (treat unreferenced parts in `multipart/related` as attachments).

**Warning signs:**
- Message body renders blank for some `.eml` files but not others
- Inline images appear as attachments for Outlook-exported emails
- Parser works on self-generated test files but fails on exported production emails

**Phase to address:** EML Parser — multipart traversal logic

---

### Pitfall 3: Charset Encoding Assumptions Causing Garbled Body Text

**What goes wrong:**
When a MIME part's `Content-Type` specifies no `charset` parameter, RFC 2045 mandates defaulting to US-ASCII. In practice, email clients routinely omit charset declarations and send ISO-8859-1, Windows-1252, or even UTF-8 body content without declaring it. A parser that faithfully follows the spec and uses `TextDecoder('us-ascii')` will produce garbage for any non-ASCII character. Conversely, a parser that always assumes UTF-8 will produce garbled mojibake for legitimate ISO-8859-1 content.

The browser's `TextDecoder` supports the full range of legacy encodings (ISO-8859-1 through ISO-8859-16, Windows-1252, UTF-16, etc.) but throws a `RangeError` for unknown label strings, so label normalization is required before calling it.

**Why it happens:**
Developers default to UTF-8 everywhere since it works for their own test emails. Legacy corporate emails from the 1990s–2000s, and emails from non-English locales, commonly use Windows-1252 or ISO-8859-* without declaring it.

**How to avoid:**
1. Read the `charset` parameter from `Content-Type` if present.
2. Normalize the label before passing to `TextDecoder` (e.g., `iso-8859-1` maps to the same decoder as `latin1` and `windows-1252` per the WHATWG Encoding Standard — browsers treat them identically as required by HTML5).
3. If charset is absent, default to `windows-1252` (not US-ASCII and not UTF-8) — this is the HTML5 legacy default that matches real-world email client behavior.
4. Wrap `new TextDecoder(charset)` in a try-catch and fall back to `utf-8` on `RangeError` for unrecognized charset labels.

**Warning signs:**
- Non-English characters display as `?` or `â€™` style mojibake
- Plain text emails from older corporate systems render as garbage
- Works correctly with test emails composed in the developer's own client

**Phase to address:** EML Parser — body decoding layer

---

### Pitfall 4: Not Decoding RFC 2047 Encoded-Words in Headers

**What goes wrong:**
Non-ASCII characters in email headers (Subject, From display name, CC display names) are encoded as RFC 2047 encoded-words: `=?charset?encoding?encoded_text?=` (e.g., `=?UTF-8?B?SGVsbG8gV29ybGQ=?=`). A parser that reads headers as raw strings will display `=?UTF-8?B?SGVsbG8gV29ybGQ=?=` in the Subject field instead of `Hello World`. This is a highly visible regression — the subject line is the first thing users see.

The encoded-word can use either Base64 (`B`) or Quoted-Printable (`Q`) encoding. Multi-line headers fold the encoded-word across lines with whitespace, and the whitespace between adjacent encoded-words must be discarded (RFC 2047 §6.2).

**Why it happens:**
Developers test with ASCII-only email subjects. The edge case only surfaces with emails from non-English locales, or any email with special characters in the sender display name.

**How to avoid:**
After extracting each header value, apply a decode pass: find all `=?...?...?...?=` sequences, decode the inner content using the specified charset and transfer encoding, then splice the result back in. Adjacent encoded-words separated only by whitespace must be concatenated without the whitespace. This is a mandatory step, not optional polish.

**Warning signs:**
- Subject line shows `=?` prefix in the rendered UI
- Sender name shows encoded garbage instead of a human name
- Only affects emails with non-ASCII characters in headers

**Phase to address:** EML Parser — header parsing

---

### Pitfall 5: Incomplete Base64 Decoding for Attachments

**What goes wrong:**
Base64-encoded MIME parts require exact 4-byte boundary alignment. Real email clients sometimes produce base64 content with trailing whitespace on lines, inconsistent line lengths (some use 76 chars, some 64, some no line breaks at all), or a missing `=` padding character on the final block. JavaScript's `atob()` will throw on any of these. A custom decoder that strips whitespace before decoding but still expects perfect padding will produce truncated or corrupted attachment data.

**Why it happens:**
`atob()` is the obvious browser-native solution, but it is stricter than the MIME spec. `atob()` rejects whitespace, so raw base64 lines joined with `\n` will fail. Developers who add whitespace stripping fix 90% of cases but still hit malformed or unpadded real-world emails.

**How to avoid:**
Strip all whitespace (spaces, tabs, `\r`, `\n`) from the base64 string before decoding. Use a lenient base64 decoder that handles missing padding by computing the correct padding from `(4 - (input.length % 4)) % 4`. Do not rely on `atob()` directly for MIME part decoding — wrap it or use a library that handles these cases.

**Warning signs:**
- Specific attachments fail to download / appear as zero-byte files
- `atob` throws `InvalidCharacterError` in the console for certain emails
- Works for attachments from one email client, fails for another

**Phase to address:** EML Parser — attachment decoding

---

### Pitfall 6: HTML Body Rendered Unsanitized

**What goes wrong:**
EML files contain the full HTML email body, including `<script>`, `<style>`, `<iframe>`, `<object>`, inline event handlers, and `javascript:` URLs, as sent by the original author. Injecting this HTML directly into `innerHTML` of the viewer's DOM allows arbitrary JavaScript execution from any `.eml` file a user opens. Malicious actors can craft `.eml` files that exfiltrate clipboard contents, localStorage data, or other page state when viewed.

This project already has an existing vulnerability: CONCERNS.md documents unescaped `senderName` in HTML string assembly in `lib/components/message/index.ts`. The same class of mistake will propagate to the EML renderer unless explicitly prevented from the start.

**Why it happens:**
The `.msg` path produces display-ready HTML from a structured binary — developers trust the output. The `.eml` path hands the parser raw HTML from the email body directly, making it visually identical to write `innerHTML = emlBody` but categorically different in risk.

**How to avoid:**
Always sanitize HTML email bodies before rendering. Use `DOMPurify.sanitize()` with a strict allowlist: permit formatting tags (`b`, `i`, `p`, `table`, `img` with `src` filtered to `https://` only) and strip all event handlers, `<script>`, `<style>`, `<iframe>`, `<object>`, `<form>`. The existing `.msg` rendering pipeline should also be audited for the same issue. Use `document.createElement()` for header fields (subject, from, to) — never string template assembly.

**Warning signs:**
- Email body inserted via `innerHTML` without a sanitization call
- Sender/recipient names assembled into HTML template strings without escaping
- Any use of `document.write()` or unescaped `innerHTML`

**Phase to address:** EML Parser — body rendering (must be addressed before any real-world testing)

---

### Pitfall 7: message/rfc822 Parts Not Handled Recursively

**What goes wrong:**
Forwarded emails, and emails exported from some clients, contain embedded email messages as `message/rfc822` MIME parts. These parts are fully formed EML messages — they have their own headers, their own MIME structure, and potentially their own nested attachments. A parser that only looks for `Content-Disposition: attachment` to identify attachments will surface these as a raw blob (or not at all), rather than as a navigable nested message. The existing `.msg` viewer already handles nested messages via recursive `parseDir`. The `.eml` parser must provide the same capability.

**Why it happens:**
`message/rfc822` is a rarely tested case. Developers test with simple forward-as-inline emails rather than forward-as-attachment. The Mozilla Bugzilla tracker has a meta-bug (#269826) documenting years of intermittent `message/rfc822` breakage across Thunderbird versions.

**How to avoid:**
When traversing MIME parts, detect `Content-Type: message/rfc822` explicitly. Do not treat it as a generic attachment blob. Instead, parse the part body as a complete EML message (recursive call to the same EML parser). Surface the result as a nested `Message` object using the same type the `.msg` parser produces — the existing `Message` type must accommodate this.

**Warning signs:**
- Forwarded emails appear as `.eml` attachment downloads rather than navigable nested messages
- Embedded email content is base64-encoded and not decoded when saved
- Nested message attachments are invisible (not surfaced at any level)

**Phase to address:** EML Parser — recursive message handling

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `atob()` directly on MIME base64 parts | No dependency, obvious approach | Throws on whitespace/missing padding; breaks for 10–20% of real emails | Never — always strip whitespace and pad first |
| Defaulting to UTF-8 for all text parts | Works for most modern emails | Garbled output for any ISO-8859 or Windows-1252 encoded email body | Never for the decoding layer; always read charset from header |
| Flat multipart iteration (non-recursive) | Simple first pass | Misses nested `multipart/alternative` inside `multipart/mixed`; body blank for Outlook emails | Never — recursion is required from day one |
| Skipping RFC 2047 header decoding | Headers always present | Subject/sender display garbage for any non-ASCII name or subject | Never — it is immediately visible to users |
| Rendering HTML body via raw `innerHTML` | One line of code | XSS from any crafted `.eml` file | Never — DOMPurify is a mandatory dep |
| Reusing `.msg` error-throw pattern for `.eml` parse failures | Code consistency | Single bad part kills entire parse; partial recovery is better for MIME emails | Never for partial-parse scenarios — wrap each part separately |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Shared `Message` type with `.msg` parser | Extending `Message` to accommodate EML-specific fields | Keep `Message` interface identical — EML parser is responsible for mapping to it, not the other way |
| File picker accepting `.eml` | Filtering only on file extension at the input level | Also check `file.type` (`message/rfc822`) as fallback; some OS expose `.eml` as `application/octet-stream` |
| DOMPurify for HTML sanitization | Importing DOMPurify as a bundled dependency | DOMPurify is browser-native — it requires the `document` API, which is available; confirm build pipeline doesn't tree-shake it or run it in a worker context |
| `TextDecoder` for charset handling | Passing raw `Content-Type` charset value directly | Normalize first: trim whitespace, lowercase, strip quotes; `TextDecoder` label must match the WHATWG Encoding Standard label list exactly |
| Drag-and-drop handler in `index.ts` | Current handler guards on `.msg` extension only (line 26) | Add `.eml` to the extension check — otherwise drag-and-drop silently ignores `.eml` files |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire `.eml` file as a UTF-16 JS string | Memory doubles (UTF-16 internal, plus decoded byte array) | Read file as `ArrayBuffer`, decode only text parts; keep binary parts as `Uint8Array` | Files over ~50MB |
| Decoding all attachments eagerly at parse time | Slow parse for emails with many large attachments | Decode attachment bytes lazily — only when user clicks download | Single email with 10+ attachments or any attachment >5MB |
| Running DOMPurify on the full concatenated HTML email body as a string | Correct but slow for long newsletters | Run DOMPurify once on the final output fragment, not on intermediate pieces | Emails with 100KB+ HTML bodies (common for newsletters) |
| Recursive `message/rfc822` parsing with no depth limit | Stack overflow on pathologically nested forwarded emails | Cap recursion at depth 10 — same discipline as the `.msg` parser | Any adversarially crafted file |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering HTML body with `innerHTML` without sanitization | XSS — arbitrary JS from crafted `.eml` | DOMPurify with strict allowlist before any `innerHTML` assignment |
| Assembling header fields (Subject, From, To) into HTML template strings | Stored XSS via crafted sender name or subject | Use `textContent` or `document.createTextNode()` for all header fields |
| No recursion depth limit for nested `message/rfc822` parts | Stack overflow / DoS from crafted `.eml` | Enforce max depth (10 levels); throw a recoverable error beyond that |
| Allowing `data:` or `javascript:` URIs in email HTML `src` / `href` attributes | Phishing / JS execution via inline images | DOMPurify strips these by default; do not override `ALLOW_DATA_ATTR` |
| No limit on number of MIME parts iterated | DoS via email with thousands of empty parts | Cap part iteration at 1000; log a warning and return partial result |
| Exposing raw parse error messages in the UI | Internal path / library version leakage | Catch errors and show a generic user message; log details to console only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing no body when only `text/plain` is present (parser preferring HTML only) | Blank message for plain-text emails | Always fall back: render HTML if present, otherwise plain text (preserve line breaks with `white-space: pre-wrap`) |
| Displaying encoded-word subjects literally | First line of UI shows `=?UTF-8?B?...?=` — looks broken | Decode RFC 2047 before display (see Pitfall 4) |
| Surfacing `message/rfc822` as a download-only attachment | User cannot read the forwarded email without downloading and re-opening | Render nested messages inline with the same viewer, matching the existing `.msg` recursive navigation |
| Showing attachment filename as empty or as a hex UUID | Users cannot identify attachments | Fall back: `Content-Type` `name` parameter → `Content-Disposition` `filename` → `filename*` (RFC 5987) → generated name from MIME type (e.g., `image.png`) |
| No loading state for large `.eml` files | UI appears frozen for 2–4 seconds on files >10MB | Wrap parsing in a `setTimeout(0)` or `requestIdleCallback` call; show spinner |
| File input only accepts `.msg` (current `index.html`) | Users cannot select `.eml` files from the file picker | Update `accept` attribute to include `.eml,message/rfc822` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Header display:** RFC 2047 encoded-words decoded in Subject, From, and all recipient names — verify with a non-ASCII subject line from a real email
- [ ] **Body content:** Falls back to plain text when no HTML part present — verify with a plain-text-only `.eml`
- [ ] **Attachments:** Filenames decoded from RFC 2047 / RFC 5987 encoded names — verify with a Japanese or accented filename
- [ ] **Nested messages:** `message/rfc822` parts rendered as navigable messages, not as binary download blobs — verify with a forwarded `.eml`
- [ ] **Drag-and-drop:** `.eml` files accepted (current code line 26 rejects non-`.msg` files silently) — verify by dragging an `.eml` file
- [ ] **File picker:** `accept` attribute updated to include `.eml` — verify the open dialog shows `.eml` files
- [ ] **HTML sanitization:** DOMPurify applied before rendering — verify by opening a crafted `.eml` with `<script>alert(1)</script>` in the body
- [ ] **Charset handling:** Non-UTF-8 emails render correctly — verify with a Windows-1252 encoded `.eml` containing accented characters
- [ ] **CRLF normalization:** Files from different OS sources parse identically — verify with both CRLF and LF variants of the same file

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CRLF not normalized — boundary detection fails | LOW | Add one-line normalization at parse entry point; retest |
| Flat iteration — nested bodies missing | MEDIUM | Refactor to recursive traversal; existing flat code becomes the base case |
| Charset not decoded — garbled bodies | LOW | Add charset extraction + `TextDecoder` call in body decode function |
| RFC 2047 headers not decoded — garbled subjects | LOW | Add encoded-word decode pass in header extraction function |
| Base64 decode failures | LOW | Replace `atob()` with whitespace-stripping wrapper; add padding normalization |
| HTML not sanitized — XSS shipped | HIGH | Add DOMPurify as dependency; wrap all `innerHTML` body assignments; audit existing `.msg` renderer for same issue |
| `message/rfc822` not parsed recursively | MEDIUM | Add content-type check in part handler; wire recursive call; requires `Message` type to support nested messages |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CRLF/LF handling | EML parser foundation — first commit | Parse same email saved on Windows vs. Linux; bodies identical |
| Multipart hierarchy recursion | EML parser — multipart traversal | Open Outlook-exported `.eml` with inline image; body renders, image in attachments |
| Charset decoding | EML parser — body decoding | Open Windows-1252 `.eml`; accented characters correct |
| RFC 2047 headers | EML parser — header parsing | Open email with Japanese subject; subject shows decoded characters |
| Base64 attachment decoding | EML parser — attachment handling | Download attachment; file opens correctly in native app |
| HTML sanitization | EML parser — body rendering (before any real testing) | Craft `<script>alert(1)</script>` body; no alert fires |
| Recursive message/rfc822 | EML parser — nested message support | Open forwarded email; inner message navigable via same viewer |
| Drag-and-drop `.eml` support | Entry point / file handling update | Drag `.eml` onto page; parses correctly |
| File picker `.eml` support | Entry point / file handling update | Open dialog shows `.eml` files |

---

## Sources

- [RFC 2046 — MIME Part Two: Media Types (multipart boundaries, nesting)](https://www.rfc-editor.org/rfc/rfc2046.html)
- [RFC 2047 — MIME Part Three: Header Extensions for Non-ASCII Text](https://www.rfc-editor.org/rfc/rfc2047)
- [RFC 2045 — MIME Part One: Format of Internet Message Bodies (charset defaults)](https://www.rfc-editor.org/rfc/rfc2045)
- [WHATWG Encoding Standard — TextDecoder label normalization](https://encoding.spec.whatwg.org/)
- [MDN TextDecoder API](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder)
- [Mozilla Bugzilla #505172 — multipart/alternative in multipart/related parsing](https://bugzilla.mozilla.org/show_bug.cgi?id=505172)
- [Mozilla Bugzilla #76323 — multipart/related attachments don't show up](https://bugzilla.mozilla.org/show_bug.cgi?id=76323)
- [Mozilla Bugzilla #269826 — Meta: message/rfc822 attachment problems](https://bugzilla.mozilla.org/show_bug.cgi?id=269826)
- [Mozilla Bugzilla #87653 — boundary not found when Content-Type header is folded](https://bugzilla.mozilla.org/show_bug.cgi?id=87653)
- [Mozilla Bugzilla #463129 — improperly base64 encoded forwarded mail due to missing CRLF](https://bugzilla.mozilla.org/show_bug.cgi?id=463129)
- [Mozilla Bugzilla #493544 — invalid decoding of multiline UTF-8 subject (RFC 2047)](https://bugzilla.mozilla.org/show_bug.cgi?id=493544)
- [jordan-wright/email issue #106 — fails to parse if lines terminated with CRLF](https://github.com/jordan-wright/email/issues/106)
- [zbateson/mail-mime-parser issue #133 — undeclared encoding detection](https://github.com/zbateson/mail-mime-parser/issues/133)
- [mailgen GHSA-xw6r-chmh-vpmj — HTML injection in plaintext emails](https://github.com/eladnava/mailgen/security/advisories/GHSA-xw6r-chmh-vpmj)
- [greenbytes.de Content-Disposition test cases (RFC 2231/5987 filename encoding)](http://test.greenbytes.de/tech/tc2231/)
- [PostalMime — browser-native EML parser (reference implementation)](https://postal-mime.postalsys.com/)
- [ProtonMail jsmimeparser — MIME parser for browser environments](https://github.com/ProtonMail/jsmimeparser)

---

*Pitfalls research for: browser-based EML/MIME email parsing*
*Researched: 2026-04-01*
