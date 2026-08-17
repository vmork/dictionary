import Main from "./components/Main"
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { notFound } from "next/navigation"
import { CollectionNotFoundError, getWordsDataMap } from "../lib/dictionaryRepository"
import { requirePageSession } from "../lib/session"

type CollectionPageProps = {
  searchParams: Promise<{ cid?: string | string[] }>
}

export default async function Page({ searchParams }: CollectionPageProps) {
  const session = await requirePageSession()
  const queryClient = new QueryClient()

  const { cid: cidParam } = await searchParams
  const cidString = Array.isArray(cidParam) ? cidParam[0] : cidParam
  if (!cidString || isNaN(Number(cidString))) {
    return notFound()
  }
  const cid = Number(cidString)

  try {
    const wordsData = await getWordsDataMap(session.user.id, cid)
    queryClient.setQueryData(["wordsDB", cid], wordsData)
  } catch (error) {
    if (error instanceof CollectionNotFoundError) return notFound()
    throw error
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Main cid={cid} />
    </HydrationBoundary>
  )
}
