import DOMPurify from 'dompurify';
import PostalMime from 'postal-mime';
import type { UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient } from '../types/unified-message';

const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    // Text formatting
    'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'small', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code', 'hr',
    // Lists
    'ul', 'ol', 'li',
    // Tables (email newsletters)
    'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
    // Links and images
    'a', 'img',
    // Structure
    'div', 'span', 'center',
    // Definition lists
    'dl', 'dt', 'dd',
  ],
  ALLOWED_ATTR: [
    'style',           // Inline styles (standard in email HTML)
    'href',            // Links
    'src',             // Images (filtered by hook below)
    'alt', 'title',    // Accessibility
    'width', 'height', // Image/table sizing
    'border', 'cellpadding', 'cellspacing', // Table attributes
    'align', 'valign', // Layout (legacy email)
    'colspan', 'rowspan', // Table spanning
    'class',           // CSS class references
    'dir',             // Text direction
    'bgcolor', 'color', // Legacy color attributes
  ],
  ALLOW_DATA_ATTR: false,
};

function initSanitizer(): void {
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'src') {
      const val = data.attrValue.trim().toLowerCase();
      if (val.startsWith('http://') || val.startsWith('https://')) {
        data.attrValue = '';
        data.forceKeepAttr = false;
      }
    }
    if (data.attrName === 'href') {
      const val = data.attrValue.trim().toLowerCase();
      if (val.startsWith('javascript:') || val.startsWith('vbscript:')) {
        data.attrValue = '';
        data.forceKeepAttr = false;
      }
    }
  });
}

initSanitizer();

function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

export async function parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage> {
  try {
    const parser = new PostalMime();
    const email = await parser.parse(source);

    return {
      content: mapContent(email),
      attachments: mapAttachments(email),
      recipients: mapRecipients(email),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse EML file: ${msg}`);
  }
}

function mapContent(email: Awaited<ReturnType<PostalMime['parse']>>): UnifiedMessageContent {
  let body = email.text ?? '';
  let bodyHTML = email.html ? sanitizeHTML(email.html) : '';

  if (!body && !bodyHTML) {
    body = 'Body could not be parsed';
  }

  let date: Date | null = null;
  if (email.date) {
    const parsed = new Date(email.date);
    date = isNaN(parsed.getTime()) ? null : parsed;
  }

  const headers = Array.isArray(email.headers)
    ? email.headers.map(h => `${h.key}: ${h.value}`).join('\n')
    : '';

  return {
    date,
    subject: email.subject ?? '',
    senderName: email.from?.name ?? '',
    senderEmail: email.from?.address ?? '',
    body,
    bodyHTML,
    bodyRTF: undefined,
    headers,
  };
}

function mapRecipients(email: Awaited<ReturnType<PostalMime['parse']>>): UnifiedRecipient[] {
  const toRecipients: UnifiedRecipient[] = (email.to ?? []).map(addr => ({
    name: addr.name ?? '',
    email: addr.address ?? '',
    type: 'to' as const,
  }));

  const ccRecipients: UnifiedRecipient[] = (email.cc ?? []).map(addr => ({
    name: addr.name ?? '',
    email: addr.address ?? '',
    type: 'cc' as const,
  }));

  const bccRecipients: UnifiedRecipient[] = (email.bcc ?? []).map(addr => ({
    name: addr.name ?? '',
    email: addr.address ?? '',
    type: 'bcc' as const,
  }));

  return [...toRecipients, ...ccRecipients, ...bccRecipients];
}

function mapAttachments(email: Awaited<ReturnType<PostalMime['parse']>>): UnifiedAttachment[] {
  return (email.attachments ?? []).map(att => ({
    fileName: att.filename ?? '',
    displayName: att.filename ?? '',
    mimeType: att.mimeType ?? 'application/octet-stream',
    content: new Uint8Array(att.content),
    embeddedMessage: undefined,
  }));
}
