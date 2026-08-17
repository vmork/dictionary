import Home from "./components/Home"
import { requirePageSession } from "./lib/session"

export default async function Page() {
  const session = await requirePageSession()
  return <Home userEmail={session.user.email} />
}
