'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent } from "react";
import type { Project } from "../data/dummyProjects";
import ProjectCard from "./ProjectCard";

type ProjectShelfProps = {
  projects: Project[];
};

export default function ProjectShelf({
  projects,
}: ProjectShelfProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );

  const lastId = useMemo(() => projects.at(-1)?.id ?? null, [projects]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;

    // Map vertical wheel/trackpad motion into horizontal scroll for the shelf.
    // Prevents "scroll the page vertically" feeling while interacting with the carousel.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const candidate = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        const id = candidate?.target.getAttribute("data-project-id");
        if (id) setActiveProjectId(id);
      },
      {
        root,
        threshold: [0.55, 0.7, 0.85],
      },
    );

    for (const el of itemRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [projects]);

  return (
    <div className="relative">
      {/* Edge fades to sell the "shelf" interaction */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-14 bg-gradient-to-r from-[color:var(--background)] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-14 bg-gradient-to-l from-[color:var(--background)] to-transparent" />

      <div
        ref={scrollerRef}
        onWheel={handleWheel}
        className="relative overflow-x-auto overflow-y-hidden pb-3 scroll-smooth overscroll-x-contain"
        style={{ scrollbarGutter: "stable" }}
        role="region"
        aria-label="Projects shelf"
      >
        <div className="flex h-[270px] items-stretch snap-x snap-mandatory overflow-visible px-2 sm:px-6">
          {projects.map((project, i) => {
            const overlapClass = i === 0 ? "ml-0" : "-ml-12 sm:-ml-14";
            const edgeCentering =
              i === 0
                ? "ml-[calc(50%-145px)]"
                : project.id === lastId
                  ? "mr-[calc(50%-145px)]"
                  : "";
            const isActive = activeProjectId === project.id;
            return (
              <div
                key={project.id}
                ref={(el) => {
                  if (!el) {
                    itemRefs.current.delete(project.id);
                    return;
                  }
                  itemRefs.current.set(project.id, el);
                }}
                data-project-id={project.id}
                className={`flex w-[290px] flex-shrink-0 snap-center ${overlapClass} ${edgeCentering} transition-[transform,opacity,filter] duration-300 ease-out ${
                  isActive ? "opacity-100" : "opacity-80"
                }`}
                style={{ zIndex: isActive ? projects.length + 10 : projects.length - i }}
              >
                <ProjectCard
                  project={project}
                  href={`/projects/${project.id}`}
                  className={`h-full ${
                    isActive
                      ? "translate-y-0 scale-[1.02]"
                      : "translate-y-[2px] scale-[0.985]"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

