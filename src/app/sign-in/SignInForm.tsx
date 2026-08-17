"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "../lib/auth-client"
import { Button } from "../components/Button"

export function SignInForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (mode === "sign-up" && password !== passwordConfirmation) {
      setError("Passwords do not match")
      return
    }
    setPending(true)
    const result = mode === "sign-in"
      ? await authClient.signIn.email({ email, password, callbackURL: "/" })
      : await authClient.signUp.email({ name, email, password, callbackURL: "/" })
    setPending(false)
    if (result.error) {
      setError(mode === "sign-in" ? "Invalid email or password" : "Could not create account")
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold">{mode === "sign-in" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "sign-in" ? "Access your dictionary collections." : "Start your own private dictionary."}
        </p>
      </div>
      {mode === "sign-up" && (
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-md border border-border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md border border-border px-3 py-2"
        />
      </label>
      {mode === "sign-up" && (
        <label className="flex flex-col gap-1 text-sm">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? (mode === "sign-in" ? "Signing in..." : "Creating account...") : (mode === "sign-in" ? "Sign in" : "Create account")}
      </Button>
      <button
        type="button"
        className="text-sm text-neutral-600 underline underline-offset-4"
        onClick={() => {
          setMode((current) => current === "sign-in" ? "sign-up" : "sign-in")
          setError("")
          setPassword("")
          setPasswordConfirmation("")
        }}
      >
        {mode === "sign-in" ? "Create a new account" : "Already have an account? Sign in"}
      </button>
    </form>
  )
}
