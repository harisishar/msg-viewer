import type { UnifiedMessage } from "../../scripts/types/unified-message";
import { createFragmentFromTemplate } from "../../scripts/utils/html-template-util";
import template from "./index.html" with { type: "text" };

export function embeddedMsgsFragment(message: UnifiedMessage, onClick: (embedded: UnifiedMessage) => void): DocumentFragment {
  const elements = message.attachments
    .filter(attachment => attachment.embeddedMessage)
    .map(attachment => {
      const model: EmbeddedMsgViewModel = {
        name: attachment.displayName
      };

      const fragment = createFragmentFromTemplate(template, model);
      fragment.children[0].addEventListener("click", () => onClick(attachment.embeddedMessage!));
      return fragment;
    });

  const fragment = document.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}

interface EmbeddedMsgViewModel {
  name: string, 
}
