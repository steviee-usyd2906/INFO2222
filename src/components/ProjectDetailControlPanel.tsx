'use client';

import { useMemo, useState } from "react";
import type { Project, ProjectTask } from "../data/dummyProjects";
import ProgressWheel from "./ProgressWheel";

type ProjectDetailControlPanelProps = {
  project: Project;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function getWheelProgress(tasks: ProjectTask[]) {
  if (!tasks.length) return 0;
  // Overall progress as average of per-task progressPercentage.
  const avg = tasks.reduce((acc, t) => acc + Math.max(0, Math.min(100, t.progressPercentage)), 0) / tasks.length;
  return Math.round(avg);
}

export default function ProjectDetailControlPanel({
  project,
}: ProjectDetailControlPanelProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>(project.tasks);
  const [dropActive, setDropActive] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.completed) return t;

        return {
          ...t,
          completed: true,
          // Prototype behavior: completing a task jumps its progress to 100%.
          progressPercentage: 100,
        };
      }),
    );
  };

  const completedCount = useMemo(
    () => tasks.filter((t) => t.completed).length,
    [tasks],
  );
  const wheelProgress = useMemo(() => getWheelProgress(tasks), [tasks]);
  const totalCount = tasks.length || 1;

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

  const dropHintOpacity = clamp01(wheelProgress / 100);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_360px]">
      {/* Left: actions */}
      <aside className="card relative p-6 lg:sticky lg:top-10">
        <p className="text-xs font-semibold tracking-wide text-muted">ACTIONS</p>
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn w-full" type="button">
            Submit
          </button>
          <button
            className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(124,58,237,0.18)]"
            type="button"
          >
            Project Spec
          </button>
          <button
            className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)]"
            type="button"
          >
            My Tasks
          </button>
        </div>

        <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
          <p className="text-xs font-semibold text-muted">STATUS</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">Tasks</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {tasks.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Done</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {completedCount}
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
          // Allow dropping onto the wheel area.
          e.preventDefault();
          setDropActive(true);
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDropOnWheel}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted">
              OVERVIEW
            </p>
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
            {/* Drop overlay hint (subtle, not too big) */}
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
            <p className="mt-2 text-lg font-semibold text-foreground">
              Hi-fi demo
            </p>
          </div>
          <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-xs font-semibold text-muted">Mode</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Live</p>
          </div>
          <div className="rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-xs font-semibold text-muted">Health</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              Stable
            </p>
          </div>
        </div>

        {/* Small prototype hint */}
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
              Control checklist
            </p>
            <p className="mt-1 text-sm text-muted">
              {completedCount} / {totalCount} completed
            </p>
          </div>
          <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs font-semibold text-muted">
            {wheelProgress}%
          </span>
        </div>

        <div className="mt-6 flex max-h-[540px] flex-col gap-3 overflow-auto pr-1">
          {tasks.map((t) => {
            const progress = Math.round(
              Math.max(0, Math.min(100, t.progressPercentage)),
            );
            const isDragging = draggingTaskId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                draggable
                onDragStart={handleDragStartTask(t.id)}
                  onClick={() => {
                    // Avoid completing while a drag interaction is in progress.
                    if (draggingTaskId) return;
                    if (!t.completed) completeTask(t.id);
                  }}
                onDragEnd={() => {
                  setDraggingTaskId(null);
                  setDropActive(false);
                }}
                className={`group rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.30)] transition-transform duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(96,165,250,0.18)] ${
                  t.completed ? "opacity-80" : ""
                } ${isDragging ? "cursor-grabbing opacity-60 scale-[1.03] border-[rgba(96,165,250,0.55)] bg-[rgba(96,165,250,0.10)]" : "cursor-grab"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {t.assignedUser}
                    </p>
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
          })}
        </div>
      </aside>
    </section>
  );
}

