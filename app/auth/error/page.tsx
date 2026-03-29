import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <svg
            className="h-8 w-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground">Authentication Error</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Something went wrong during authentication. This could be due to an expired link,
          invalid credentials, or a temporary issue.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="btn inline-flex justify-center"
          >
            Try Again
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[rgba(255,255,255,0.06)]"
          >
            Create New Account
          </Link>
        </div>
      </div>
    </div>
  );
}
