"use client"

import Link from "next/link"
import { useCollectionList } from "../api/queries"
import { Button } from "./Button"
import { useState } from "react"

export default function Home() {
  const collectionListQuery = useCollectionList()
  const [showNewCollectionPrompt, setShowNewCollectionPrompt] = useState(false)

  return (
    <div className="flex justify-center pt-[100px]">
      {collectionListQuery.isError ? (
        <div>Error loading collections: {collectionListQuery.error.message}</div>
      ) : collectionListQuery.isPending ? (
        <div>Loading collections...</div>
      ) : (
        <div className="flex flex-col">
          <h1 className="text-3xl">Collections</h1>
          <ul className="mt-3">
            {collectionListQuery.data.map((collection) => (
              <li className="flex gap-5 items-center w-full" key={collection.id}>
                <Link href={`/collection?cid=${collection.id}`}>
                  <span className="hover:underline">{collection.name}</span>
                </Link>
                <span className="ml-auto text-sm text-neutral-400">{collection.type}</span>
              </li>
            ))}
          </ul>

          <Button className="mt-5 flex-none w-fit" onClick={() => setShowNewCollectionPrompt(true)}>
            Create new
          </Button>
        </div>
      )}
    </div>
  )
}
