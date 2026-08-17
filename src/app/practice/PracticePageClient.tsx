"use client"

import Link from "next/link"
import { Button } from "../components/Button"
import Practice from "./components/Practice"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function PracticePageContent() {
  const searchParams = useSearchParams()
  const cidString  = searchParams.get("cid")
  if (!cidString || isNaN(Number(cidString))) {
    return <div>Invalid collection ID</div>
  }
  const cid = Number(cidString)

  return (
    <div className="flex flex-col h-full">
      <div className="w-full max-w-[640px] mx-auto h-full">
        <Practice cid={cid}/>
      </div>
    </div>
  )
}

export default function PracticePageClient() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PracticePageContent />
    </Suspense>
  )
}
