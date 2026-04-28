import { listEncryptedMessages, saveEncryptedMessage } from "@/lib/secure-chat";

export const dynamic = "force-dynamic";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId") ?? "";

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return Response.json(
        { error: "A valid conversationId is required." },
        { status: 400 },
      );
    }

    const messages = await listEncryptedMessages(conversationId);
    return Response.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load encrypted messages.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";
    const senderUsername =
      typeof body.senderUsername === "string" ? body.senderUsername : "";

    if (!conversationId || !UUID_REGEX.test(conversationId) || !senderUsername) {
      return Response.json(
        { error: "conversationId (uuid) and senderUsername are required." },
        { status: 400 },
      );
    }

    await saveEncryptedMessage({
      conversationId,
      senderUsername,
      encryptedContent: String(body.encryptedContent ?? ""),
      iv: String(body.iv ?? ""),
      authTag: String(body.authTag ?? ""),
      signature: String(body.signature ?? ""),
      senderKeyId: String(body.senderKeyId ?? ""),
      ratchetPublicKey:
        typeof body.ratchetPublicKey === "string"
          ? body.ratchetPublicKey
          : undefined,
      chainIndex:
        typeof body.chainIndex === "number" ? body.chainIndex : 0,
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save encrypted message.";
    return Response.json({ error: message }, { status: 500 });
  }
}
