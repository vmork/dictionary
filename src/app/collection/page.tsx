import Main from "./components/Main"
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { getWordsDB } from "../api/queries"
import { notFound } from "next/navigation"

export default async function Page({searchParams}: {searchParams: Record<string, string>}) {
  const queryClient = new QueryClient()

  const cidString = searchParams["cid"] ?? "1"
  if (!cidString || isNaN(Number(cidString))) {
    return notFound()
  }
  const cid = Number(cidString)

  await queryClient.prefetchQuery({
    queryKey: ["wordsDB", cid],
    queryFn: () => getWordsDB(cid),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Main cid={cid} />
    </HydrationBoundary>
  )
}
