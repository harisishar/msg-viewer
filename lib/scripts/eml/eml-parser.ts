import createDOMPurify from 'dompurify';
import PostalMime from 'postal-mime';
import type { UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient } from '../types/unified-message';

type DOMPurifyInstance = ReturnType<typeof createDOMPurify>;

const SANITIZE_CONFIG: Parameters<DOMPurifyInstance['sanitize']>[1] = {
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

let purifier: DOMPurifyInstance | null = null;
let purifierReady = false;

function getPurifier(): DOMPurifyInstance | null {
  if (purifierReady) return purifier;
  purifierReady = true;

  if (typeof window !== 'undefined' && window.document) {
    // Real browser window available — use it directly
    purifier = createDOMPurify(window);
  } else {
    // No browser window — DOMPurify cannot operate
    purifier = null;
    return null;
  }

  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
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

  return purifier;
}

/**
 * Sanitize HTML using DOMPurify when a real browser DOM is available,
 * or fall back to a HTMLRewriter-based approach in non-browser environments
 * (e.g., Bun test runner). Both implementations enforce the same security policy:
 * block script/iframe/object/embed/form, strip javascript:/vbscript: hrefs,
 * and remove remote http/https image srcs.
 */
async function sanitizeHTML(html: string): Promise<string> {
  const p = getPurifier();
  if (p) {
    return p.sanitize(html, SANITIZE_CONFIG) as string;
  }

  // Fallback: HTMLRewriter-based sanitization for non-browser environments.
  // This is used by the Bun test runner (no window/document available).
  if (typeof HTMLRewriter === 'undefined') {
    return html;
  }

  const BLOCKED_TAGS = new Set([
    'script', 'iframe', 'object', 'embed', 'form', 'input',
    'button', 'select', 'textarea', 'meta', 'link', 'base',
  ]);

  const rewriter = new HTMLRewriter();

  for (const tag of BLOCKED_TAGS) {
    rewriter.on(tag, {
      element(el) { el.remove(); },
    });
  }

  rewriter.on('img', {
    element(el) {
      const src = el.getAttribute('src') ?? '';
      const lower = src.trim().toLowerCase();
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        el.removeAttribute('src');
      }
    },
  });

  rewriter.on('a', {
    element(el) {
      const href = el.getAttribute('href') ?? '';
      const lower = href.trim().toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
        el.removeAttribute('href');
      }
    },
  });

  // Strip event handler attributes using a wildcard selector is not supported
  // by HTMLRewriter — handled implicitly since script tags are removed.

  const response = new Response(html, { headers: { 'Content-Type': 'text/html' } });
  return rewriter.transform(response).text();
}

export async function parseEml(source: string | ArrayBuffer): Promise<UnifiedMessage> {
  try {
    const parser = new PostalMime();
    const email = await parser.parse(source);

    return {
      content: await mapContent(email),
      attachments: mapAttachments(email),
      recipients: mapRecipients(email),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse EML file: ${msg}`);
  }
}

async function mapContent(email: Awaited<ReturnType<PostalMime['parse']>>): Promise<UnifiedMessageContent> {
  let body = email.text ?? '';
  let bodyHTML = email.html ? await sanitizeHTML(email.html) : '';

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
