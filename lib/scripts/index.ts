import { messageFragment } from "../components/message";
import { errorFragment } from "../components/error";
import type { UnifiedMessage } from "./types/unified-message";
import { parse } from "@molotochok/msg-viewer";
import { parseEml } from "./eml/eml-parser";

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

// DOM initialisation — only runs in a browser context (not in test runners)
if (typeof document !== 'undefined') {
  const $file = document.getElementById("file")!;

  $file.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    if (target?.files?.length === 0) return;
    updateMessage(target.files!);
  });

  // To reset the file input
  $file.addEventListener("click", (event) => (event.target as HTMLInputElement).value = "");

  const target = document.documentElement;
  target.addEventListener("dragover", (event) => event.preventDefault());
  target.addEventListener("drop", (event) => {
    event.preventDefault();

    const files = event.dataTransfer!.files;
    if (files.length == 0) return;

    const $file = document.getElementById("file")! as HTMLInputElement;
    $file.files = files;
    updateMessage(files);
  });
}

export async function updateMessage(files: FileList) {
  const file = files[0];
  const ext = getExtension(file.name);
  const $msg = document.getElementById("msg")!;

  if (ext !== 'msg' && ext !== 'eml') {
    $msg.replaceChildren(errorFragment("Unsupported file format. Please select a .msg or .eml file."));
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  let message: UnifiedMessage;
  try {
    if (ext === 'eml') {
      message = await parseEml(arrayBuffer);
    } else {
      message = parse(new DataView(arrayBuffer));
    }
  } catch (e) {
    window.gtag('event', 'exception', { description: e, fatal: true });
    $msg.replaceChildren(errorFragment(`An error occurred during the parsing of the email file. Error: ${e}`));
    return;
  }

  renderMessage($msg, () => message, (fragment) => $msg.replaceChildren(fragment));
}

function renderMessage($msg: HTMLElement, getMessage: () => UnifiedMessage, updateDom: (fragment: DocumentFragment) => void) {
  let fragment: DocumentFragment;
  try {
    const message = getMessage();
    fragment = messageFragment(message, (embedded: UnifiedMessage) => {
      renderMessage($msg,
        () => embedded,
        (fragment) => {
          for (let i = 0; i < $msg.children.length; i++) {
            const child = $msg.children[i] as HTMLElement;
            child.classList.add("hidden");
          };
          $msg.appendChild(fragment)
        }
      );
    });
  } catch (e) {
    window.gtag('event', 'exception', { description: e, fatal: true });
    fragment = errorFragment(`An error occurred during the parsing of the email file. Error: ${e}`);
  }

  updateDom(fragment);
}
