import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "./auth"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export async function requirePageSession() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  return session
}
