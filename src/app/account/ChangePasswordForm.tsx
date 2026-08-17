"use client"

import { FormEvent, useState } from "react"
import { authClient } from "../lib/auth-client"
import { Button } from "../components/Button"

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")
    if (newPassword !== confirmation) {
      setError("New passwords do not match")
      return
    }
    setPending(true)
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPending(false)
    if (result.error) {
      setError("The current password was incorrect or the new password was invalid")
      return
    }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmation("")
    setMessage("Password changed. Other sessions have been signed out.")
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Current password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="rounded-md border border-border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="rounded-md border border-border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="rounded-md border border-border px-3 py-2"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <Button type="submit" disabled={pending || newPassword.length < 12}>
        {pending ? "Changing..." : "Change password"}
      </Button>
    </form>
  )
}
