"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, Plus, Trash2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useCollectionList, useCreateCollection, useDeleteCollection } from "../api/queries"
import { Button } from "./Button"
import { SignOutButton } from "./SignOutButton"

export default function Home({ userEmail }: { userEmail: string }) {
  const collectionListQuery = useCollectionList()
  const createCollectionMutation = useCreateCollection()
  const deleteCollectionMutation = useDeleteCollection()
  const queryClient = useQueryClient()
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function closeNewCollectionForm() {
    setShowNewCollectionForm(false)
    setNewCollectionName("")
    createCollectionMutation.reset()
  }

  function createNewCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newCollectionName.trim()
    if (!name) return
    createCollectionMutation.mutate(name, {
      onSuccess: async () => {
        closeNewCollectionForm()
        await queryClient.invalidateQueries({ queryKey: ["collections"] })
      },
    })
  }

  function removeEmptyCollection(cid: number) {
    deleteCollectionMutation.mutate(cid, {
      onSuccess: async () => {
        setConfirmDeleteId(null)
        await queryClient.invalidateQueries({ queryKey: ["collections"] })
      },
    })
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-white/70">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3 text-sm text-neutral-500 sm:px-6">
          <span className="max-w-[45vw] truncate">{userEmail}</span>
          <Link href="/account" className="text-dark hover:underline">Account</Link>
          <SignOutButton className="bg-secondary px-3 py-1 text-gray-800 hover:brightness-110" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h1 className="text-2xl font-semibold text-dark">Collections</h1>
              <p className="mt-1 text-sm text-neutral-500">Your private word lists.</p>
            </div>
            {!showNewCollectionForm && (
              <Button
                className="flex items-center gap-2 whitespace-nowrap px-3 py-2"
                onClick={() => {
                  createCollectionMutation.reset()
                  setShowNewCollectionForm(true)
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New collection</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>

          {showNewCollectionForm && (
            <form
              onSubmit={createNewCollection}
              onKeyDown={(event) => event.key === "Escape" && closeNewCollectionForm()}
              className="border-b border-border bg-neutral-50 px-5 py-5 sm:px-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-dark">Create a collection</h2>
                  <p className="mt-1 text-sm text-neutral-500">English dictionary · private to your account</p>
                </div>
                <button
                  type="button"
                  aria-label="Cancel creating collection"
                  className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200 hover:text-dark"
                  onClick={closeNewCollectionForm}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label htmlFor="collection-name" className="mt-4 block text-sm font-medium text-dark">
                Name
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  id="collection-name"
                  autoFocus
                  required
                  value={newCollectionName}
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-primary/50"
                  maxLength={100}
                  placeholder="For example: Words to practice"
                />
                <Button type="submit" disabled={!newCollectionName.trim() || createCollectionMutation.isPending}>
                  {createCollectionMutation.isPending ? "Creating…" : "Create collection"}
                </Button>
              </div>
              {createCollectionMutation.isError && (
                <p role="alert" className="mt-2 text-sm text-red-600">{createCollectionMutation.error.message}</p>
              )}
            </form>
          )}

          {collectionListQuery.isError ? (
            <p role="alert" className="px-5 py-8 text-red-600 sm:px-6">
              Could not load collections: {collectionListQuery.error.message}
            </p>
          ) : collectionListQuery.isPending ? (
            <p className="px-5 py-8 text-neutral-500 sm:px-6">Loading collections…</p>
          ) : collectionListQuery.data.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <BookOpen className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-3 font-medium text-dark">No collections yet</p>
              <p className="mt-1 text-sm text-neutral-500">Create one to start saving words.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {collectionListQuery.data.map((collection) => (
                <li className="flex min-w-0 items-center gap-3 px-5 py-3 sm:px-6" key={collection.id}>
                  <Link
                    href={`/collection?cid=${collection.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-md py-1"
                  >
                    <span className="rounded-lg bg-primary/40 p-2 text-dark">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-dark group-hover:underline">{collection.name}</span>
                      <span className="block text-sm text-neutral-500">
                        English dictionary · {collection.wordCount} {collection.wordCount === 1 ? "word" : "words"}
                      </span>
                    </span>
                    <ChevronRight className="ml-auto h-5 w-5 flex-none text-neutral-300 group-hover:text-neutral-500" />
                  </Link>

                  {collection.wordCount === 0 && (
                    confirmDeleteId === collection.id ? (
                      <div className="flex flex-none items-center gap-1">
                        <Button
                          className="bg-reddish px-2 py-1 text-sm"
                          disabled={deleteCollectionMutation.isPending}
                          onClick={() => removeEmptyCollection(collection.id)}
                        >
                          {deleteCollectionMutation.isPending ? "Removing…" : "Remove"}
                        </Button>
                        <button
                          type="button"
                          aria-label={`Cancel removing ${collection.name}`}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-dark"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove empty collection ${collection.name}`}
                        title="Remove empty collection"
                        className="flex-none rounded-md p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          deleteCollectionMutation.reset()
                          setConfirmDeleteId(collection.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}

          {deleteCollectionMutation.isError && (
            <p role="alert" className="border-t border-border px-5 py-3 text-sm text-red-600 sm:px-6">
              {deleteCollectionMutation.error.message}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
