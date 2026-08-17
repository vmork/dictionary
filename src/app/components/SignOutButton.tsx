"use client"

import { useRouter } from "next/navigation"
import { authClient } from "../lib/auth-client"
import { Button } from "./Button"

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()

  return (
    <Button
      className={className}
      onClick={async () => {
        await authClient.signOut()
        router.replace("/sign-in")
        router.refresh()
      }}
    >
      Sign out
    </Button>
  )
}
