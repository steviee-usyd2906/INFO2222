'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const [showUpload, setShowUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUpload(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const newFiles = Array.from(files).map((f) => f.name);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
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

        {/* Upload Material Button - only on active card */}
        {isActive && (
          <button
            type="button"
            onClick={handleUploadClick}
            className="mt-4 flex items-center justify-center gap-2 w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:border-accent/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Material
          </button>
        )}
      </Link>

      {/* Upload Modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUpload(false)}
        >
          <div
            className="card mx-4 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Upload Material</h2>
                <p className="text-sm text-muted mt-1">Add files to {project.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-foreground"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload Area */}
            <label
              className={`flex flex-col items-center justify-center w-full h-40 rounded-[14px] border-2 border-dashed transition-colors cursor-pointer ${
                isUploading
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50 hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent2 border-t-transparent" />
                  <p className="text-sm text-muted">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2">
                    <svg className="h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Click to upload</p>
                    <p className="text-xs text-muted mt-1">or drag and drop files here</p>
                  </div>
                </div>
              )}
            </label>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted mb-2">UPLOADED FILES</p>
                <div className="space-y-2 max-h-32 overflow-auto">
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-[10px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-2"
                    >
                      <svg className="h-4 w-4 text-accent2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-foreground truncate flex-1">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                type="button"
                onClick={() => setShowUpload(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
