"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import ProjectShelf from "../src/components/ProjectShelf";

interface ProjectTask {
  id: string;
  title: string;
  progressPercentage: number;
  assignedUser: string;
  completed: boolean;
  dueDate: string;
  comments: { id: string; userName: string; text: string }[];
}

interface Project {
  id: string;
  name: string;
  shortDescription: string;
  progressPercentage: number;
  tasks: ProjectTask[];
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  
  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTasks, setNewProjectTasks] = useState<{ title: string; assignedUser: string; dueDate: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Check auth state and load projects
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoadingAuth(false);
      
      if (user) {
        await loadProjects();
      } else {
        setIsLoadingProjects(false);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProjects();
      } else {
        setProjects([]);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isCreateModalOpen || isConnectModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCreateModalOpen, isConnectModalOpen]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    
    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (projectsError) {
      console.error("Error loading projects:", projectsError);
      setIsLoadingProjects(false);
      return;
    }
    
    // Load tasks for each project
    const projectsWithTasks: Project[] = await Promise.all(
      (projectsData || []).map(async (project) => {
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true });
        
        const tasks: ProjectTask[] = (tasksData || []).map((task) => ({
          id: task.id,
          title: task.title,
          progressPercentage: task.progress_percentage || 0,
          assignedUser: task.assigned_user || "Unassigned",
          completed: task.completed || false,
          dueDate: task.due_date || "TBD",
          comments: [],
        }));
        
        return {
          id: project.id,
          name: project.name,
          shortDescription: project.short_description || "",
          progressPercentage: project.progress_percentage || 0,
          tasks,
        };
      })
    );
    
    setProjects(projectsWithTasks);
    setIsLoadingProjects(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

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

  const addTaskField = () => {
    setNewProjectTasks((prev) => [...prev, { title: "", assignedUser: "", dueDate: "" }]);
  };

  const updateTaskField = (index: number, field: string, value: string) => {
    setNewProjectTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, [field]: value } : task))
    );
  };

  const removeTaskField = (index: number) => {
    setNewProjectTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    
    setIsCreating(true);
    
    // Create project in Supabase
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: newProjectName,
        short_description: newProjectDescription || "No description provided.",
        progress_percentage: 0,
        user_id: user.id,
      })
      .select()
      .single();
    
    if (projectError) {
      console.error("Error creating project:", projectError);
      setIsCreating(false);
      return;
    }
    
    // Create tasks in Supabase
    const tasksToCreate = newProjectTasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        project_id: projectData.id,
        title: t.title,
        assigned_user: t.assignedUser || "Unassigned",
        due_date: t.dueDate || "TBD",
        progress_percentage: 0,
        completed: false,
      }));
    
    if (tasksToCreate.length > 0) {
      await supabase.from("tasks").insert(tasksToCreate);
    }
    
    // Reload projects to get fresh data
    await loadProjects();
    
    setNewProjectName("");
    setNewProjectDescription("");
    setNewProjectTasks([]);
    setIsCreating(false);
    setIsCreateModalOpen(false);
  };

  // Show loading state
  if (isLoadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-accent2 border-t-transparent" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </main>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-accent via-accent to-accent2 shadow-soft">
            <span className="text-background text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mango Hi-Fi</h1>
          <p className="mt-2 text-sm text-muted">Sign in to access your hi-fi prototype dashboard</p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              className="btn w-full justify-center"
              onClick={() => router.push("/auth/login")}
            >
              Sign In
            </button>
            <button
              className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              onClick={() => router.push("/auth/sign-up")}
            >
              Create Account
            </button>
          </div>
        </div>
      </main>
    );
  }

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
            placeholder="Search projects..."
            aria-label="Search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)] flex items-center gap-2 whitespace-nowrap"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
          <button
            className="btn whitespace-nowrap"
            type="button"
            onClick={() => (isConnected ? handleDisconnect() : setIsConnectModalOpen(true))}
          >
            {isConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Connected
              </>
            ) : (
              "Connect"
            )}
          </button>
          <button
            className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)] flex items-center gap-2"
            type="button"
            onClick={handleLogout}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
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

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          onClick={() => !isCreating && setIsCreateModalOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-[16px] border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Create New Project</h2>
                <p className="text-sm text-muted mt-1">Add a new hi-fi prototype project</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                aria-label="Close"
                disabled={isCreating}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-5">
              {/* Project Name */}
              <div>
                <label className="text-xs font-semibold tracking-wide text-muted">PROJECT NAME *</label>
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="Enter project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>

              {/* Project Description */}
              <div>
                <label className="text-xs font-semibold tracking-wide text-muted">DESCRIPTION</label>
                <textarea
                  className="input mt-2 min-h-[80px] resize-none"
                  placeholder="Brief description of the project..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </div>

              {/* Tasks Section */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold tracking-wide text-muted">TASKS</label>
                  <button
                    type="button"
                    onClick={addTaskField}
                    className="flex items-center gap-1 rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Task
                  </button>
                </div>

                {newProjectTasks.length === 0 ? (
                  <div className="mt-3 rounded-[12px] border border-dashed border-border bg-[rgba(255,255,255,0.02)] p-6 text-center">
                    <p className="text-sm text-muted">No tasks added yet</p>
                    <p className="mt-1 text-xs text-muted">Click "Add Task" to create spec tasks</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3 max-h-[200px] overflow-auto">
                    {newProjectTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-3">
                            <input
                              type="text"
                              className="input py-2 text-sm"
                              placeholder="Task title..."
                              value={task.title}
                              onChange={(e) => updateTaskField(idx, "title", e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                className="input py-2 text-sm"
                                placeholder="Assigned to..."
                                value={task.assignedUser}
                                onChange={(e) => updateTaskField(idx, "assignedUser", e.target.value)}
                              />
                              <input
                                type="text"
                                className="input py-2 text-sm"
                                placeholder="Due date..."
                                value={task.dueDate}
                                onChange={(e) => updateTaskField(idx, "dueDate", e.target.value)}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTaskField(idx)}
                            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                            aria-label="Remove task"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border p-6 flex justify-end gap-3">
              <button
                className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                onClick={handleCreateProject}
                disabled={isCreating || !newProjectName.trim()}
              >
                {isCreating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
