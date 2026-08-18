"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import type { Definition } from "../../lib/types"
import { hasNounDefinition } from "../../lib/wordImageEligibility"
import type { WikimediaImageSource, WordImage } from "../../lib/wikimediaImages"
import { cn } from "../../lib/utils"

type WordImageResponse = { image: WordImage | null }

async function getWordImage(word: string, source: WikimediaImageSource) {
  const params = new URLSearchParams({ word, source })
  const response = await fetch(`/api/wordImages?${params}`)
  if (!response.ok) throw new Error(`Image lookup failed with status ${response.status}`)
  return response.json() as Promise<WordImageResponse>
}

function useWordImage(word: string, source: WikimediaImageSource, enabled: boolean) {
  return useQuery({
    queryKey: ["wordImage", source, word],
    queryFn: () => getWordImage(word, source),
    enabled,
    retry: 1,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60,
  })
}

function ImageCard({ image, compact }: { image: WordImage; compact: boolean }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-white">
      <a href={image.filePageUrl} target="_blank" rel="noopener noreferrer" className="block">
        <div className="flex h-40 items-center justify-center bg-neutral-100 sm:h-52">
          <Image
            unoptimized
            src={image.imageUrl}
            width={image.width}
            height={image.height}
            sizes={compact ? "50vw" : "(max-width: 767px) 100vw, 50vw"}
            alt={image.alt}
            className="h-full w-full object-contain"
          />
        </div>
      </a>
      <figcaption className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2 text-xs text-neutral-500 sm:flex-row sm:items-baseline sm:gap-1.5">
        <a
          href={image.sourcePageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-neutral-700 underline transition hover:text-primary"
        >
          {image.sourceTitle}
        </a>
        {image.creator && <span className="truncate">{image.creator}</span>}
        <a
          href={image.licenseUrl ?? image.filePageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 underline transition hover:text-primary sm:ml-auto"
        >
          {image.license ?? "Image source"}
        </a>
      </figcaption>
    </figure>
  )
}

export default function WordImages({ word, definitions }: { word: string; definitions: Definition[] }) {
  const enabled = hasNounDefinition(definitions)
  const wiktionary = useWordImage(word, "wiktionary", enabled)
  const wikipedia = useWordImage(word, "wikipedia", enabled)
  const images = [wiktionary.data?.image, wikipedia.data?.image].filter((image): image is WordImage => Boolean(image))

  if (!enabled || images.length === 0) return null

  return (
    <section aria-label={`Images for ${word}`} className="my-4">
      <div className={cn("grid gap-2 sm:gap-3", images.length === 2 ? "grid-cols-2" : "max-w-md grid-cols-1")}>
        {images.map((image) => <ImageCard key={image.source} image={image} compact={images.length === 2} />)}
      </div>
    </section>
  )
}
