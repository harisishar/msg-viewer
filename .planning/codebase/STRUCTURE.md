# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
msg-viewer/
├── lib/                                # Source code
│   ├── index.html                      # Application entry point
│   ├── scripts/
│   │   ├── index.ts                    # UI orchestration and event handling
│   │   ├── msg/                        # Message parsing library (publishable)
│   │   │   ├── msg-parser.ts           # Main parse() and parseDir() functions
│   │   │   ├── types/
│   │   │   │   └── message.d.ts        # Message, Attachment, Recipient interfaces
│   │   │   ├── compound-file/          # Binary file format parsing
│   │   │   │   ├── compound-file.ts    # Root container and stream reading
│   │   │   │   ├── header.ts           # Header parsing and validation
│   │   │   │   ├── fat.ts              # File Allocation Table parsing
│   │   │   │   ├── mini-fat.ts         # Mini FAT for small streams
│   │   │   │   ├── difat.ts            # Double Indirect FAT parsing
│   │   │   │   ├── directory/          # Directory entry and traversal
│   │   │   │   │   ├── directory.ts    # Red-Black tree traversal, entry parsing
│   │   │   │   │   ├── enums/
│   │   │   │   │   │   ├── object-type.ts
│   │   │   │   │   │   └── color-flag.ts
│   │   │   │   │   └── types/
│   │   │   │   │       └── directory-entry.d.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── text-decoder.ts # UTF-16 LE decoder
│   │   │   │   └── util.ts             # Sector offset calculations
│   │   │   ├── streams/                # Stream and property parsing
│   │   │   │   ├── property/
│   │   │   │   │   ├── properties.ts   # Property definitions (ROOT, ATTACH, RECIP)
│   │   │   │   │   ├── property-types.ts
│   │   │   │   │   ├── property-stream.ts
│   │   │   │   │   ├── constants/
│   │   │   │   │   └── types/
│   │   │   │   │       ├── property-header.d.ts
│   │   │   │   │       ├── property-stream-entry.d.ts
│   │   │   │   │       └── property-data.d.ts
│   │   │   │   ├── entry/              # Named property entry stream
│   │   │   │   │   ├── entry-stream.ts
│   │   │   │   │   └── types/
│   │   │   │   │       └── entry-stream-entry.ts
│   │   │   │   └── constants/
│   │   │   │       └── folders.ts
│   │   │   └── rtf/                    # RTF decompression
│   │   │       ├── rtf-decompressor.ts
│   │   │       └── decompressor/
│   │   │           ├── header.ts
│   │   │           ├── dictionary.ts
│   │   │           └── crc.ts
│   │   └── utils/                      # Helper functions
│   │       ├── html-template-util.ts   # {{key}} template substitution
│   │       └── file-size-util.ts       # Byte formatting
│   ├── components/                     # UI components (generate DOM fragments)
│   │   ├── message/
│   │   │   ├── index.ts
│   │   │   └── index.html              # Message template
│   │   ├── attachment/
│   │   │   ├── index.ts
│   │   │   └── index.html
│   │   ├── recipient/
│   │   │   ├── index.ts
│   │   │   └── index.html
│   │   ├── embedded-msg/
│   │   │   ├── index.ts
│   │   │   └── index.html
│   │   └── error/
│   │       ├── index.ts
│   │       └── index.html
│   ├── styles/
│   │   └── styles.css                  # Application styling
│   └── resources/                      # Static assets (favicon, etc.)
│
├── build.ts                            # Bun build script
├── package.json                        # Root package with msg-viewer dependency
├── declarations.d.ts                   # TypeScript module declarations
├── .planning/codebase/                 # Planning documents (this directory)
│   ├── ARCHITECTURE.md
│   └── STRUCTURE.md
│
└── lib/scripts/msg/package.json        # Nested package (msg-viewer library)
```

## Directory Purposes

**lib/**
- Purpose: All source code for the application and library
- Contains: TypeScript files, HTML templates, styles, resources
- Key files: `index.html` (entry), `scripts/index.ts` (orchestration)

**lib/scripts/msg/**
- Purpose: Message parsing library (can be published to npm as `@molotochok/msg-viewer`)
- Contains: Binary format parsing, property extraction, RTF decompression
- Key files: `msg-parser.ts` (public API), `types/message.d.ts` (public interfaces)

**lib/scripts/msg/compound-file/**
- Purpose: Parse Microsoft OLE2 Compound File binary format (core of .msg format)
- Contains: Header parsing, FAT/miniFAT tables, directory tree traversal, stream reading
- Key files: `compound-file.ts` (entry), `header.ts` (signature validation)

**lib/scripts/msg/streams/**
- Purpose: Extract named properties and data from property streams
- Contains: Property mappings, type definitions, property stream parsing, RTF decompression
- Key files: `property/properties.ts` (property definitions), `property/property-stream.ts` (parsing)

**lib/components/**
- Purpose: Render parsed data as DOM fragments (no framework dependency)
- Contains: Template-based component functions that return DocumentFragment
- Pattern: Each component exports a single factory function (e.g., `messageFragment()`)

**lib/scripts/utils/**
- Purpose: Reusable helper functions
- Contains: HTML template substitution, file size formatting, potentially decoder utilities

## Key File Locations

**Entry Points:**
- `lib/index.html` - HTML document, defines root div, loads script
- `lib/scripts/index.ts` - Application logic: file handling, rendering, error handling
- `lib/scripts/msg/msg-parser.ts` - Public API for message parsing

**Configuration:**
- `package.json` - Project metadata, Bun plugin dependencies
- `build.ts` - Build configuration (Bun build with html plugin)
- `declarations.d.ts` - Module type declarations (html imports, gtag global)
- `lib/scripts/msg/package.json` - Nested library package (for npm publication)

**Core Logic:**
- `lib/scripts/msg/compound-file/compound-file.ts` - Binary file structure parsing
- `lib/scripts/msg/msg-parser.ts` - Orchestration of parsing (file → message structure)
- `lib/components/message/index.ts` - Main component rendering template

**Testing:**
- None detected

## Naming Conventions

**Files:**
- TypeScript files: `kebab-case.ts` (e.g., `compound-file.ts`, `property-stream.ts`)
- Type definition files: `*.d.ts` (e.g., `message.d.ts`, `directory-entry.d.ts`)
- HTML templates: `index.html` (co-located with component function)
- Constants/enums: `kebab-case.ts` (e.g., `text-decoder.ts`, `color-flag.ts`)

**Directories:**
- Feature folders: `kebab-case/` (e.g., `compound-file/`, `property-stream/`)
- Type folders: `types/` (contains `*.d.ts` files)
- Constant folders: `constants/` (contains constant/enum definitions)
- Enum folders: `enums/` (contains enum definitions)

**Functions:**
- Exports: `camelCase` (e.g., `parse()`, `parseDir()`, `messageFragment()`)
- Private: `camelCase` with leading underscore or inline in functions
- Factory functions: Verb + noun (e.g., `getHeader()`, `getDirectory()`, `getValue()`)

**Variables:**
- Component view models: `CamelCaseViewModel` (e.g., `MessageViewModel`, `AttachmentViewModel`)
- Data objects: `camelCase` (e.g., `message`, `attachment`, `recipient`)
- DOM elements: `$camelCase` (e.g., `$msg`, `$btn`) - jQuery-like convention

**Types:**
- Interfaces: `CamelCase` (e.g., `Message`, `Header`, `DirectoryEntry`)
- Types: `CamelCase` with `Type` suffix (e.g., `PropertyType`)
- Enums: `CamelCase` (e.g., `ObjectType`, `ColorFlag`)

## Where to Add New Code

**New Feature (e.g., signature validation):**
- Primary code: `lib/scripts/msg/compound-file/` (if binary-related) or `lib/scripts/msg/streams/` (if property-related)
- Tests: Not applicable (no test structure)
- Exports: Update `msg-parser.ts` public API if needed

**New Component/Module:**
- Implementation: `lib/components/{feature-name}/index.ts`
- Template: `lib/components/{feature-name}/index.html` (if rendering DOM)
- Export: Function returning `DocumentFragment` with `$` = container

**Utilities:**
- Shared helpers: `lib/scripts/utils/{helper-name}.ts`
- Pattern: Export named functions, no default exports

**Binary Format Parsing:**
- Layer: `lib/scripts/msg/compound-file/` for format structure, `lib/scripts/msg/streams/` for data extraction
- Pattern: Create util function (e.g., `getXXX()`) that parses specific structure and returns typed result

**Property Mappings:**
- Location: `lib/scripts/msg/streams/property/properties.ts`
- Pattern: Add to `ROOT_PROPERTIES`, `ATTACH_PROPERTIES`, or `RECIP_PROPERTIES` array with ID and type

## Special Directories

**lib/resources/:**
- Purpose: Static assets bundled with application
- Generated: No (manually placed)
- Committed: Yes

**build/:**
- Purpose: Output of `bun run build` (minified, bundled)
- Generated: Yes (from `build.ts`)
- Committed: No (in `.gitignore`)

**.planning/codebase/:**
- Purpose: Codebase documentation for GSD planning and execution
- Generated: Yes (by GSD orchestrator)
- Committed: Yes
