import { deleteTask, updateTask } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/tasks/[taskId]">,
) {
  try {
    const { taskId } = await context.params;
    const body = await request.json();

    const project = await updateTask(taskId, {
      title: typeof body.title === "string" ? body.title : undefined,
      assignedUser:
        typeof body.assignedUser === "string" ? body.assignedUser : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
      progressPercentage:
        typeof body.progressPercentage === "number"
          ? body.progressPercentage
          : undefined,
      completed:
        typeof body.completed === "boolean" ? body.completed : undefined,
    });

    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update task.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/tasks/[taskId]">,
) {
  try {
    const { taskId } = await context.params;
    const project = await deleteTask(taskId);
    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete task.";
    return Response.json({ error: message }, { status: 500 });
  }
}
