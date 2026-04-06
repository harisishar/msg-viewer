// Run with: bun test --dom tests/entry-point.test.ts
import { describe, test, expect, mock } from 'bun:test';
import { getExtension } from '../lib/scripts/index';

// ──────────────────────────────────────────────
// Unit tests: getExtension (Tests 1-5)
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
// DOM dispatch tests: drop handler (Tests 6-8)
// ──────────────────────────────────────────────

// Mock modules before importing index so the drop handler uses mocked versions
const mockParseEml = mock(async (_source: string | ArrayBuffer) => ({
  content: {
    subject: 'EML Subject',
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    date: new Date(),
    body: 'body',
    bodyHTML: '',
    bodyRTF: undefined,
    headers: '',
  },
  attachments: [],
  recipients: [],
}));

const mockParse = mock((_view: DataView) => ({
  content: {
    subject: 'MSG Subject',
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    date: new Date(),
    body: 'body',
    bodyHTML: '',
    bodyRTF: undefined,
    headers: '',
  },
  attachments: [],
  recipients: [],
}));

const mockErrorFragment = mock((_message: string) => {
  return document.createDocumentFragment();
});

mock.module('../lib/scripts/eml/eml-parser', () => ({
  parseEml: mockParseEml,
}));

mock.module('@molotochok/msg-viewer', () => ({
  parse: mockParse,
}));

mock.module('../lib/components/error', () => ({
  errorFragment: mockErrorFragment,
}));

mock.module('../lib/components/message', () => ({
  messageFragment: mock((_msg: unknown, _cb: unknown) => document.createDocumentFragment()),
}));

describe('Drop handler dispatch (DOM)', () => {
  function setupDOM() {
    document.body.innerHTML = `
      <input type="file" id="file" />
      <div id="msg"></div>
    `;
  }

  function createMockFile(name: string): File {
    return new File(['content'], name, { type: 'application/octet-stream' });
  }

  function createDropEvent(file: File): DragEvent {
    const dt = new DataTransfer();
    dt.items.add(file);
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    return event;
  }

  test('Dropping a .pdf file calls errorFragment with unsupported-format message', async () => {
    setupDOM();
    mockErrorFragment.mockClear();

    const { default: _mod } = await import('../lib/scripts/index');

    const pdfFile = createMockFile('document.pdf');
    const dropEvent = createDropEvent(pdfFile);
    document.documentElement.dispatchEvent(dropEvent);

    // Allow async updateMessage to run
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockErrorFragment).toHaveBeenCalled();
    const callArgs = mockErrorFragment.mock.calls[0][0] as string;
    expect(callArgs).toContain('Unsupported file format');
  });

  test('Dropping a .eml file calls parseEml (not parse)', async () => {
    setupDOM();
    mockParseEml.mockClear();
    mockParse.mockClear();

    const { default: _mod } = await import('../lib/scripts/index');

    const emlFile = createMockFile('message.eml');
    const dropEvent = createDropEvent(emlFile);
    document.documentElement.dispatchEvent(dropEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockParseEml).toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
  });

  test('Dropping a .msg file calls parse (not parseEml)', async () => {
    setupDOM();
    mockParse.mockClear();
    mockParseEml.mockClear();

    const { default: _mod } = await import('../lib/scripts/index');

    const msgFile = createMockFile('message.msg');
    const dropEvent = createDropEvent(msgFile);
    document.documentElement.dispatchEvent(dropEvent);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockParse).toHaveBeenCalled();
    expect(mockParseEml).not.toHaveBeenCalled();
  });
});
