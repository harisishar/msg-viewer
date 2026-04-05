import type { UnifiedMessage } from "../../scripts/types/unified-message";
import { bytesWithUnits } from "../../scripts/utils/file-size-util";
import { createFragmentFromTemplate } from "../../scripts/utils/html-template-util";
import template from "./index.html" with { type: "text" };

export function attachmentsFragment(message: UnifiedMessage): DocumentFragment {
  const attachments = message.attachments
    .filter(attachment => attachment.content)
    .map(attachment => {
      const blob = new Blob([attachment.content], { type: 'application/octet-stream' });
    
      const model: AttachmentViewModel = { 
        name: attachment.displayName, 
        size: bytesWithUnits(attachment.content.byteLength).toString(), 
        url: URL.createObjectURL(blob) 
      };

      return createFragmentFromTemplate(template, model);
    });

  const fragment = document.createDocumentFragment();
  fragment.append(...attachments);
  return fragment;
}

interface AttachmentViewModel {
  name: string, 
  size: string, 
  url: string
}
