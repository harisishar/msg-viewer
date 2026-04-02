# Requirements: MSG & EML Viewer

**Defined:** 2026-04-01
**Core Value:** Users can open and read any .msg or .eml email file in their browser with full fidelity — headers, body, attachments, and nested messages — without installing Outlook or any desktop software.

## v1 Requirements

### Unified Interface

- [ ] **UI-01**: User can select or drag-and-drop both .msg and .eml files in a single file picker
- [ ] **UI-02**: User sees identical rendering regardless of whether the source file was .msg or .eml

### EML Parser Core

- [ ] **EML-01**: User can open a standard .eml file and see the parsed message content
- [ ] **EML-02**: User sees correct Subject, From, To, CC, and Date headers extracted from .eml
- [ ] **EML-03**: User sees non-ASCII header values decoded correctly (RFC 2047 encoded-words)
- [ ] **EML-04**: User sees plain text body rendered from text/plain MIME part
- [ ] **EML-05**: User sees HTML body rendered from text/html MIME part (with XSS sanitization)
- [ ] **EML-06**: User sees correct body when email has multipart/alternative (HTML preferred, plain text fallback)
- [ ] **EML-07**: User sees correct body and attachments when email has multipart/mixed structure
- [ ] **EML-08**: User sees correct international characters via charset decoding (UTF-8, ISO-8859-*, etc.)
- [ ] **EML-09**: User sees correct content decoded from quoted-printable transfer encoding
- [ ] **EML-10**: User sees correct content decoded from base64 transfer encoding

### Attachments

- [ ] **ATT-01**: User can see list of attachments with filenames and sizes from .eml files
- [ ] **ATT-02**: User can download individual attachments from .eml files
- [ ] **ATT-03**: User sees inline CID images rendered in HTML body (multipart/related with cid: references)

### Advanced Rendering

- [ ] **ADV-01**: User can view embedded message/rfc822 parts (forwarded emails) with recursive rendering
- [ ] **ADV-02**: User can toggle to view full raw email headers

### Security

- [ ] **SEC-01**: HTML body content is sanitized before rendering (no script execution, no event handlers, no dangerous hrefs)
- [ ] **SEC-02**: Remote images in HTML body are blocked by default (privacy protection)

### Architecture

- [ ] **ARCH-01**: EML parser is a separate module alongside msg-parser following the same structural pattern
- [ ] **ARCH-02**: Both parsers produce a unified message interface consumed by shared UI components

## v2 Requirements

### Format Support

- **FMT-01**: User can open TNEF/winmail.dat attachments
- **FMT-02**: User can export viewed email to PDF

### UX Enhancements

- **UX-01**: User can toggle remote image loading with a UI control
- **UX-02**: User sees format indicator showing whether loaded file was .msg or .eml

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email compose / reply / send | Read-only viewer; SMTP requires server-side — contradicts client-side-only constraint |
| MBOX / PST / NSF archive support | Completely different parsing problem; out of scope for single-file viewer |
| Server-side processing | App remains fully client-side; no email data leaves the browser |
| Mobile native app | Web-only; responsive web is sufficient |
| Calendar (.ics) / contact (.vcf) viewing | Different file formats outside email viewing scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 1 | Pending |
| EML-01 | Phase 2 | Pending |
| EML-02 | Phase 2 | Pending |
| EML-03 | Phase 2 | Pending |
| EML-04 | Phase 2 | Pending |
| EML-05 | Phase 2 | Pending |
| EML-06 | Phase 2 | Pending |
| EML-07 | Phase 2 | Pending |
| EML-08 | Phase 2 | Pending |
| EML-09 | Phase 2 | Pending |
| EML-10 | Phase 2 | Pending |
| ATT-01 | Phase 4 | Pending |
| ATT-02 | Phase 4 | Pending |
| ATT-03 | Phase 4 | Pending |
| ADV-01 | Phase 4 | Pending |
| ADV-02 | Phase 4 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
