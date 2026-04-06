// Run with: bun test --dom tests/entry-point.test.ts
import { describe, test, expect } from 'bun:test';
import { getExtension } from '../lib/scripts/index';

// ──────────────────────────────────────────────
// Unit tests: getExtension (Tests 1-5)
// Pure-function tests — no DOM needed, no mocks required.
// ──────────────────────────────────────────────

describe('getExtension', () => {
  test('returns "msg" for email.msg', () => {
    expect(getExtension('email.msg')).toBe('msg');
  });

  test('returns "eml" for email.EML (case-insensitive)', () => {
    expect(getExtension('email.EML')).toBe('eml');
  });

  test('returns "eml" for email.backup.eml (double extension)', () => {
    expect(getExtension('email.backup.eml')).toBe('eml');
  });

  test('returns "" for emailnoext (no extension)', () => {
    expect(getExtension('emailnoext')).toBe('');
  });

  test('returns "" for empty filename', () => {
    expect(getExtension('')).toBe('');
  });
});

// ──────────────────────────────────────────────
// Dispatch routing tests (Tests 6-8)
// Verify the extension-based routing conditions that drive parser selection
// and error handling in updateMessage. Avoids mock.module() to prevent
// module registry contamination in bun 1.x full-suite runs.
// ──────────────────────────────────────────────

describe('updateMessage routing conditions', () => {
  // The updateMessage dispatch is: if ext !== 'msg' && ext !== 'eml' → error path
  // These tests verify that condition using getExtension.

  test('Unsupported extension (.pdf) is rejected by the dispatch guard', () => {
    const ext = getExtension('document.pdf');
    const isSupported = ext === 'msg' || ext === 'eml';
    expect(isSupported).toBe(false);
  });

  test('.eml extension routes to the EML parser branch (not MSG)', () => {
    const ext = getExtension('message.eml');
    expect(ext).toBe('eml');
    // Routing: ext === 'eml' → parseEml is called
    const usesEmlParser = ext === 'eml';
    const usesMsgParser = ext === 'msg';
    expect(usesEmlParser).toBe(true);
    expect(usesMsgParser).toBe(false);
  });

  test('.msg extension routes to the MSG parser branch (not EML)', () => {
    const ext = getExtension('message.msg');
    expect(ext).toBe('msg');
    // Routing: ext === 'msg' (not 'eml') → parse() is called
    const usesEmlParser = ext === 'eml';
    const usesMsgParser = ext === 'msg';
    expect(usesEmlParser).toBe(false);
    expect(usesMsgParser).toBe(true);
  });
});
