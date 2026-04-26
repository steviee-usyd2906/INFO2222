import { createProject, listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listProjects();
    return Response.json({ projects });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load projects.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json(
        { error: "Project name is required." },
        { status: 400 },
      );
    }

    const project = await createProject({
      name,
      shortDescription:
        typeof body.shortDescription === "string" ? body.shortDescription : "",
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create project.";
    return Response.json({ error: message }, { status: 500 });
  }
}
