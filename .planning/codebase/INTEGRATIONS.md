# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Analytics:**
- Google Analytics (Google Tag Manager) - Usage and error tracking
  - SDK/Client: gtag.js (injected globally)
  - Tag ID: G-G1KRSXZNWZ
  - Usage: Error event tracking on .msg parsing failures
    - Example: `window.gtag('event', 'exception', { 'description': e, 'fatal': true })`
  - Location: `lib/index.html` (script tag + gtag initialization)
  - Location: `lib/scripts/index.ts` (error reporting calls)

**External Libraries:**
- @molotochok/msg-viewer 1.0.3 - NPM package containing core MSG parsing logic
  - No external API calls - pure client-side parsing
  - Accessed via: `import { parse, parseDir } from "@molotochok/msg-viewer"`

## Data Storage

**Databases:**
- Not used - Application is stateless, client-side only

**File Storage:**
- Local filesystem only - Files are loaded via HTML file input (`<input type="file" id="file">`)
- No server upload or cloud storage integration
- All file processing happens in-memory in the browser

**Caching:**
- Browser local storage - Not actively used in codebase
- HTTP caching - Handled by Cloudflare Pages default caching

**Session/State:**
- Browser memory only - No persistent session storage
- DOM manipulation for state representation

## Authentication & Identity

**Auth Provider:**
- None - Application is public, no user authentication required
- All files processed client-side without authentication

## Monitoring & Observability

**Error Tracking:**
- Google Analytics - Exception events tracked on parse errors
  - Location: `lib/scripts/index.ts` line 58

**Logs:**
- Browser console - Development-only logging via `console` object
- Google Analytics - Production error visibility
- No backend logging or log aggregation service

**Metrics:**
- Google Analytics page views and custom events only

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages - Production and preview environments
  - Production branch: `main`
  - Preview branch: `dev`

**CI Pipeline:**
- Not detected - No explicit CI configuration file present
- Assumed automatic deployment from git branches

**Build Process:**
- Triggered manually via: `bun build.ts`
- Output: Single bundled HTML file in `build/` directory

## Environment Configuration

**Required env vars:**
- None - Application is fully client-side with no environment variables

**Secrets location:**
- No secrets stored - All integrations are public (Google Analytics tracking ID)
- No API keys or credentials in code

## Webhooks & Callbacks

**Incoming:**
- None - Application is client-side only

**Outgoing:**
- Google Analytics events - Exception tracking only (read-only data, no sensitive info)
- No webhook integrations

## External Resources

**Static Resources:**
- favicon.ico - Served from `lib/resources/`
- Google site verification file - `lib/resources/google331b65fa04565532.html`
- CSS stylesheets - `lib/resources/styles/styles.css`

## Security Notes

**Data Privacy:**
- No data transmission - All .msg file parsing happens client-side
- No file upload to external servers
- Analytics tracking: Only errors and page views (no file content)

**Compliance:**
- GDPR compliant - No personal data collection from files
- No server-side processing or storage
- Users maintain complete control of their files

---

*Integration audit: 2026-04-01*
