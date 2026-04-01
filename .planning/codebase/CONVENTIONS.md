# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Component files use `index.ts` naming pattern: `lib/components/recipient/index.ts`, `lib/components/message/index.ts`
- Implementation files in deeply nested paths use descriptive names: `compound-file.ts`, `rtf-decompressor.ts`, `property-stream.ts`
- Type definition files use `.d.ts` suffix: `directory-entry.d.ts`, `message.d.ts`
- Enum/constant files named for their content: `color-flag.ts`, `object-type.ts`, `property-types.ts`

**Functions:**
- camelCase: `messageFragment()`, `attachmentsFragment()`, `recipientsFragments()`
- Private helper functions prefixed with underscore pattern or nested inside modules: `addFragmentToContainer()`, `getName()`, `getDate()`
- Getter functions use `get` prefix: `getHeader()`, `getContent()`, `getPropertyStreamEntry()`, `getDirectory()`
- Factory/constructor functions use `create` or `parse` prefix: `CompoundFile.create()`, `parse()`
- Accessor methods on classes use clear names: `Directory.get()`, `Directory.traverse()`

**Variables:**
- camelCase throughout: `toRecipients`, `ccRecipients`, `sectorSize`, `messageFragment`
- Prefixed with `$` for DOM elements: `$btn`, `$msg`, `$container`
- Abbreviated names in compact loops: `ref`, `bit`, `i`, `j`, `offset`, `sector`
- Local scope abbreviations acceptable: `acc` (accumulator in reduce), `obj` (object parameter)

**Types:**
- PascalCase for interfaces: `MessageViewModel`, `RecipientViewModel`, `AttachmentViewModel`, `Property`, `Header`, `DirectoryEntry`
- PascalCase for classes: `CompoundFile`, `Directory`, `ColorFlag`, `ObjectType`
- Constants defined as `const enum` or uppercase: `PropertySource.Stream`, `PropertySource.Property`
- Exported constants use UPPER_SNAKE_CASE: `ROOT_PROPERTIES`, `ATTACH_PROPERTIES`, `RECIP_PROPERTIES`, `PROPERTY_TYPES`

## Code Style

**Formatting:**
- No explicit linter/formatter configured (jsconfig.json only)
- 2-space indentation observed throughout
- Single quotes used in template strings and HTML templates: `const template from "./index.html" with { type: "text" }`
- Comments: No consistent JSDoc pattern enforced but used occasionally

**Linting:**
- No ESLint or Prettier config present
- JSConfig strict mode enabled: `"strict": true`
- Type checking enabled: `"noEmit": true` (type-check only, no runtime emit)
- Unused variables/parameters NOT enforced: `"noUnusedLocals": false`, `"noUnusedParameters": false`
- Property access from index signature NOT enforced: `"noPropertyAccessFromIndexSignature": false`

## Import Organization

**Order:**
1. Type imports from relative paths: `import type { DirectoryEntry } from "../../scripts/msg/..."`
2. Function/utility imports from relative paths: `import { CompoundFile } from "./compound-file/compound-file"`
3. Template/resource imports: `import template from "./index.html" with { type: "text" }`

**Path Aliases:**
- No path aliases configured
- Relative imports throughout: `../../scripts/msg/...`, `./relative/path`

**Import Style:**
- Mixed default and named imports
- Type imports explicitly marked with `type` keyword: `import type { Message } from "..."`
- Use of `with` clause for HTML templates: `import template from "./index.html" with { type: "text" }`

## Error Handling

**Patterns:**
- Throws on signature mismatch: `throw new Error("Signature mismatch!")` in `getHeader()`
- Throws on CRC validation failure: `throw new Error("CRC mismatch! Expected ${header.crc}, got ${currentCRC}.")` in `decompressRTF()`
- Guard clauses with early return: `if (sector >= 0xFFFFFFFE) return;`
- Null coalescing with `??` operator: `content.senderEmail ?? ""`, `content.date?.toLocaleString(...) ?? ""`
- Optional chaining: `message.content.senderEmail`, `element.parentElement?.remove()`
- No try-catch blocks in core parsing logic; errors bubble up

## Logging

**Framework:** None - no logging framework configured

**Patterns:**
- `console.log()` used only for debug/development: `this.traverse((entry, depth) => console.log("\t".repeat(depth), entry.entryName))` in `directory.ts`
- No production logging observed
- Errors thrown as Errors with descriptive messages rather than logged

## Comments

**When to Comment:**
- Comments used for complex binary format specifications in headers
- Comments explain protocol details (e.g., DIFAT structure, sector sizes)
- Complex algorithms have inline explanatory comments
- No comments for self-documenting code

**JSDoc/TSDoc:**
- Minimal JSDoc usage observed
- `fillHTMLTemplate()` has brief JSDoc: `/** Fills an HTML template with object values in place of {{object.key}} */`
- `Directory.get()` has brief method description: `/** Traverses a Red-Black Tree to find the entry with the given name. */`
- No parameter or return type documentation via JSDoc (types are in code signatures)

## Function Design

**Size:** 
- Most functions 20-50 lines
- Larger functions (80+ lines) handle complex algorithmic work: `CompoundFile.readStream()` (41 lines), `Directory.getDirectory()` (24 lines)
- Component functions typically 40-80 lines when including template processing

**Parameters:**
- Minimal parameter counts (1-4 typical)
- Callback functions used for iteration: `getDataAction: (offset: number, bytesToRead: number) => void`
- Optional parameters marked with `?`: `entrySize?: number`, `getHeaderAction?: (offset: number) => number`
- Type annotations explicit: `view: DataView`, `header: Header`

**Return Values:**
- Explicit return types on public functions
- DocumentFragment for component functions: `messageFragment(): DocumentFragment`
- Null/empty guards: returns `null` when entry not found, empty `DocumentFragment` when no data
- Array return types common: `getRecipients(): Recipient[]`, `getAttachments(): Attachment[]`

## Module Design

**Exports:**
- Barrel exports in `index.ts` files: `export function messageFragment()` in `lib/components/message/index.ts`
- Single responsibility per module: attachment, message, recipient, error components each isolated
- Type exports marked with `export type`: `export type { Message, MessageContent }`

**Barrel Files:**
- Used in component directories: `lib/components/*/index.ts` export functions
- No barrel files at higher levels (lib/ or lib/scripts/)
- Import paths point directly to implementation: `import { messageFragment } from "../message"`

---

*Convention analysis: 2026-04-01*
