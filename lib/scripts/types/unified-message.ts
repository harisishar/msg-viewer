export interface UnifiedMessage {
  content: UnifiedMessageContent;
  attachments: UnifiedAttachment[];
  recipients: UnifiedRecipient[];
}

export interface UnifiedMessageContent {
  date: Date | null;
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;
  bodyHTML: string;
  bodyRTF?: DataView;
  headers: string;
}

export interface UnifiedAttachment {
  fileName: string;
  displayName: string;
  mimeType: string;
  content?: Uint8Array;
  embeddedMessage?: UnifiedMessage;
}

export interface UnifiedRecipient {
  name: string;
  email: string;
  type: 'to' | 'cc' | 'bcc';
}
