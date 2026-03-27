'use client';

import { useEffect, useId, useMemo, useState } from "react";
import type { ProjectTask } from "../data/dummyProjects";

type ProgressWheelProps = {
  value: number;
  tasks?: ProjectTask[];
  size?: number;
};

type TaskGroup = {
  label: string;
  tasks: ProjectTask[];
  weightPercentage: number;
  groupProgressPercentage: number;
  color: string;
};

const GROUP_COLORS = [
  "rgba(124,58,237,0.95)", // purple
  "rgba(96,165,250,0.95)", // blue
  "rgba(34,211,238,0.95)", // cyan
  "rgba(236,72,153,0.90)", // pink
  "rgba(167,139,250,0.95)", // lilac
] as const;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function clamp100(v: number) {
  return Math.max(0, Math.min(100, v));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function groupTasksByAssignedUser(tasks: ProjectTask[]) {
  const map = new Map<string, ProjectTask[]>();
  for (const t of tasks) {
    const key = t.assignedUser || "Unassigned";
    const arr = map.get(key);
    if (arr) arr.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()].map(([label, groupTasks]) => ({
    label,
    tasks: groupTasks,
  }));
}

export default function ProgressWheel({ value, tasks, size = 300 }: ProgressWheelProps) {
  const gradientId = useId().replace(/:/g, "");
  const [animatedValue, setAnimatedValue] = useState(0);

  const target = clamp100(value);

  useEffect(() => {
    let raf = 0;
    const durationMs = 900;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = clamp01((now - start) / durationMs);
      setAnimatedValue(target * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame((now) => {
      start = now;
      setAnimatedValue(0);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const groups: TaskGroup[] = useMemo(() => {
    if (!tasks?.length) return [];

    const grouped = groupTasksByAssignedUser(tasks);
    const totalTasks = tasks.length;

    return grouped.map((g, i) => {
      const weightPercentage = (g.tasks.length / totalTasks) * 100;
      const avg =
        g.tasks.reduce((acc, t) => acc + clamp100(t.progressPercentage), 0) / g.tasks.length;
      return {
        label: g.label,
        tasks: g.tasks,
        weightPercentage,
        groupProgressPercentage: avg,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
      };
    });
  }, [tasks]);

  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 7; // in path-length units; small gap between groups

  // Base overall progress ring
  const overallDashOffset = c * (1 - animatedValue / 100);

  // Group segments are drawn as independent arcs (background + filled portion)
  const groupArcs = useMemo(() => {
    return groups.reduce<
      {
        label: string;
        tasks: ProjectTask[];
        weightPercentage: number;
        groupProgressPercentage: number;
        color: string;
        segLen: number;
        segStartOffset: number;
        segFillLen: number;
      }[]
    >((acc, g) => {
      const prev = acc.at(-1);
      const segStartOffset = prev
        ? prev.segStartOffset + (c * prev.weightPercentage) / 100
        : 0;

      const segLenRaw = (c * g.weightPercentage) / 100;
      const segLen = Math.max(0, segLenRaw - gap);
      const segFillLen =
        segLen * (animatedValue / 100) * (g.groupProgressPercentage / 100);

      acc.push({
        ...g,
        segLen,
        segStartOffset,
        segFillLen,
      });
      return acc;
    }, []);
  }, [animatedValue, c, gap, groups]);

  return (
    <div className="relative grid place-items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-[0_34px_110px_rgba(124,58,237,0.22)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`mangoOverall-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(124,58,237,0.95)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.95)" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* Group arcs sit on top and add multi-color meaning */}
        {groupArcs.map((g) => (
          <g key={g.label}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${g.segLen} ${c}`}
              strokeDashoffset={-g.segStartOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={g.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${g.segFillLen} ${c}`}
              strokeDashoffset={-g.segStartOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </g>
        ))}

        {/* Overall ring (ties it together visually) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#mangoOverall-${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={overallDashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          opacity={groups.length ? 0.18 : 1}
        />

        {/* Inner glass */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - 30}
          fill="rgba(255,255,255,0.035)"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="text-xs font-semibold tracking-[0.22em] text-muted">PROJECT</p>
        <p className="mt-2 text-6xl font-semibold tracking-tight text-foreground">
          {Math.round(animatedValue)}%
        </p>
        <p className="mt-3 text-sm font-semibold text-muted">
          Overall completion
        </p>

        {groups.length ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 px-8">
            {groups.slice(0, 4).map((g) => (
              <span
                key={g.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[11px] font-semibold text-muted"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: g.color }}
                />
                {g.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

