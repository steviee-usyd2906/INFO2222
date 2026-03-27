import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-8 py-12">
      <div className="card flex flex-col items-center p-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent2/20">
          <span className="text-4xl font-bold text-foreground">404</span>
        </div>
        
        <h1 className="mt-6 text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          The page you are looking for does not exist or has been moved. Check the URL or return to the dashboard.
        </p>
        
        <Link
          href="/"
          className="btn mt-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
