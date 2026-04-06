import PostalMime from 'postal-mime';
import type { UnifiedMessage, UnifiedMessageContent, UnifiedAttachment, UnifiedRecipient } from '../types/unified-message';

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
  let bodyHTML = email.html ?? '';

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
