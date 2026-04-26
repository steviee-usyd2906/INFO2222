import { createComment } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: RouteContext<"/api/tasks/[taskId]/comments">,
) {
  try {
    const { taskId } = await context.params;
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json(
        { error: "Comment text is required." },
        { status: 400 },
      );
    }

    const project = await createComment(taskId, {
      user: typeof body.user === "string" ? body.user : "You",
      text,
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create comment.";
    return Response.json({ error: message }, { status: 500 });
  }
}
