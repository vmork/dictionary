import { redirect } from "next/navigation"
import { getSession } from "../lib/session"
import { SignInForm } from "./SignInForm"

export default async function SignInPage() {
  if (await getSession()) redirect("/")
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <SignInForm />
    </main>
  )
}
