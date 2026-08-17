import Link from "next/link"
import { requirePageSession } from "../lib/session"
import { SignOutButton } from "../components/SignOutButton"
import { ChangePasswordForm } from "./ChangePasswordForm"

export default async function AccountPage() {
  const session = await requirePageSession()
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="hover:underline">← Collections</Link>
        <SignOutButton className="bg-secondary hover:brightness-110 text-gray-800 px-3 py-1" />
      </div>
      <div className="mt-10 rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-neutral-500">{session.user.email}</p>
        <ChangePasswordForm />
      </div>
    </main>
  )
}
