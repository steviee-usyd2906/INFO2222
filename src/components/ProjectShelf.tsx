'use client';

import { useRef, useState, useCallback } from "react";
import type { WheelEvent } from "react";
import type { Project } from "../data/dummyProjects";
import Link from "next/link";

type ProjectShelfProps = {
  projects: Project[];
};

function ProgressRing({
  value,
  size = 56,
}: {
  value: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - clamped / 100);

  return (
    <div className="relative flex items-center justify-center">
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
          stroke="url(#progressGradient)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent2)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-bold text-foreground">{Math.round(value)}%</span>
    </div>
  );
}

export default function ProjectShelf({
  projects,
}: ProjectShelfProps) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(projects.length / 2));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef(false);

  // Handle wheel scroll to change active project
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (isScrolling.current) return;
    
    const delta = e.deltaY || e.deltaX;
    if (Math.abs(delta) < 10) return;
    
    e.preventDefault();
    isScrolling.current = true;
    
    setActiveIndex((prev) => {
      if (delta > 0) {
        return Math.min(prev + 1, projects.length - 1);
      } else {
        return Math.max(prev - 1, 0);
      }
    });
    
    // Debounce scroll
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  }, [projects.length]);

  // Calculate card styles based on distance from center
  const getCardStyle = (index: number) => {
    const distance = index - activeIndex;
    const absDistance = Math.abs(distance);
    
    // Scale: center is largest, decreases with distance
    const scale = Math.max(0.55, 1 - absDistance * 0.18);
    
    // Opacity: center is fully visible
    const opacity = Math.max(0.4, 1 - absDistance * 0.25);
    
    // Z-index: center is on top
    const zIndex = 100 - absDistance;
    
    // Horizontal offset for positioning
    const baseOffset = distance * 180;
    const translateX = baseOffset;
    
    // Slight vertical offset for non-center cards
    const translateY = absDistance * 8;

    return {
      transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
      opacity,
      zIndex,
    };
  };

  return (
    <div className="relative py-8">
      {/* Edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-[color:var(--background)] to-transparent z-[110]" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-[color:var(--background)] to-transparent z-[110]" />

      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative flex items-center justify-center h-[420px] overflow-hidden"
        role="region"
        aria-label="Projects carousel"
      >
        {projects.map((project, index) => {
          const isActive = index === activeIndex;
          const style = getCardStyle(index);
          
          return (
            <div
              key={project.id}
              className="absolute transition-all duration-500 ease-out"
              style={style}
            >
              <ProjectCarouselCard
                project={project}
                isActive={isActive}
              />
            </div>
          );
        })}
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center gap-2 mt-6">
        {projects.map((project, index) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? "w-8 bg-gradient-to-r from-accent to-accent2"
                : "w-2 bg-surface2 hover:bg-muted"
            }`}
            aria-label={`Go to ${project.name}`}
          />
        ))}
      </div>
      
      {/* Scroll hint */}
      <p className="text-center text-xs text-muted mt-4">
        Scroll to navigate through projects
      </p>
    </div>
  );
}

type ProjectCarouselCardProps = {
  project: Project;
  isActive: boolean;
};

function ProjectCarouselCard({ project, isActive }: ProjectCarouselCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className={`group card flex flex-col p-6 cursor-pointer transition-all duration-300 ${
        isActive
          ? "w-[320px] h-[360px] shadow-2xl"
          : "w-[260px] h-[300px]"
      }`}
    >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-muted">PROJECT</p>
            <h3 className={`mt-1 font-semibold text-foreground truncate ${
              isActive ? "text-xl" : "text-base"
            }`}>
              {project.name}
            </h3>
          </div>
        </div>

        {/* Description - only visible on active card */}
        {isActive && (
          <p className="text-sm leading-relaxed text-muted mb-4 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
            {project.shortDescription}
          </p>
        )}

        {/* Progress Ring - centered */}
        <div className="flex-1 flex items-center justify-center">
          <ProgressRing value={project.progressPercentage} size={isActive ? 80 : 56} />
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
              {project.tasks.length} tasks
            </span>
            {isActive && (
              <span className="rounded-full border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] font-semibold text-muted">
                {project.tasks.filter((t) => t.completed).length} done
              </span>
            )}
          </div>
        </div>

        </Link>
  );
}
