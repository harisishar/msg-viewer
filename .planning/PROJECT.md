# MSG & EML Viewer

## What This Is

A browser-based email file viewer that parses and renders Outlook `.msg` files and standard `.eml` (RFC 822/MIME) files. Users drag-and-drop or select an email file, and the app displays headers, body content, attachments, and embedded messages — all client-side with no server.

## Core Value

Users can open and read any `.msg` or `.eml` email file in their browser with full fidelity — headers, body, attachments, and nested messages — without installing Outlook or any desktop software.

## Requirements

### Validated

- ✓ Parse .msg files (OLE2 Compound File format) — existing
- ✓ Display message headers (subject, sender, date) — existing
- ✓ Display recipients (To/CC) — existing
- ✓ Display message body (HTML/RTF/plain text) — existing
- ✓ Display and download attachments — existing
- ✓ Handle embedded/nested messages recursively — existing
- ✓ Drag-and-drop file upload — existing
- ✓ Client-side only, no server required — existing
- ✓ Deployed on Cloudflare Pages — existing

### Active

- [ ] Parse .eml files (RFC 822/MIME format) with full parity to .msg support
- [ ] Extract headers from .eml (subject, from, to, cc, date)
- [ ] Extract body content from .eml (HTML, plain text, multipart)
- [ ] Extract attachments from .eml (MIME parts with Content-Disposition: attachment)
- [ ] Handle embedded messages in .eml (message/rfc822 MIME parts)
- [ ] Unified file picker accepting both .msg and .eml
- [ ] Same rendering pipeline for both formats (shared UI components)

### Out of Scope

- Server-side processing — app remains fully client-side
- Email sending or composing — read-only viewer
- .mbox or other archive formats — only .msg and .eml
- Calendar (.ics) or contact (.vcf) file viewing
- Mobile-native app — web-only

## Context

- Existing codebase has a well-structured layered architecture: compound file parser → message parser → UI components
- The `@molotochok/msg-viewer` library handles .msg parsing and is published to npm
- .eml files are text-based (RFC 822 + MIME), fundamentally different from .msg's binary OLE2 format
- A new `eml-parser` module should follow the same pattern as `msg-parser` — separate parser producing the same `Message`-compatible output
- UI components already render from a message data structure; the .eml parser just needs to produce compatible output
- Built with TypeScript, Bun for bundling, deployed to Cloudflare Pages

## Constraints

- **Runtime**: Browser-only, no Node.js APIs — .eml parser must work with browser-native APIs
- **Architecture**: New eml-parser as separate module alongside msg-parser, same structural pattern
- **UI**: Single interface, no visual distinction between formats — user doesn't need to know which format they loaded
- **Dependencies**: Prefer minimal/no new dependencies for .eml parsing (MIME is text-based, parseable without heavy libs)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate eml-parser module | Mirrors msg-parser structure, keeps concerns isolated | — Pending |
| Same Message interface for both formats | Allows shared UI rendering pipeline | — Pending |
| No new heavy dependencies for .eml | MIME/RFC822 is text-based, can be parsed with built-in APIs | — Pending |

---
*Last updated: 2026-04-01 after initialization*
