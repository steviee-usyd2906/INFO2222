import { createTask } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[projectId]/tasks">,
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return Response.json(
        { error: "Task title is required." },
        { status: 400 },
      );
    }

    const project = await createTask(projectId, {
      title,
      assignedUser:
        typeof body.assignedUser === "string" ? body.assignedUser : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create task.";
    return Response.json({ error: message }, { status: 500 });
  }
}
