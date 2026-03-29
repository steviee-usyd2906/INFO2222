"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${window.location.origin}/`,
        data: {
          display_name: displayName || email.split("@")[0],
        },
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/auth/sign-up-success");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          <p className="mt-2 text-sm text-muted">Sign up to start managing your projects</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-5">
          {error && (
            <div className="rounded-[12px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="text-xs font-semibold tracking-wide text-muted">
              DISPLAY NAME
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input mt-2"
              placeholder="Enter your name..."
            />
          </div>

          <div>
            <label htmlFor="email" className="text-xs font-semibold tracking-wide text-muted">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-2"
              placeholder="Enter your email..."
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-semibold tracking-wide text-muted">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-2"
              placeholder="Create a password..."
              required
              minLength={6}
            />
            <p className="mt-1 text-xs text-muted">Must be at least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn w-full justify-center"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-accent2 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
