"use client";

import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { useState, useMemo } from "react";
import { dummyProjects, type Project, type ProjectTask, type TaskComment } from "../../../src/data/dummyProjects";
import ProgressWheel from "../../../src/components/ProgressWheel";
import { ToastContainer, useToast } from "../../../src/components/Toast";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function getWheelProgress(tasks: ProjectTask[]) {
  if (!tasks.length) return 0;
  const avg = tasks.reduce((acc, t) => acc + Math.max(0, Math.min(100, t.progressPercentage)), 0) / tasks.length;
  return Math.round(avg);
}

type ChatMessage = {
  id: string;
  sender: "user" | "system";
  text: string;
  timestamp: Date;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const initialProject = dummyProjects.find((p) => p.id === projectId);

  if (!initialProject) {
    notFound();
  }

  const [tasks, setTasks] = useState<ProjectTask[]>(initialProject.tasks);
  const [dropActive, setDropActive] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  // Modal states
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Task detail modal state
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [newComment, setNewComment] = useState("");

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "system",
      text: `Welcome to the ${initialProject.name} project chat! How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Toast notifications
  const toast = useToast();

  const completeTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.completed) return;
    
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.completed) return t;
        return {
          ...t,
          completed: true,
          progressPercentage: 100,
        };
      })
    );
    
    toast.success(`Task "${task.title}" completed!`);
    
    // Update selected task if it's the one being completed
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, completed: true, progressPercentage: 100 });
    }
  };

  const addComment = (taskId: string, text: string) => {
    if (!text.trim()) return;
    
    const newCommentObj: TaskComment = {
      id: `comment-${Date.now()}`,
      user: "You",
      text: text.trim(),
      timestamp: new Date(),
    };
    
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          comments: [...t.comments, newCommentObj],
        };
      })
    );
    
    // Update selected task to show new comment
    if (selectedTask?.id === taskId) {
      setSelectedTask({
        ...selectedTask,
        comments: [...selectedTask.comments, newCommentObj],
      });
    }
    
    setNewComment("");
    toast.success("Comment added!");
  };

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const wheelProgress = useMemo(() => getWheelProgress(tasks), [tasks]);
  const totalCount = tasks.length || 1;

  // Get unique users for "My Tasks" filter
  const uniqueUsers = useMemo(() => {
    const users = new Set(tasks.map((t) => t.assignedUser));
    return Array.from(users);
  }, [tasks]);

  // Filter tasks based on selected user
  const displayedTasks = useMemo(() => {
    if (!showMyTasks || !selectedUser) return tasks;
    return tasks.filter((t) => t.assignedUser === selectedUser);
  }, [tasks, showMyTasks, selectedUser]);

  const handleDropOnWheel = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    completeTask(taskId);
    setDraggingTaskId(null);
  };

  const handleDragStartTask = (taskId: string) => (e: React.DragEvent) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    
    // Simulate system response
    setTimeout(() => {
      const responses = [
        "I understand. Let me check on that for you.",
        `The ${initialProject.name} project is currently at ${wheelProgress}% completion.`,
        "Great question! The team is making good progress on the remaining tasks.",
        "I can help you with that. What specific information do you need?",
        `There are ${totalCount - completedCount} tasks remaining in this project.`,
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const systemMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "system",
        text: randomResponse,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, systemMessage]);
    }, 1000);
  };

  const dropHintOpacity = clamp01(wheelProgress / 100);

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
                &larr;
              </span>
              Dashboard
            </Link>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[rgba(255,255,255,0.25)]" />
            <p className="text-sm font-semibold text-muted">Project</p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {initialProject.name}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {initialProject.shortDescription}{" "}
            <span className="font-semibold text-foreground/90">
              {completedCount}/{totalCount}
            </span>{" "}
            tasks complete.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_360px]">
          {/* Left: actions */}
          <aside className="card relative p-6 lg:sticky lg:top-10 h-fit">
            <p className="text-xs font-semibold tracking-wide text-muted">ACTIONS</p>
            <div className="mt-5 flex flex-col gap-2">
              <button 
                className="btn w-full" 
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
              >
                Submit
              </button>
              <button
                className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(124,58,237,0.18)]"
                type="button"
                onClick={() => setIsSpecModalOpen(true)}
              >
                Project Spec
              </button>
              <button
                className={`w-full rounded-[12px] border px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)] ${
                  showMyTasks
                    ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)]"
                    : "border-border bg-[rgba(255,255,255,0.03)]"
                }`}
                type="button"
                onClick={() => {
                  if (showMyTasks) {
                    setShowMyTasks(false);
                    setSelectedUser(null);
                  } else {
                    setShowMyTasks(true);
                  }
                }}
              >
                {showMyTasks ? "Show All Tasks" : "My Tasks"}
              </button>
            </div>

            {/* User filter when My Tasks is active */}
            {showMyTasks && (
              <div className="mt-4 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">FILTER BY USER</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uniqueUsers.map((user) => (
                    <button
                      key={user}
                      type="button"
                      onClick={() => setSelectedUser(selectedUser === user ? null : user)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        selectedUser === user
                          ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                          : "border-border bg-[rgba(255,255,255,0.03)] text-muted hover:text-foreground"
                      }`}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-xs font-semibold text-muted">STATUS</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted">Tasks</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {showMyTasks ? displayedTasks.length : tasks.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted">Done</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {showMyTasks ? displayedTasks.filter((t) => t.completed).length : completedCount}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Center: progress wheel (drag target) */}
          <div
            className={`card p-7 transition-transform duration-200 ${
              dropActive ? "scale-[1.01] ring-4 ring-[rgba(96,165,250,0.25)]" : ""
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
              e.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleDropOnWheel}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">OVERVIEW</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  Project progress wheel
                </p>
              </div>
              <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                {wheelProgress}%
              </span>
            </div>

            <div className="mt-7 grid place-items-center">
              <div className="relative">
                <ProgressWheel value={wheelProgress} tasks={tasks} />
                <div
                  className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200 ${
                    dropActive ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ background: `rgba(96,165,250,${0.08 + 0.12 * dropHintOpacity})` }}
                />
                <div
                  className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-200 ${
                    dropActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-2 rounded-full border border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.10)] px-4 py-2 text-xs font-semibold text-foreground shadow-[0_25px_80px_rgba(96,165,250,0.20)]">
                    Drop to complete
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Target</p>
                <p className="mt-2 text-lg font-semibold text-foreground">Hi-fi demo</p>
              </div>
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Mode</p>
                <p className="mt-2 text-lg font-semibold text-foreground">Live</p>
              </div>
              <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs font-semibold text-muted">Health</p>
                <p className="mt-2 text-lg font-semibold text-foreground">Stable</p>
              </div>
            </div>

            <p className="mt-5 text-center text-xs font-semibold text-muted">
              Drag a task here to complete it
            </p>
          </div>

          {/* Right: task boxes */}
          <aside className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">TASKS</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {showMyTasks && selectedUser ? `${selectedUser}'s tasks` : "Control checklist"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {showMyTasks
                    ? `${displayedTasks.filter((t) => t.completed).length} / ${displayedTasks.length} completed`
                    : `${completedCount} / ${totalCount} completed`}
                </p>
              </div>
              <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                {wheelProgress}%
              </span>
            </div>

            <div className="mt-6 flex max-h-[540px] flex-col gap-3 overflow-auto pr-1">
              {displayedTasks.length === 0 ? (
                <div className="rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-8 text-center">
                  <p className="text-sm font-semibold text-muted">No tasks found</p>
                  <p className="mt-1 text-xs text-muted">Select a different user or show all tasks</p>
                </div>
              ) : (
                displayedTasks.map((t) => {
                  const progress = Math.round(Math.max(0, Math.min(100, t.progressPercentage)));
                  const isDragging = draggingTaskId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      draggable={!t.completed}
                      onDragStart={t.completed ? undefined : handleDragStartTask(t.id)}
                      onClick={() => {
                        if (draggingTaskId) return;
                        setSelectedTask(t);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDropActive(false);
                      }}
                      className={`group rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.30)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)] ${
                        t.completed ? "opacity-80" : ""
                      } ${
                        isDragging
                          ? "cursor-grabbing opacity-60 scale-[1.03] border-[rgba(96,165,250,0.55)] bg-[rgba(96,165,250,0.10)]"
                          : t.completed
                          ? "cursor-pointer"
                          : "cursor-grab"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                          <p className="mt-1 text-xs font-semibold text-muted">{t.assignedUser}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
                            {progress}%
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              t.completed
                                ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                                : "border-border bg-[rgba(255,255,255,0.03)] text-muted"
                            }`}
                          >
                            {t.completed ? "Done" : "Active"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-300 ease-out group-hover:from-accent2 group-hover:to-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </section>
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="card mx-4 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-6">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-semibold tracking-wide text-muted">TASK</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{selectedTask.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {/* Task Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-xs font-semibold text-muted">ASSIGNED TO</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{selectedTask.assignedUser}</p>
                </div>
                <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-xs font-semibold text-muted">DUE DATE</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{selectedTask.dueDate}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted">PROGRESS</p>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                    selectedTask.completed
                      ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground"
                      : "border-border bg-[rgba(255,255,255,0.03)] text-muted"
                  }`}>
                    {selectedTask.completed ? "Done" : "Active"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                    style={{ width: `${selectedTask.progressPercentage}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">{selectedTask.progressPercentage}% complete</p>
              </div>

              {/* Comments Section */}
              <div className="mt-6">
                <p className="text-xs font-semibold tracking-wide text-muted">COMMENTS</p>
                <div className="mt-3 space-y-3 max-h-[200px] overflow-auto">
                  {selectedTask.comments.length === 0 ? (
                    <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-center">
                      <p className="text-sm text-muted">No comments yet</p>
                    </div>
                  ) : (
                    selectedTask.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{comment.user}</p>
                          <p className="text-xs text-muted">
                            {comment.timestamp.toLocaleDateString()}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addComment(selectedTask.id, newComment);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addComment(selectedTask.id, newComment)}
                    className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    disabled={!newComment.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Footer - Mark Done */}
            <div className="border-t border-border p-6">
              <button
                type="button"
                onClick={() => {
                  if (!selectedTask.completed) {
                    completeTask(selectedTask.id);
                  }
                }}
                disabled={selectedTask.completed}
                className={`flex w-full items-center justify-center gap-3 rounded-[12px] border px-4 py-3 text-sm font-semibold transition-colors ${
                  selectedTask.completed
                    ? "border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.12)] text-foreground cursor-default"
                    : "border-border bg-[rgba(255,255,255,0.03)] text-foreground hover:bg-[rgba(255,255,255,0.06)]"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                  selectedTask.completed
                    ? "border-accent2 bg-accent2"
                    : "border-muted"
                }`}>
                  {selectedTask.completed && (
                    <svg className="h-3 w-3 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {selectedTask.completed ? "Task Completed" : "Mark Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        type="button"
        aria-label="Chat"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-5 left-0 z-50 ml-4 flex h-12 w-28 items-center justify-center rounded-r-full rounded-l-none border border-[rgba(96,165,250,0.28)] bg-[rgba(96,165,250,0.10)] px-4 text-sm font-semibold text-foreground shadow-[0_22px_70px_rgba(96,165,250,0.18)] backdrop-blur-sm transition-transform duration-200 ease-out hover:translate-x-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent2" />
        Chat
      </button>

      {/* Submit Modal */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !isSubmitting && !submitSuccess && setIsSubmitModalOpen(false)}
        >
          <div className="card mx-4 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {submitSuccess ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(96,165,250,0.12)]">
                    <svg className="h-8 w-8 text-accent2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-foreground">Project Submitted!</h2>
                  <p className="mt-2 text-sm text-muted">
                    Your project has been submitted for review. You will receive feedback within 24-48 hours.
                  </p>
                  <button
                    className="btn mt-6"
                    type="button"
                    onClick={() => {
                      setIsSubmitModalOpen(false);
                      setSubmitSuccess(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground">Submit Project</h2>
                <p className="mt-2 text-sm text-muted">
                  Are you ready to submit this project for review? Make sure all tasks are completed.
                </p>

                <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{initialProject.name}</p>
                    <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
                      {wheelProgress}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                      style={{ width: `${wheelProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {completedCount} of {totalCount} tasks completed
                  </p>
                </div>

                {wheelProgress < 100 && (
                  <div className="mt-4 rounded-[14px] border border-[rgba(236,72,153,0.35)] bg-[rgba(236,72,153,0.08)] p-4">
                    <p className="text-sm text-foreground">
                      Warning: Some tasks are incomplete. You can still submit, but the project may require revisions.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button className="btn" type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Project"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Project Spec Modal */}
      {isSpecModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsSpecModalOpen(false)}
        >
          <div className="card mx-4 w-full max-w-2xl max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Project Specification</h2>
                <p className="mt-1 text-sm text-muted">{initialProject.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSpecModalOpen(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted">DESCRIPTION</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{initialProject.shortDescription}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted">OBJECTIVES</h3>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Deliver a polished hi-fi prototype ready for stakeholder review
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Ensure all interactive elements are functional and responsive
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent2" />
                    Maintain visual consistency with the established design system
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted">TASK BREAKDOWN</h3>
                <div className="mt-2 space-y-2">
                  {initialProject.tasks.map((task) => (
                    <div key={task.id} className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{task.title}</p>
                        <span className="text-xs text-muted">{task.assignedUser}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted">TIMELINE</h3>
                <p className="mt-2 text-sm text-foreground">
                  Target completion: 2 weeks from project start
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-0 left-0 z-50 m-4 w-80 sm:w-96">
          <div className="card flex h-[480px] flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent2 animate-pulse" />
                <p className="font-semibold text-foreground">Project Chat</p>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-[12px] px-3 py-2 text-sm ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-accent to-accent2 text-background"
                        : "bg-surface2 text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="btn px-4"
                  disabled={!chatInput.trim()}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );
}
