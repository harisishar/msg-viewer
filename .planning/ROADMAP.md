# Roadmap: MSG & EML Viewer

## Overview

The existing `.msg` viewer is working and deployed. This milestone adds full `.eml` (RFC 822/MIME) support with feature parity. The work proceeds in four phases determined by dependency order: first establish the shared type contract and migrate the existing parser to it (regression safety), then build the EML parser core with all correctness requirements (the bulk of new code), then wire both parsers into the entry point (integration), then deliver the remaining advanced rendering features (attachments, inline images, embedded messages, raw headers) that depend on a stable core.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Unified Interface Foundation** - Define the shared UnifiedMessage type contract and migrate the existing MSG parser and all UI components to it
- [ ] **Phase 2: EML Parser Core** - Build the complete EML parser with all correctness requirements: headers, body, encoding, charset, and XSS sanitization
- [ ] **Phase 3: Entry Point Integration** - Wire both parsers into the application with format detection, unified file picker, and drag-and-drop support
- [ ] **Phase 4: Enhanced Features** - Deliver attachments, inline CID images, embedded message rendering, and raw header inspection

## Phase Details

### Phase 1: Unified Interface Foundation
**Goal**: The existing .msg viewer continues to work end-to-end through a new UnifiedMessage type that both parsers will share
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, UI-02
**Success Criteria** (what must be TRUE):
  1. A UnifiedMessage interface exists that neither leaks OLE2/MSG-specific types nor requires format-specific branches in UI components
  2. The existing MSG parser produces UnifiedMessage output and all current .msg test files render identically to before
  3. All UI components (headers, body, recipients) consume UnifiedMessage without format-specific conditionals
  4. The shared rendering pipeline produces identical output for a .msg file before and after the migration
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Define UnifiedMessage interface and migrate MSG parser to produce it
- [x] 01-02-PLAN.md — Update all UI components and entry point to consume UnifiedMessage
- [x] 01-03-PLAN.md — End-to-end build verification and human rendering check

### Phase 2: EML Parser Core
**Goal**: A complete parseEml() function that handles all real-world MIME structures correctly and safely
**Depends on**: Phase 1
**Requirements**: EML-01, EML-02, EML-03, EML-04, EML-05, EML-06, EML-07, EML-08, EML-09, EML-10, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. User can open a standard .eml file and see Subject, From, To, CC, and Date displayed correctly — including non-ASCII values (RFC 2047 encoded-words decoded, not shown as raw =?UTF-8?B?...?=)
  2. User sees the HTML body rendered from text/html parts, with no script execution, no event handlers, and no dangerous hrefs — DOMPurify sanitization is active
  3. User sees plain text body rendered correctly when no HTML part is present, and HTML is preferred over plain text when both exist in a multipart/alternative structure
  4. User sees correct body content from emails with multipart/mixed and multipart/alternative structures, including correctly decoded quoted-printable and base64 content
  5. Remote images in HTML body are blocked by default and international characters display correctly via charset decoding
**Plans**: TBD

Plans:
- [ ] 02-01: Install postal-mime, define eml-parser module structure, implement CRLF normalization and header extraction with RFC 2047 decoding
- [ ] 02-02: Implement body parsing — recursive multipart traversal, charset decoding, QP/base64 decoding, multipart/alternative selection
- [ ] 02-03: Integrate DOMPurify for HTML body sanitization and implement remote image blocking

### Phase 3: Entry Point Integration
**Goal**: Users can load both .msg and .eml files through one unified file picker and drag-and-drop interface
**Depends on**: Phase 2
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a .eml file onto the existing drop zone and see it rendered — the drop zone accepts both .msg and .eml files
  2. User can use the file picker to select either a .msg or a .eml file from a single input that accepts both formats
  3. Dropping an unsupported file type shows a clear error message rather than silently failing
**Plans**: TBD

Plans:
- [ ] 03-01: Add format detection to index.ts, update file picker accept attribute, update drag-and-drop handler, wire parseEml into dispatch

### Phase 4: Enhanced Features
**Goal**: Users get the full attachment and advanced rendering experience for .eml files: download attachments, see inline images, navigate embedded messages, inspect raw headers
**Depends on**: Phase 3
**Requirements**: ATT-01, ATT-02, ATT-03, ADV-01, ADV-02
**Success Criteria** (what must be TRUE):
  1. User sees a list of attachments from a .eml file with correct filenames and sizes, and can download each attachment individually
  2. User sees inline images rendered inside the HTML body (CID references resolved to object URLs before DOMPurify sanitization)
  3. User can recursively view embedded message/rfc822 parts (forwarded email chains) using the existing embedded message UI
  4. User can toggle a "raw headers" view to see the complete original headers from a .eml file
**Plans**: TBD

Plans:
- [ ] 04-01: Implement attachment listing and download for .eml (ATT-01, ATT-02)
- [ ] 04-02: Implement inline CID image resolution for multipart/related (ATT-03)
- [ ] 04-03: Implement recursive message/rfc822 rendering and raw header toggle (ADV-01, ADV-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Unified Interface Foundation | 3/3 | Complete | 2026-04-01 |
| 2. EML Parser Core | 0/3 | Not started | - |
| 3. Entry Point Integration | 0/1 | Not started | - |
| 4. Enhanced Features | 0/3 | Not started | - |
