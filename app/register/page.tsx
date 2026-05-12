'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  // Initialize Supabase client
  const supabase = createClient()

  const handleRegister = async () => {
    // Task 1.1 & 1.3: Secure Registration Logic
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert("Registration Error: " + error.message)
    } else {
      alert("Registration successful! You can now log in.")
      router.push('/login')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {/* Glassmorphism card from your globals.css */}
      <div className="card animate-in slide-in-from-bottom-2 w-full max-w-md p-8 flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Account</h1>
          <p className="text-muted text-sm mt-2">Join the Mango Community!</p>
        </header>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-left">
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label className="text-sm font-medium text-foreground">Password</label>
            <input 
              type="password" 
              placeholder="Minimum 6 characters" 
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button onClick={handleRegister} className="btn w-full">
          Sign Up
        </button>

        {/* Redirect to Login */}
        <div className="text-center text-sm mt-2">
          <span className="text-muted">Already have an account? </span>
          <Link href="/login" className="text-accent2 hover:underline font-medium transition-all">
            Sign In
          </Link>
        </div>

        <footer className="text-center text-[10px] text-muted uppercase tracking-widest mt-2">
          Ready to explore? Join us and be part of the Mango Community! 🍊
        </footer>
      </div>
    </main>
  )
}
