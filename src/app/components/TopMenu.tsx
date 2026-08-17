"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "./Button"
import { CollectionID } from "../lib/collections"
import { Menu } from "lucide-react"
import { SignOutButton } from "./SignOutButton"

export function TopMenu({ cid }: { cid: CollectionID }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <Button
        className="bg-secondary hover:brightness-110 text-gray-800 px-3 py-1 flex gap-2 items-center"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Menu size={16}></Menu>
        Menu
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute flex flex-col text-base right-0 mt-2 w-max min-w-full rounded-md border border-border bg-light shadow-lg z-50 p-3"
        >
          <Link href={`/`} onClick={() => setOpen(false)}>
            <button className="hover:underline hover:bg-transparent text-dark hover:text-primary py-1">Home</button>
          </Link>
          <Link href={`/practice?cid=${cid}`} onClick={() => setOpen(false)}>
            <button className="hover:underline hover:bg-transparent text-dark hover:text-primary py-1">Practice</button>
          </Link>
          <Link href={`/practice/overview?cid=${cid}`} onClick={() => setOpen(false)}>
            <button className="hover:underline hover:bg-transparent text-dark hover:text-primary py-1">Statistics</button>
          </Link>
          <Link href="/account" onClick={() => setOpen(false)}>
            <button className="hover:underline hover:bg-transparent text-dark hover:text-primary py-1">Account</button>
          </Link>
          <SignOutButton className="mt-2 bg-secondary hover:brightness-110 text-gray-800 px-3 py-1" />
        </div>
      )}
    </div>
  )
}
