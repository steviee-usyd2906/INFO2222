import { deleteProject, getProject, updateProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]">,
) {
  try {
    const { projectId } = await context.params;
    const project = await getProject(projectId);

    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load project.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[projectId]">,
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();

    const project = await updateProject(projectId, {
      name: typeof body.name === "string" ? body.name : undefined,
      shortDescription:
        typeof body.shortDescription === "string"
          ? body.shortDescription
          : undefined,
    });

    return Response.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update project.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]">,
) {
  try {
    const { projectId } = await context.params;
    await deleteProject(projectId);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete project.";
    return Response.json({ error: message }, { status: 500 });
  }
}
