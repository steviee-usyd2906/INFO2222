import { ProjectCardSkeleton } from "../src/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-12">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent via-accent to-accent2 shadow-soft">
            <span className="text-background text-sm font-bold">M</span>
          </div>
          <div>
            <div className="h-5 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-1 h-4 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-64 animate-pulse rounded-[10px] bg-[rgba(255,255,255,0.06)]" />
          <div className="h-10 w-24 animate-pulse rounded-[12px] bg-[rgba(255,255,255,0.06)]" />
        </div>
      </header>

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-4 w-16 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            <div className="mt-2 h-6 w-40 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
          </div>
          <div className="h-4 w-48 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
        </div>

        <div className="flex gap-6 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-[290px] flex-shrink-0">
              <ProjectCardSkeleton />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
