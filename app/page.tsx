import { dummyProjects } from "../src/data/dummyProjects";
import ProjectShelf from "../src/components/ProjectShelf";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-12">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent via-accent to-accent2 shadow-soft">
            <span className="text-background text-sm font-bold">M</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Mango Hi-Fi</h1>
            <p className="text-sm text-muted">Hi-fi prototype dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            className="input"
            placeholder="Search tracks, artists, devices..."
            aria-label="Search"
            type="text"
          />
          <button className="btn" type="button">
            Connect
          </button>
        </div>
      </header>

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-muted">Projects</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Your hi-fi prototypes</h2>
          </div>
          <p className="text-xs font-semibold text-muted">
            Scroll sideways to browse the shelf
          </p>
        </div>

        <ProjectShelf projects={dummyProjects} />
      </section>
    </main>
  );
}
