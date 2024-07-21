import Main from "./components/Main"
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { getWordsDB } from "./db/queries"

export default async function Page() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ["wordsDB"],
    queryFn: getWordsDB,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Main />
    </HydrationBoundary>
  )
}
