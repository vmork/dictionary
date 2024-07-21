"use client"

import Link from "next/link"
import { Button } from "../components/Button"
import Practice from "./components/Practice"

export default function PracticePage() {
  return (
    <div className="flex items-center h-full">
      <Link href="/" className="absolute top-4 left-4">
        <Button className="p-2 bg-neutral-300">Home</Button>
      </Link>
      <div className="w-full max-w-[640px] mx-auto h-full">
        <Practice />
      </div>
    </div>
  )
}
