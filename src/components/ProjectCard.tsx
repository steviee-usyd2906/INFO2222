import type { Project } from "../data/dummyProjects";
import Link from "next/link";

type ProjectCardProps = {
  project: Project;
  href: string;
  className?: string;
};

function ProgressRing({
  value,
  size = 40,
}: {
  value: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 3.25;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - clamped / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(124,58,237,0.95)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        className="transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  );
}

export default function ProjectCard({ project, href, className }: ProjectCardProps) {
  return (
    <Link
      href={href}
      className={`group card flex w-full cursor-pointer flex-col gap-4 p-5 text-left transition-transform duration-200 ease-out hover:-translate-y-0.5 ${
        className ?? ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted">
            PROJECT
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">
            {project.name}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <ProgressRing value={project.progressPercentage} />
          <div className="text-right">
            <p className="text-xs font-semibold text-muted">Progress</p>
            <p className="text-sm font-bold text-foreground">
              {Math.round(project.progressPercentage)}%
            </p>
          </div>
        </div>
      </div>

      <p
        className="text-sm leading-relaxed text-muted [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
      >
        {project.shortDescription}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
            {project.tasks.length} tasks
          </span>
          <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
            {project.tasks.filter((t) => t.completed).length} done
          </span>
        </div>

        <span className="text-xs font-semibold text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Open
        </span>
      </div>
    </Link>
  );
}

