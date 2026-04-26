import { notFound } from "next/navigation";
import Link from "next/link";
import { dummyProjects } from "../../../src/data/dummyProjects";
import ProjectDetailControlPanel from "../../../src/components/ProjectDetailControlPanel";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const project = dummyProjects.find((p) => p.id === projectId);

  if (!project) notFound();

  const completedCount = project.tasks.filter((t) => t.completed).length;

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-8 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden="true" className="text-muted">
                ←
              </span>
              Dashboard
            </Link>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[rgba(255,255,255,0.25)]" />
            <p className="text-sm font-semibold text-muted">Project</p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {project.name}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {project.shortDescription}{" "}
            <span className="font-semibold text-foreground/90">
              {completedCount}/{project.tasks.length}
            </span>{" "}
            tasks complete.
          </p>
        </header>

        <ProjectDetailControlPanel project={project} />
      </main>

      {/* Bottom-left corner chat bubble */}
      <button
        type="button"
        aria-label="Chat"
        className="fixed bottom-5 left-0 z-50 ml-4 flex h-12 w-28 items-center justify-center rounded-r-full rounded-l-none border border-[rgba(96,165,250,0.28)] bg-[rgba(96,165,250,0.10)] px-4 text-sm font-semibold text-foreground shadow-[0_22px_70px_rgba(96,165,250,0.18)] backdrop-blur-sm transition-transform duration-200 ease-out hover:translate-x-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent2" />
        Chat
      </button>
    </>
  );
}

