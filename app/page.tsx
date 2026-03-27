"use client";

import { useState, useMemo } from "react";
import { dummyProjects, type Project, type ProjectTask } from "../src/data/dummyProjects";
import ProjectShelf from "../src/components/ProjectShelf";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Create project modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>(dummyProjects);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.shortDescription.toLowerCase().includes(query) ||
        project.tasks.some(
          (task) =>
            task.title.toLowerCase().includes(query) ||
            task.assignedUser.toLowerCase().includes(query)
        )
    );
  }, [searchQuery, projects]);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsConnected(true);
    setIsConnecting(false);
    setIsConnectModalOpen(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: newProject.name.trim(),
      shortDescription: newProject.description.trim() || "New project description",
      progressPercentage: 0,
      tasks: [],
    };
    
    setProjects((prev) => [project, ...prev]);
    setNewProject({ name: "", description: "" });
    setIsCreating(false);
    setIsCreateModalOpen(false);
  };

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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="btn"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
          <button
            className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            type="button"
            onClick={() => (isConnected ? handleDisconnect() : setIsConnectModalOpen(true))}
          >
            {isConnected ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse mr-2" />
                Connected
              </>
            ) : (
              "Connect"
            )}
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
            {searchQuery ? `${filteredProjects.length} results` : "Scroll to find your project"}
          </p>
        </div>

        {filteredProjects.length > 0 ? (
          <ProjectShelf projects={filteredProjects} />
        ) : (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-foreground">No projects found</p>
            <p className="mt-2 text-sm text-muted">
              Try adjusting your search query
            </p>
            <button
              className="btn mt-4"
              type="button"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </button>
          </div>
        )}
      </section>

      {/* Connect Modal */}
      {isConnectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !isConnecting && setIsConnectModalOpen(false)}
        >
          <div
            className="card mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-foreground">Connect Device</h2>
            <p className="mt-2 text-sm text-muted">
              Connect your audio device to sync playback and control settings.
            </p>

            <div className="mt-6 space-y-3">
              <button
                className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Mango Studio</p>
                  <p className="text-xs text-muted">Local audio interface</p>
                </div>
                {isConnecting && (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent2 border-t-transparent" />
                )}
              </button>

              <button
                className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface2">
                  <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Bluetooth Device</p>
                  <p className="text-xs text-muted">Scan for nearby devices</p>
                </div>
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                disabled={isConnecting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
