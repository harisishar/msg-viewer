# Phase 3: Entry Point Integration - Research

**Researched:** 2026-04-01
**Domain:** TypeScript browser entry point — async dispatch, FileList API, drag-and-drop
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Detect format by file extension (`.msg` vs `.eml`) — no content/magic-byte inspection
- Update `accept` attribute from `.msg` to `.msg,.eml` in `lib/index.html`
- Single file picker — no separate inputs or mode switching
- Update the `.msg` extension guard at `lib/scripts/index.ts` line 25 to accept both extensions
- Unsupported file types show error rather than silently ignoring
- `parseEml` is async (returns `Promise<UnifiedMessage>`), `parse` (MSG) is sync — `updateMessage` must handle both
- Make `renderMessage`'s `getMessage` parameter accept async: `getMessage: () => UnifiedMessage | Promise<UnifiedMessage>`
- Or make `updateMessage` async and await `parseEml` before calling `renderMessage`
- Update error text from ".msg file" to "email file" (generic, covers both formats)
- Unsupported format error: "Unsupported file format. Please select a .msg or .eml file."

### Claude's Discretion
- Exact async/await pattern for handling the sync MSG parser vs async EML parser
- Whether to extract format detection into a utility function or keep inline
- How to handle edge cases (no extension, double extensions)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | User can select or drag-and-drop both .msg and .eml files in a single file picker | Covered: `accept` attribute change, drop handler extension guard, async dispatch pattern |
</phase_requirements>

---

## Summary

Phase 3 is a narrow wiring phase touching exactly two files: `lib/scripts/index.ts` and `lib/index.html`. The HTML change is a one-attribute edit. The TypeScript change has one meaningful design decision: how to reconcile a sync MSG parser with an async EML parser inside the existing `renderMessage` / `updateMessage` call chain.

The cleanest approach — confirmed by reading the live code — is to make `updateMessage` fully async (it already is) and resolve the correct parser's promise before calling `renderMessage`. This keeps `renderMessage` itself synchronous and avoids changing its signature, which would ripple into the recursive embedded-message call site. The `getMessage` callback passed to `renderMessage` can then always be a plain `() => UnifiedMessage` lambda that closes over the already-resolved value.

The drag-and-drop guard silently drops unsupported files today (`return` with no action). The locked decision upgrades this to show an error via `errorFragment()`, which requires the drop handler to also know about the `$msg` element — already available via `document.getElementById`.

**Primary recommendation:** Resolve both parsers to `UnifiedMessage` inside `updateMessage` before `renderMessage` is called. Do not change `renderMessage`'s signature. Add a `getExtension(filename)` helper (2–3 lines) to centralise extension detection and handle the edge cases (no extension → empty string → unsupported error).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@molotochok/msg-viewer` | ^1.0.3 | MSG parser — `parse(view: DataView): UnifiedMessage` | Already in use, sync |
| `postal-mime` | ^2.7.4 | EML parser via `parseEml(source): Promise<UnifiedMessage>` | Already in use, async |

No new dependencies are required for this phase.

**Installation:** none needed.

---

## Architecture Patterns

### Files Changed
```
lib/
├── index.html                    # accept attribute only
└── scripts/
    └── index.ts                  # all logic changes
```

### Pattern 1: Resolve-then-render (recommended)

**What:** Await the correct parser inside `updateMessage`, then pass a synchronous lambda to `renderMessage`.

**When to use:** When the caller (`renderMessage`) is recursive and sync — avoids changing its signature and the embedded-message recursive call site.

**Example:**
```typescript
// lib/scripts/index.ts  (illustrative — do not copy verbatim)
import { parseEml } from "./eml/eml-parser";

async function updateMessage(files: FileList) {
  const file = files[0];
  const ext = getExtension(file.name);

  if (ext !== 'msg' && ext !== 'eml') {
    const $msg = document.getElementById("msg")!;
    $msg.replaceChildren(errorFragment("Unsupported file format. Please select a .msg or .eml file."));
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const $msg = document.getElementById("msg")!;

  let message: UnifiedMessage;
  try {
    if (ext === 'eml') {
      message = await parseEml(arrayBuffer);
    } else {
      message = parse(new DataView(arrayBuffer));
    }
  } catch (e) {
    window.gtag('event', 'exception', { description: e, fatal: true });
    $msg.replaceChildren(errorFragment(`An error occurred during the parsing of the email file. Error: ${e}`));
    return;
  }

  renderMessage($msg, () => message, (fragment) => $msg.replaceChildren(fragment));
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}
```

**Why this is better than making `getMessage` async:** `renderMessage` is called recursively for embedded messages (`() => embedded`). That callback is always sync. Changing the `getMessage` type to `() => UnifiedMessage | Promise<UnifiedMessage>` would require `renderMessage` to use `async/await`, turning the embedded call sites async too — unnecessary complexity for zero benefit.

### Pattern 2: Alternative — make `renderMessage` async

**What:** Change `getMessage: () => UnifiedMessage` to `getMessage: () => UnifiedMessage | Promise<UnifiedMessage>` and `await` inside `renderMessage`.

**When to use:** Only if future callers need to pass unresolved promises into `renderMessage`. Not needed now — embedded message callbacks are always sync.

**Verdict:** Do not use for this phase. Adds type complexity with no benefit.

### Anti-Patterns to Avoid
- **Silent drop for unsupported files:** The current `if (!files[0].name.endsWith(".msg")) return;` silently ignores non-MSG drops. Replace with an error display.
- **Duplicating extension logic:** Extension detection appears in two places (drag handler and `updateMessage`). Extract to `getExtension()` to ensure consistent `.toLowerCase()` handling.
- **Calling `parse()` on an EML ArrayBuffer:** `parse()` expects an OLE2-structured `DataView`. Passing an EML file to it will throw or produce garbage. The dispatch must happen before the parser call.
- **Forgetting `await` on `updateMessage` in the event listeners:** Both the `change` and `drop` handlers already call `updateMessage` without `await`, which is fine for fire-and-forget — errors are caught inside the function. No change needed to the callers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME parsing | Custom EML parser | `parseEml()` from `eml-parser.ts` | Already built in Phase 2 |
| Error display | Custom error UI | `errorFragment()` from `lib/components/error/index.ts` | Existing component, consistent styling |
| File reading | Custom FileReader wrapper | `file.arrayBuffer()` (native) | Modern browsers support it; already used for MSG |

---

## Common Pitfalls

### Pitfall 1: Extension comparison case sensitivity
**What goes wrong:** `file.name.endsWith(".MSG")` fails on Windows where uppercase extensions are common.
**Why it happens:** `endsWith` is case-sensitive.
**How to avoid:** Always call `.toLowerCase()` before comparing. The `getExtension` helper above handles this.
**Warning signs:** Works on macOS, fails on Windows test files.

### Pitfall 2: Double extension (e.g., `email.backup.eml`)
**What goes wrong:** `filename.split('.').pop()` returns `eml`, which is correct. `filename.endsWith('.eml')` also returns true. Both approaches work for double extensions.
**Why it happens:** Not actually a problem with the `lastIndexOf` approach.
**How to avoid:** Use `lastIndexOf('.')` + `slice` — handles any number of dots correctly.

### Pitfall 3: File with no extension
**What goes wrong:** `lastIndexOf('.')` returns `-1`, `slice(0)` returns the whole filename.
**Why it happens:** Off-by-one in the guard.
**How to avoid:** Guard: `return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()`. Empty string will not match `'msg'` or `'eml'`, triggering the unsupported-format error correctly.

### Pitfall 4: Error message still references ".msg file"
**What goes wrong:** The catch block in `renderMessage` at line 59 says "parsing of the .msg file". After this phase, EML files go through the same error path.
**Why it happens:** The message was written before EML support existed.
**How to avoid:** Change to "email file" as specified in the locked decisions.

### Pitfall 5: Drop handler using `return` instead of error display for unsupported files
**What goes wrong:** Dropping a `.pdf` silently does nothing — confusing UX.
**Why it happens:** Original code used early `return` as a guard.
**How to avoid:** Replace the guard with an explicit error display using `errorFragment()`.

---

## Code Examples

### Current drag-and-drop guard (to replace)
```typescript
// lib/scripts/index.ts lines 23-29 — current code
const files = event.dataTransfer!.files;
if (files.length == 0) return;
if (!files[0].name.endsWith(".msg")) return;   // <-- replace this line
```

### Current error message (to update)
```typescript
// lib/scripts/index.ts line 59 — current code
fragment = errorFragment(`An error occured during the parsing of the .msg file. Error: ${e}`);
// Change ".msg file" → "email file"
```

### Current HTML accept attribute (to update)
```html
<!-- lib/index.html line 37 — current code -->
<input type="file" id="file" name="file" accept=".msg" hidden />
<!-- Change accept=".msg" → accept=".msg,.eml" -->
```

### Import to add in index.ts
```typescript
import { parseEml } from "./eml/eml-parser";
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MSG-only guard with silent drop | Accept both + show error for unsupported | Phase 3 | Users get feedback on bad drops |
| Sync-only `getMessage` callback | Resolve async parsers before `renderMessage` | Phase 3 | No signature change to `renderMessage` |

---

## Open Questions

1. **`renderMessage` try/catch after async resolution**
   - What we know: The current `renderMessage` catch wraps `getMessage()` synchronously. If parse errors are caught in `updateMessage` before calling `renderMessage`, the try/catch in `renderMessage` becomes dead code for the EML path.
   - What's unclear: Should the catch in `renderMessage` be kept for the MSG embedded-message path, or is it now redundant?
   - Recommendation: Keep the catch in `renderMessage` — it still guards the `messageFragment()` call which could throw for malformed MSG embedded messages, independent of the parser step.

2. **Label text in `lib/index.html`**
   - What we know: Line 36 reads `Select .msg file` — user-visible text that should reflect EML support.
   - What's unclear: CONTEXT.md does not mention updating the label text or `<h1>` / `<p>` copy.
   - Recommendation: Treat as Claude's Discretion. Update label to "Select email file (.msg or .eml)" to avoid confusing users. This is a one-line change within the same file already being edited.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in, bun:test) |
| Config file | none — invoked via `bun test --dom` |
| Quick run command | `bun test --dom` |
| Full suite command | `bun test --dom` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | `.eml` drop accepted and parsed | unit (DOM) | `bun test --dom tests/entry-point.test.ts` | ❌ Wave 0 |
| UI-01 | `.msg` file picker still works after change | unit (DOM) | `bun test --dom tests/entry-point.test.ts` | ❌ Wave 0 |
| UI-01 | Unsupported extension shows error fragment | unit (DOM) | `bun test --dom tests/entry-point.test.ts` | ❌ Wave 0 |

**Note:** `lib/scripts/index.ts` is a browser entry point that binds to DOM event listeners at module load time. Unit-testing it requires either a DOM environment (Bun's `--dom` flag provides `document`) or extracting pure logic functions (`getExtension`, dispatch) into a separate module that is import-testable without DOM setup. Recommend extracting `getExtension` and the format-detection dispatch into testable pure functions.

### Sampling Rate
- **Per task commit:** `bun test --dom`
- **Per wave merge:** `bun test --dom`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/entry-point.test.ts` — covers UI-01 (extension detection, parser dispatch, error path)
- [ ] Extract `getExtension(filename: string): string` as a named export from `lib/scripts/index.ts` or a utility module so it can be imported and tested without DOM

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `lib/scripts/index.ts`, `lib/index.html`, `lib/scripts/eml/eml-parser.ts`, `lib/scripts/types/unified-message.ts`, `lib/components/error/index.ts` — exact current signatures and line numbers confirmed

### Secondary (MEDIUM confidence)
- `package.json` — confirmed `bun test --dom` as the test runner command
- `tests/eml-parser.test.ts` — confirmed existing test pattern (bun:test, describe/test, fixtures)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from source files, no new dependencies needed
- Architecture: HIGH — all call sites and type signatures read from actual code
- Pitfalls: HIGH — derived from code analysis of exact lines being changed

**Research date:** 2026-04-01
**Valid until:** Stable — changes only if `renderMessage` or parser signatures change
