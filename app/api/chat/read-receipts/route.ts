import { markMessagesRead } from "@/lib/secure-chat";

export const dynamic = "force-dynamic";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const messageIds = Array.isArray(body.messageIds)
      ? body.messageIds.filter(
          (id: unknown): id is string => typeof id === "string",
        )
      : [];

    if (!UUID_REGEX.test(conversationId) || !username) {
      return Response.json(
        { error: "Valid conversationId and username are required." },
        { status: 400 },
      );
    }

    await markMessagesRead(conversationId, username, messageIds);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to store read receipts.";
    return Response.json({ error: message }, { status: 500 });
  }
}
