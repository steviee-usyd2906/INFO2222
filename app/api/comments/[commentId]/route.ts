import { deleteComment, updateComment } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/comments/[commentId]">,
) {
  try {
    const { commentId } = await context.params;
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json(
        { error: "Comment text is required." },
        { status: 400 },
      );
    }

    const project = await updateComment(commentId, { text });
    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update comment.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/comments/[commentId]">,
) {
  try {
    const { commentId } = await context.params;
    const project = await deleteComment(commentId);
    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete comment.";
    return Response.json({ error: message }, { status: 500 });
  }
}
