# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Hardcoded Loop Limit in Message Parsing:**
- Issue: Recipient and attachment parsing uses a hardcoded loop limit of 2048 iterations without validation
- Files: `src/scripts/msg/msg-parser.ts` (line 43)
- Impact: Messages with more than 2048 recipients/attachments silently truncate. No warning or error is raised.
- Fix approach: Replace hardcoded 2048 with dynamic detection based on property stream header counts (available in `getPropertyStreamEntry` via `header.recipientCount` and `header.attachmentCount`)

**Magic Numbers Throughout Binary Parsing:**
- Issue: Constants like 207, 2048, 4096, 0xFFFFFFFE appear throughout without clear centralized documentation
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts` (line 25, writeOffset=207), `lib/scripts/msg/compound-file/compound-file.ts`, `lib/scripts/msg/msg-parser.ts`
- Impact: Difficult to maintain and verify correctness against MS-CFB and MS-OXMSG specifications
- Fix approach: Create `lib/scripts/msg/constants/binary-constants.ts` to centralize all magic numbers with references to spec sections

**Unused Type Definition:**
- Issue: `clsid` field in `DirectoryEntry` is always set to empty string, never populated or used
- Files: `lib/scripts/msg/compound-file/directory/directory.ts` (line 96)
- Impact: Code clutter, misleading about available data
- Fix approach: Either remove the field or implement proper CLSID parsing if needed for future features

## Known Bugs

**CRC Validation Bypass in RTF Decompression:**
- Symptoms: RTF files with invalid CRC may be partially processed before decompression fails
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts` (line 17-18)
- Trigger: Corrupted RTF data stream with CRC mismatch
- Current behavior: Throws error after attempting some processing. No rollback of partial state.
- Workaround: Pre-validate CRC before attempting decompression

**Non-Null Assertion Forced in Property Stream Parsing:**
- Symptoms: Application crashes if property stream is missing
- Files: `lib/scripts/msg/msg-parser.ts` (line 47, using `!` operator)
- Trigger: MSG file with missing `__properties_version1.0` stream for recipient/attachment
- Current behavior: `getPropertyStreamEntry` returns null, force unwrap causes undefined behavior
- Workaround: Validate recipient/attachment folders exist before parsing

**Missing Bounds Check in DataView Access:**
- Symptoms: Reading beyond buffer boundaries in RTF decompression
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts` (line 44-46, getUint16 without validation)
- Trigger: Corrupted RTF header with invalid offset values
- Current behavior: May read garbage or throw if offset exceeds buffer size
- Workaround: Validate offsets against view.byteLength before reading

## Security Considerations

**Directory Traversal in Entry Lookup:**
- Risk: The recursive directory tree traversal could be exploited with malformed entry names
- Files: `lib/scripts/msg/compound-file/directory/directory.ts` (lines 42-61, 139-150)
- Current mitigation: String comparison is case-insensitive but doesn't validate entry names
- Recommendations: 
  - Validate entry names match expected patterns (should only contain ASCII/Unicode, not path separators)
  - Add depth limit to recursive traversal to prevent stack overflow attacks
  - Implement sanity check on sibling/child IDs against entries array bounds

**Buffer Slice Without Validation:**
- Risk: `file.view.buffer.slice()` operations could expose unintended memory regions
- Files: `lib/scripts/msg/msg-parser.ts` (line 98), `lib/scripts/msg/rtf/rtf-decompressor.ts` (line 12)
- Current mitigation: None - offsets are computed but not validated against buffer size
- Recommendations:
  - Add explicit bounds checks: `offset + bytes <= view.byteLength`
  - Consider using `view.buffer.slice(offset, Math.min(offset + bytes, view.byteLength))`
  - Log warnings if computed offsets exceed bounds

**No Input Validation on Binary Data:**
- Risk: Malformed MSG files could cause memory exhaustion or infinite loops
- Files: All compound-file parsing (`lib/scripts/msg/compound-file/`)
- Current mitigation: Loop termination conditions use sector bounds (0xFFFFFFFE checks)
- Recommendations:
  - Add iteration limits to prevent DoS from cyclic FAT chains
  - Validate stream sizes before allocating buffers (especially `new Uint8Array(Number(entry.streamSize))` in line 95)
  - Add file size sanity checks at parse entry point

**HTML Injection via Sender Name:**
- Risk: Unescaped HTML in sender email addresses
- Files: `lib/components/message/index.ts` (line 55)
- Current mitigation: Message uses `&lt;` and `&gt;` entities, but senderName is not escaped
- Recommendations:
  - Use `document.createElement()` instead of HTML string assembly
  - Or sanitize senderName with DOMPurify or similar library
  - Review all template-based rendering for similar issues

## Performance Bottlenecks

**Inefficient RTF Dictionary Lookup:**
- Problem: Dictionary access in decompression uses modulo operator repeatedly in tight loop
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts` (lines 40, 57, 60)
- Cause: `writeOffset = (writeOffset + 1) % dictionary.length` called up to 256+ times per control byte
- Improvement path: 
  - Pre-compute dictionary mask as `dictionary.length - 1` (power of 2)
  - Use bitwise AND instead: `writeOffset = (writeOffset + 1) & mask`
  - Consider ring buffer implementation for 4096-byte circular buffer

**Repeated Map Lookups in Property Resolution:**
- Problem: Property data retrieved from Map inside reduce loop without caching
- Files: `lib/scripts/msg/msg-parser.ts` (line 72)
- Cause: `entry.data.get()` called once per property per message element
- Impact: Scales poorly with messages having many properties (100+ properties × 50 recipients = 5000+ lookups)
- Improvement path:
  - Cache property data in a local variable before reduce
  - Or convert Map to plain object for O(1) access

**Large Attachment Buffering:**
- Problem: Binary attachments loaded entirely into memory via `new Uint8Array(Number(entry.streamSize))`
- Files: `lib/scripts/msg/msg-parser.ts` (line 95)
- Impact: Large MSG files (50MB+) may cause memory pressure or OOM
- Improvement path:
  - For large streams, return a reference to DataView instead of copying
  - Implement streaming/chunked processing for rendering
  - Add file size limits or compression hints

**Red-Black Tree Traversal Without Memoization:**
- Problem: Directory lookup traverses tree recursively for every property/attachment access
- Files: `lib/scripts/msg/compound-file/directory/directory.ts` (lines 42-61)
- Impact: Parsing message with 50 attachments does 50× full tree traversals
- Improvement path:
  - Build index map on Directory construction
  - Cache frequently accessed entries
  - Pre-fetch known folders at parse time

## Fragile Areas

**RTF Decompression State Machine:**
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts`
- Why fragile:
  - Complex bit manipulation without comments explaining the algorithm
  - Three interleaved state variables: `offset`, `writeOffset`, `readOffset`, `canRun`
  - Magic number 207 for initial writeOffset is undocumented
  - Loop termination depends on both offset AND canRun flag
- Safe modification:
  - Add unit tests for known RTF samples (compressed and uncompressed)
  - Document each state variable's invariants
  - Add assertion checks: verify writeOffset/readOffset stay within [0, 4096)
  - Test coverage: gaps in edge cases (empty streams, single-byte content)

**Property Stream Entry Parsing:**
- Files: `lib/scripts/msg/streams/property/property-stream.ts`, `lib/scripts/msg/msg-parser.ts` (lines 17-18, 47-48)
- Why fragile:
  - Non-null assertions force unwrap on potentially null values
  - Property header format varies by folder type (ROOT vs ATTACH vs RECIP) handled with string startsWith
  - Header size calculation is implicit in getHeader return
  - Assuming property data is always populated before getValue
- Safe modification:
  - Replace all `!` non-null assertions with explicit null checks
  - Add header type enum instead of string matching
  - Document and validate header format assumptions
  - Test with folders missing properties streams

**Compound File Stream Reading:**
- Files: `lib/scripts/msg/compound-file/compound-file.ts` (lines 29-69)
- Why fragile:
  - Complex pointer arithmetic with three different sector sizes (sector, miniSector, offset)
  - FAT chain following can silently fail if sector chain is corrupt
  - Boundary calculation: `offset - initialOffset >= sectorSize` assumes correct sector tracking
  - No cycle detection in FAT chain traversal (could loop infinitely on corrupt files)
- Safe modification:
  - Add cycle detection with visited set for FAT traversal
  - Validate sector numbers before accessing fat[sector]
  - Add explicit bounds checks on offset calculations
  - Test with truncated/corrupt file streams

## Scaling Limits

**Message Parsing Limits:**
- Current capacity: Tests up to 2048 recipients/attachments (hardcoded limit)
- Limit: Messages with >2048 recipients will be truncated silently
- Scaling path: Use dynamic counts from property header instead of hardcoded loop

**Buffer Size Allocation:**
- Current capacity: Limited by available system memory for single Uint8Array allocation
- Limit: MSG with 1GB attachment would fail to parse on systems with <1GB free RAM
- Scaling path: Implement streaming for large binary streams, lazy loading for attachments

**RTF Dictionary Size:**
- Current capacity: Fixed 4096-byte circular buffer (hardcoded in getDictionary)
- Limit: RTF documents referencing offsets beyond position 4096 would be corrupted
- Scaling path: This is per MS-OXRTF spec, not a scaling issue - spec defines this limit

**Directory Entry Cache:**
- Current capacity: All directory entries loaded into memory during parse
- Limit: MSG files with thousands of nested directory entries would consume significant memory
- Scaling path: Lazy load directory entries on demand, implement LRU cache

## Dependencies at Risk

**RTF Decompression CRC Implementation:**
- Risk: CRC validation depends on custom crc() implementation without external validation library
- Impact: If CRC algorithm contains bug, corrupted RTF could be accepted
- Files: `lib/scripts/msg/rtf/decompressor/crc.ts`
- Migration plan: 
  - Compare implementation against MS-OXRTF specification
  - Add test vectors from known RTF samples
  - Consider using established library if available (e.g., crc package)

**No Error Recovery in Parsing:**
- Risk: Single malformed stream/property terminates entire parse instead of graceful degradation
- Impact: Messages that could be partially recovered are completely lost
- Migration plan:
  - Wrap property/attachment parsing in try-catch
  - Return partial Message with warnings instead of throwing
  - Log issues for debugging

## Missing Critical Features

**No Validation of Compound File Structure:**
- Problem: No verification that FAT, miniFAT, directory chains are valid before using
- Blocks: Cannot safely parse untrusted MSG files without risk of DoS
- Recommended: Add validation phase before parsing:
  - Check all FAT sectors are within file bounds
  - Verify no cycles in FAT chains
  - Validate directory entry sibling/child IDs

**No Memory Limit Controls:**
- Problem: Parser has no budgets for buffer allocation or recursion depth
- Blocks: Malicious MSG files could trigger OOM or stack overflow
- Recommended: Add resource limits:
  - Max total allocation size
  - Max recursion depth in directory traversal
  - Max stream size before requiring streaming API

**No Streaming/Progressive Parsing:**
- Problem: Entire file loaded into memory, all streams buffered at once
- Blocks: Cannot efficiently parse large messages (>100MB)
- Recommended: Implement streaming parser for:
  - Attachment body rendering
  - Property iteration
  - Directory traversal

**No Schema Validation:**
- Problem: No validation against MS-CFB, MS-OXMSG specifications
- Blocks: Cannot detect invalid/corrupted files proactively
- Recommended: Add schema validator:
  - Verify required fields presence
  - Validate field value ranges
  - Check property types match expected types

## Test Coverage Gaps

**RTF Decompression Edge Cases:**
- What's not tested: Compressed RTF with reference distances > current buffer size, single-byte content, all-zero data
- Files: `lib/scripts/msg/rtf/rtf-decompressor.ts`
- Risk: Bit manipulation bugs or off-by-one errors in reference handling could cause memory reads or corrupted output
- Priority: High (RTF processing is security-sensitive)

**Malformed MSG File Handling:**
- What's not tested: Missing streams, truncated FAT, cyclic directory references, invalid property types
- Files: All of `lib/scripts/msg/`
- Risk: Parser assumes valid file structure; malformed files could cause crashes or incorrect parsing
- Priority: High (safety/security)

**BigInt/Number Conversions:**
- What's not tested: Stream sizes at boundaries (2^31, 2^53), conversion edge cases
- Files: `lib/scripts/msg/msg-parser.ts`, `lib/scripts/msg/compound-file/compound-file.ts`
- Risk: Silent precision loss in conversion could cause buffer overruns
- Priority: Medium (affects large files)

**Component Error Rendering:**
- What's not tested: HTML sanitization in error messages, special characters in sender names
- Files: `lib/components/message/index.ts`, `lib/components/error/index.ts`
- Risk: XSS if error contains user input
- Priority: High (security)

**Recipient/Attachment Parsing:**
- What's not tested: Missing property streams, recipients with no email, attachments without display name
- Files: `lib/scripts/msg/msg-parser.ts`, `lib/components/recipient/index.ts`, `lib/components/attachment/index.ts`
- Risk: Non-null assertions and missing optional checks could cause crashes
- Priority: Medium (robustness)

---

*Concerns audit: 2026-04-01*
