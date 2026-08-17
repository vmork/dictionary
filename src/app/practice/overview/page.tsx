import { notFound } from "next/navigation"
import { assertCollectionOwned, CollectionNotFoundError } from "../../lib/dictionaryRepository"
import { requirePageSession } from "../../lib/session"
import PracticeOverviewClient from "./PracticeOverviewClient"

type PracticeOverviewPageProps = {
  searchParams: Promise<{ cid?: string | string[] }>
}

export default async function PracticeOverviewPage({ searchParams }: PracticeOverviewPageProps) {
  const session = await requirePageSession()
  const { cid: cidParam } = await searchParams
  const cidString = Array.isArray(cidParam) ? cidParam[0] : cidParam
  if (!cidString || isNaN(Number(cidString))) return notFound()

  try {
    await assertCollectionOwned(session.user.id, Number(cidString))
  } catch (error) {
    if (error instanceof CollectionNotFoundError) return notFound()
    throw error
  }

  return <PracticeOverviewClient />
}
