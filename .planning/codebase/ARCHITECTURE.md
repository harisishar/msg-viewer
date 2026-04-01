# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Layered architecture with clear separation between file format parsing (msg-viewer library) and UI rendering (web application).

**Key Characteristics:**
- Binary format parser as a reusable library (`@molotochok/msg-viewer`)
- DOM-based component rendering system
- Event-driven UI updates
- Stream-based data extraction from Compound File format
- Property-based metadata extraction

## Layers

**Compound File Layer:**
- Purpose: Parse Microsoft OLE2 Compound File binary format
- Location: `lib/scripts/msg/compound-file/`
- Contains: Header parsing, FAT/miniFAT management, directory traversal, stream reading
- Depends on: DataView (binary data access)
- Used by: Message parsing layer

**Stream & Property Layer:**
- Purpose: Extract structured data from compound file streams and property stores
- Location: `lib/scripts/msg/streams/`
- Contains: Property stream parsing, RTF decompression, property type definitions, entry stream handling
- Depends on: Compound File layer
- Used by: Message parser

**Message Parser Layer:**
- Purpose: Orchestrate extraction of message, attachments, and recipients
- Location: `lib/scripts/msg/msg-parser.ts`
- Contains: Parse function, content extraction logic, property value resolution
- Depends on: Compound File layer, Stream/Property layer
- Used by: UI layer, exported as `@molotochok/msg-viewer`

**UI Component Layer:**
- Purpose: Render parsed message data as DOM fragments
- Location: `lib/components/`
- Contains: Message, attachment, recipient, embedded message, and error components
- Depends on: Message parser output, utility functions
- Used by: Application entry point

**Application Layer:**
- Purpose: Handle file upload, drag-and-drop, UI orchestration
- Location: `lib/scripts/index.ts`, `lib/index.html`
- Contains: File input handling, error handling, recursive message rendering (for embedded messages)
- Depends on: UI Component layer, Message parser

## Data Flow

**File Loading & Parsing:**

1. User selects `.msg` file via input or drag-and-drop
2. File converted to `ArrayBuffer` (binary data)
3. `DataView` created from buffer
4. `parse(dataView)` called (from msg-viewer library)
5. `CompoundFile.create()` initializes binary structure parsing

**Message Extraction:**

1. `parseDir()` receives compiled file and directory entry
2. Property stream extracted for message metadata
3. Root properties (`ROOT_PROPERTIES`) mapped to message content fields
4. Attachment entries enumerated (naming pattern: `__attach_version1.0_#XXXXXXXX`)
5. Recipient entries enumerated (naming pattern: `__recip_version1.0_#XXXXXXXX`)
6. Stream data fetched for large values (body, attachments, recipients)
7. Property data fetched for small values (date, metadata)

**Rendering:**

1. `messageFragment()` receives parsed message
2. Template fragments created for each component:
   - Message header (subject, sender, date)
   - Recipients (To/CC separated by property matching)
   - Attachments (filtered for content, converted to blobs)
   - Embedded messages (detected by `embeddedMsgObj` property)
3. DOM event listeners attached to enable nested message rendering

**Embedded Message Handling:**

1. Attachment with `embeddedMsgObj` property triggers click handler
2. `parseDir()` called recursively with directory entry
3. Parsed embedded message rendered with previous siblings hidden
4. Back button closes embedded message, re-shows parent

**State Management:**

- Message object holds reference to original `CompoundFile` for nested parsing
- DOM visibility toggled for message stacking (nested messages hide parent)
- No centralized state store; state lives in DOM and message object tree

## Key Abstractions

**Message:**
- Purpose: Root data structure representing a parsed .msg file
- Examples: `lib/scripts/msg/types/message.d.ts`
- Pattern: Interface aggregating CompoundFile, content, attachments, recipients

**MessageContent:**
- Purpose: Extracted message metadata and body
- Pattern: Property-based extraction using property IDs and type conversion

**Property:**
- Purpose: Map between msg property IDs and extracted field names
- Examples: `lib/scripts/msg/streams/property/properties.ts`
- Pattern: Configuration objects defining source (stream vs. property store), type, and ID

**DirectoryEntry:**
- Purpose: Reference to named stream or storage object in compound file
- Pattern: Tree node with left/right siblings (Red-Black tree), child pointer, metadata
- Used for: Locating attachments, recipients, embedded messages by name pattern

**CompoundFile:**
- Purpose: Parsed binary file with sector allocation tracking
- Pattern: Immutable container holding header, FAT, miniFAT, directory, binary view
- Methods: `readStream()` follows sector chains and invokes callbacks

## Entry Points

**Message Parser (Library Export):**
- Location: `lib/scripts/msg/msg-parser.ts`
- Triggers: Imported by `lib/scripts/index.ts`
- Responsibilities: Parse binary data into structured message object

**Application Entry Point:**
- Location: `lib/scripts/index.ts`
- Triggers: DOM ready, file input change, drag-and-drop events
- Responsibilities: File loading, error handling, UI orchestration, recursive rendering

**HTML Entry Point:**
- Location: `lib/index.html`
- Triggers: Browser navigation
- Responsibilities: Initial markup (file input, info panel), script loading

## Error Handling

**Strategy:** Try-catch at application layer with user-facing error display.

**Patterns:**
- Parse failures caught in `renderMessage()` function
- Error details passed to `errorFragment()` for display
- Google Analytics event fired on exception (`window.gtag`)
- Graceful degradation: missing resources don't throw (`if (!directory) break;`)
- Missing recipient/attachment entries silently skipped

## Cross-Cutting Concerns

**Logging:** None in parsing logic; errors reported via Google Analytics only.

**Validation:** 
- Header signature validation in `getHeader()` - throws if mismatch
- File extension checked at upload (`.msg` only)
- Bounds checking on sector chains to prevent infinite loops

**Authentication:** Not applicable (client-side tool, no backend).
