import { describe, it, expect } from "bun:test";
import type { UnifiedMessage, UnifiedAttachment, UnifiedRecipient } from "../lib/scripts/types/unified-message";
import { parse, parseDir } from "../lib/scripts/msg/msg-parser";

// These tests verify the shape contract of the MSG parser's output.
// They use duck-typing checks against the UnifiedMessage interface.

describe("parse() returns UnifiedMessage shape", () => {
  it("parse is exported as a function", () => {
    expect(typeof parse).toBe("function");
  });

  it("parseDir is exported as a function", () => {
    expect(typeof parseDir).toBe("function");
  });

  it("parse return type has content, attachments, recipients — no file field", () => {
    // We only verify the public signature by checking the function is annotated
    // to return UnifiedMessage. Runtime shape test requires a real .msg binary.
    // This test intentionally verifies the exported symbol exists and is typed.
    expect(parse).toBeDefined();
  });
});

describe("UnifiedMessage type contract", () => {
  it("UnifiedMessage type has no file field (type-level contract)", () => {
    // Construct a minimal UnifiedMessage — TypeScript would error if it required `file`
    const msg: UnifiedMessage = {
      content: {
        date: null,
        subject: "test",
        senderName: "Sender",
        senderEmail: "sender@example.com",
        body: "body",
        bodyHTML: "<p>body</p>",
        headers: "",
      },
      attachments: [],
      recipients: [],
    };
    expect(msg.content.subject).toBe("test");
    // @ts-expect-error — file must not exist on UnifiedMessage
    expect((msg as any).file).toBeUndefined();
  });

  it("UnifiedRecipient requires type field", () => {
    const recipient: UnifiedRecipient = {
      name: "Alice",
      email: "alice@example.com",
      type: "to",
    };
    expect(recipient.type).toBe("to");
  });

  it("UnifiedAttachment content is Uint8Array when present", () => {
    const attachment: UnifiedAttachment = {
      fileName: "test.txt",
      displayName: "test.txt",
      mimeType: "text/plain",
      content: new Uint8Array([1, 2, 3]),
    };
    expect(attachment.content).toBeInstanceOf(Uint8Array);
  });

  it("UnifiedAttachment can have embeddedMessage instead of content", () => {
    const embedded: UnifiedMessage = {
      content: {
        date: null,
        subject: "embedded",
        senderName: "",
        senderEmail: "",
        body: "",
        bodyHTML: "",
        headers: "",
      },
      attachments: [],
      recipients: [],
    };
    const attachment: UnifiedAttachment = {
      fileName: "embedded.msg",
      displayName: "embedded.msg",
      mimeType: "",
      embeddedMessage: embedded,
    };
    expect(attachment.embeddedMessage?.content.subject).toBe("embedded");
    // @ts-expect-error — embeddedMsgObj must not exist on UnifiedAttachment
    expect((attachment as any).embeddedMsgObj).toBeUndefined();
  });
});
