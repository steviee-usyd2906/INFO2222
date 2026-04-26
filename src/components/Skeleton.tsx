type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-[12px] bg-[rgba(255,255,255,0.06)] ${className ?? ""}`}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="card flex w-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-5 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="text-right">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-1 h-4 w-8" />
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-1 w-1 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-3 h-4 w-96" />
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_360px]">
        {/* Left sidebar skeleton */}
        <aside className="card p-6">
          <Skeleton className="h-3 w-16" />
          <div className="mt-5 flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="mt-6 rounded-[14px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
            <Skeleton className="h-3 w-16" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Skeleton className="h-3 w-10" />
                <Skeleton className="mt-2 h-6 w-8" />
              </div>
              <div>
                <Skeleton className="h-3 w-10" />
                <Skeleton className="mt-2 h-6 w-8" />
              </div>
            </div>
          </div>
        </aside>

        {/* Center wheel skeleton */}
        <div className="card p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="mt-7 grid place-items-center">
            <Skeleton className="h-[300px] w-[300px] rounded-full" />
          </div>
        </div>

        {/* Right tasks skeleton */}
        <aside className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[16px] border border-border bg-[rgba(255,255,255,0.03)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-3 w-16" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-10 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
