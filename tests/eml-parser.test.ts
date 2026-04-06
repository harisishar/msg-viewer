import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { parseEml } from '../lib/scripts/eml/eml-parser';

// Note: DOMPurify requires a DOM environment.
// Run this file with: bun test --dom tests/eml-parser.test.ts

const FIXTURES = 'tests/fixtures';

function readFixture(name: string): string {
  return readFileSync(`${FIXTURES}/${name}`, 'utf8');
}

describe('basic parsing (EML-01)', () => {
  test('parseEml returns object with content, attachments, recipients', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    expect(msg.content).toBeDefined();
    expect(Array.isArray(msg.attachments)).toBe(true);
    expect(Array.isArray(msg.recipients)).toBe(true);
  });
});

describe('header extraction (EML-02)', () => {
  test('subject, senderName, senderEmail, date are correctly mapped', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.subject).toBe('Test Email Subject');
    expect(msg.content.senderName).toBe('John Doe');
    expect(msg.content.senderEmail).toBe('john@example.com');
    expect(msg.content.date).toBeInstanceOf(Date);
    expect(msg.content.date?.getFullYear()).toBe(2026);
  });

  test('To recipient is mapped with correct name, email, and type', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    const toRecipient = msg.recipients.find(r => r.type === 'to');
    expect(toRecipient).toBeDefined();
    expect(toRecipient?.name).toBe('Jane Smith');
    expect(toRecipient?.email).toBe('jane@example.com');
  });

  test('CC recipient is mapped with type cc', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    const ccRecipient = msg.recipients.find(r => r.type === 'cc');
    expect(ccRecipient).toBeDefined();
    expect(ccRecipient?.email).toBe('bob@example.com');
  });
});

describe('RFC 2047 decoding (EML-03)', () => {
  test('encoded Subject is decoded to readable text', async () => {
    const emlString = readFixture('encoded-headers.eml');
    const msg = await parseEml(emlString);

    // Subject is =?UTF-8?Q?Re:_Caf=C3=A9_menu_=E2=80=93_updated?=
    // Should decode to: "Re: Café menu – updated"
    expect(msg.content.subject).toContain('Caf');
    expect(msg.content.subject).not.toContain('=?UTF-8?');
    expect(msg.content.subject).not.toContain('=?utf-8?');
  });

  test('encoded From name is decoded (not raw base64)', async () => {
    const emlString = readFixture('encoded-headers.eml');
    const msg = await parseEml(emlString);

    // From name is =?UTF-8?B?0JjQstCw0L0=?= (Cyrillic "Иван")
    expect(msg.content.senderName).not.toContain('=?UTF-8?B?');
    expect(msg.content.senderName).not.toContain('=?utf-8?b?');
    expect(msg.content.senderName.length).toBeGreaterThan(0);
  });
});

describe('plain text body (EML-04)', () => {
  test('plain text body is extracted correctly', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.body).toContain('plain text body');
  });
});

describe('HTML body with sanitization (EML-05, SEC-01)', () => {
  test('safe HTML tags are preserved', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML).toContain('World');
    expect(msg.content.bodyHTML).toContain('<b>');
    expect(msg.content.bodyHTML).toContain('<table');
  });

  test('script tags are stripped (SEC-01)', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML).not.toContain('<script');
    expect(msg.content.bodyHTML).not.toContain('</script>');
  });

  test('javascript: hrefs are stripped (SEC-01)', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML).not.toContain('javascript:');
  });

  test('alert from script tag is not present', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    // The script body itself should not appear
    expect(msg.content.bodyHTML).not.toContain("alert('xss')");
  });
});

describe('multipart/alternative preference (EML-06)', () => {
  test('bodyHTML is non-empty when HTML part is available', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML.length).toBeGreaterThan(0);
  });

  test('plain text body is also available as fallback', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.body.length).toBeGreaterThan(0);
    expect(msg.content.body).toContain('Plain text version');
  });
});

describe('attachment extraction (EML-07)', () => {
  test('attachments array has at least one entry for multipart/mixed email', async () => {
    const emlString = readFixture('multipart-mixed.eml');
    const msg = await parseEml(emlString);

    expect(msg.attachments.length).toBeGreaterThanOrEqual(1);
  });

  test('attachment filename is hello.txt', async () => {
    const emlString = readFixture('multipart-mixed.eml');
    const msg = await parseEml(emlString);

    expect(msg.attachments[0].fileName).toBe('hello.txt');
  });

  test('attachment content decodes to Hello, World!', async () => {
    const emlString = readFixture('multipart-mixed.eml');
    const msg = await parseEml(emlString);

    const content = msg.attachments[0].content;
    expect(content).toBeInstanceOf(Uint8Array);
    const decoded = new TextDecoder().decode(content);
    expect(decoded).toBe('Hello, World!');
  });
});

describe('remote image blocking (SEC-02)', () => {
  test('remote https:// image src is stripped', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML).not.toContain('https://tracker.example.com');
  });

  test('data: URI images are preserved', async () => {
    const emlString = readFixture('multipart.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyHTML).toContain('data:image/png');
  });
});

describe('bodyRTF is undefined for EML', () => {
  test('bodyRTF is always undefined for EML files', async () => {
    const emlString = readFixture('simple.eml');
    const msg = await parseEml(emlString);

    expect(msg.content.bodyRTF).toBeUndefined();
  });
});

describe('graceful degradation', () => {
  test('parseEml does not throw on minimal email with no body', async () => {
    let result: Awaited<ReturnType<typeof parseEml>> | null = null;
    let error: Error | null = null;

    try {
      result = await parseEml('From: test@test.com\r\n\r\n');
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeNull();
    expect(result).not.toBeNull();
    expect(result?.content.subject).toBe('');
  });

  test('parseEml body is a string (empty or fallback) for minimal email', async () => {
    const msg = await parseEml('From: test@test.com\r\n\r\n');

    expect(typeof msg.content.body).toBe('string');
    expect(typeof msg.content.bodyHTML).toBe('string');
  });
});
