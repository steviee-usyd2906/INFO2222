import Link from "next/link";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent2/20">
          <svg
            className="h-8 w-8 text-accent2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We&apos;ve sent you a confirmation link to your email address. Please click the link to
          verify your account and get started.
        </p>

        <div className="mt-8">
          <Link
            href="/auth/login"
            className="btn inline-flex justify-center"
          >
            Back to Login
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted">
          Didn&apos;t receive the email? Check your spam folder or try signing up again.
        </p>
      </div>
    </div>
  );
}
