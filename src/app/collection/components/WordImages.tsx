"use client"

import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"
import Image from "next/image"
import type { Definition } from "../../lib/types"
import { hasNounDefinition } from "../../lib/wordImageEligibility"
import type { WikimediaImageSource, WordImage } from "../../lib/wikimediaImages"

type WordImageResponse = { image: WordImage | null }

const MAX_IMAGE_HEIGHT = 208

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

function ImageCredits({ image }: { image: WordImage }) {
  const creditText = [image.creator ? `By ${image.creator}` : undefined, image.license].filter(Boolean).join(" · ")

  return (
    <div className="group relative">
      <a
        href={image.filePageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${image.sourceTitle} image credits${creditText ? `: ${creditText}` : ""}`}
        className="flex size-6 cursor-help items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </a>
      <div
        role="tooltip"
        className="invisible absolute bottom-full right-0 z-20 w-max max-w-64 pb-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <div className="flex flex-col gap-1 rounded-md border border-border bg-white px-2.5 py-2 text-left text-xs text-neutral-600 shadow-md">
          {image.creator && <span>By {image.creator}</span>}
          {image.license && image.licenseUrl ? (
            <a
              href={image.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition hover:text-primary"
            >
              {image.license}
            </a>
          ) : image.license ? <span>{image.license}</span> : null}
          <a
            href={image.filePageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition hover:text-primary"
          >
            Image details
          </a>
        </div>
      </div>
    </div>
  )
}

function ImageCard({ image }: { image: WordImage }) {
  const cardWidth = Math.max(1, Math.min(image.width, Math.round((image.width / image.height) * MAX_IMAGE_HEIGHT)))

  return (
    <figure
      style={{ width: cardWidth, alignSelf: "start" }}
      className="min-w-0 max-w-full rounded-lg border border-border bg-white"
    >
      <a
        href={image.filePageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-t-lg bg-neutral-100"
      >
        <Image
          unoptimized
          src={image.imageUrl}
          width={image.width}
          height={image.height}
          sizes="(max-width: 767px) 50vw, 416px"
          alt={image.alt}
          className="block h-auto w-full"
        />
      </a>
      <figcaption className="flex min-w-0 items-center justify-between gap-1 border-t border-border px-2 py-1 text-xs text-neutral-500">
        <a
          href={image.sourcePageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-neutral-700 underline transition hover:text-primary"
        >
          {image.sourceTitle}
        </a>
        <ImageCredits image={image} />
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
      <div className="flex max-w-full items-start gap-2 sm:gap-3">
        {images.map((image) => <ImageCard key={image.source} image={image} />)}
      </div>
    </section>
  )
}
