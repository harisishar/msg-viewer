import type { UnifiedMessage, UnifiedRecipient } from "../../scripts/types/unified-message";
import { createFragmentFromTemplate } from "../../scripts/utils/html-template-util";
import template from "./index.html" with { type: "text" };

export function recipientsFragments(message: UnifiedMessage): DocumentFragment[] {
  const to = message.recipients.filter(r => r.type === 'to');
  const cc = message.recipients.filter(r => r.type === 'cc');
  return [recipientHTML(to), recipientHTML(cc)];
}

function recipientHTML(recipients: UnifiedRecipient[]): DocumentFragment {
  const recipFragments = recipients.map(recipient => {
    const model: RecipientViewModel = { 
      name: recipient.name, 
      email: recipient.email ? `&lt;${recipient.email}&gt;` : "" 
    };

    return createFragmentFromTemplate(template, model);
  });

  const fragment = document.createDocumentFragment();
  fragment.append(...recipFragments);
  return fragment;
}

interface RecipientViewModel {
  name: string,
  email: string
}