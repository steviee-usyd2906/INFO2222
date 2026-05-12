'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link' // Import Link for navigation
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const supabase = createClient()

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      alert("Login Error: " + error.message)
    } else {
      router.replace('/')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card animate-in slide-in-from-bottom-2 w-full max-w-md p-8 flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Login</h1>
          <p className="text-muted text-sm mt-2">Welcome back to the Mango Community!</p>
        </header>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button onClick={handleLogin} className="btn w-full">
          Sign In
        </button>

        {/* Navigation to Register */}
        <div className="text-center text-sm">
          <span className="text-muted">Don&apos;t have an account? </span>
          <Link href="/register" className="text-accent2 hover:underline font-medium transition-all">
            Sign Up
          </Link>
        </div>

        <footer className="text-center text-[10px] text-muted uppercase tracking-widest mt-2">
          SAVE YOUR MANGOES! remember to keep them fresh! 🍊
        </footer>
      </div>
    </main>
  )
}
