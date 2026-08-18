import assert from "node:assert/strict"
import test from "node:test"
import { fetchWordImage, isWikimediaImageSource, type WikimediaFetcher } from "./wikimediaImages"
import { hasNounDefinition } from "./wordImageEligibility"

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

test("source validation accepts only the two supported image providers", () => {
  assert.equal(isWikimediaImageSource("wiktionary"), true)
  assert.equal(isWikimediaImageSource("wikipedia"), true)
  assert.equal(isWikimediaImageSource("openverse"), false)
  assert.equal(isWikimediaImageSource(null), false)
})

test("only noun definitions are eligible for images", () => {
  assert.equal(hasNounDefinition([{ wordType: "pronoun" }]), false)
  assert.equal(hasNounDefinition([{ wordType: "adjective" }]), false)
  assert.equal(hasNounDefinition([{ wordType: "noun" }]), true)
  assert.equal(hasNounDefinition([{ wordType: "adjective, noun" }]), true)
})

test("a Wiktionary page image includes its source and attribution metadata", async () => {
  const requestedUrls: URL[] = []
  const fetcher: WikimediaFetcher = async (input) => {
    const url = new URL(String(input))
    requestedUrls.push(url)
    if (url.searchParams.get("prop") === "pageimages") {
      return jsonResponse({
        query: {
          pages: [{
            pageid: 1,
            title: "cockade",
            pageimage: "Cockade_example.jpg",
            thumbnail: { source: "https://upload.wikimedia.org/example.jpg", width: 480, height: 640 },
          }],
        },
      })
    }
    return jsonResponse({
      query: {
        pages: [{
          title: "File:Cockade_example.jpg",
          imageinfo: [{
            extmetadata: {
              Artist: { value: "<a>Example Artist</a>" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
            },
          }],
        }],
      },
    })
  }

  const image = await fetchWordImage("cockade", "wiktionary", fetcher)

  assert.deepEqual(image, {
    source: "wiktionary",
    sourceTitle: "Wiktionary",
    sourcePageUrl: "https://en.wiktionary.org/wiki/cockade",
    filePageUrl: "https://en.wiktionary.org/wiki/File%3ACockade_example.jpg",
    imageUrl: "https://upload.wikimedia.org/example.jpg",
    width: 480,
    height: 640,
    alt: "Cockade example",
    creator: "Example Artist",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  })
  assert.equal(requestedUrls.length, 2)
  assert.equal(requestedUrls[0].hostname, "en.wiktionary.org")
  assert.equal(requestedUrls[0].searchParams.get("pilicense"), "free")
  assert.equal(requestedUrls[0].searchParams.get("titles"), "cockade")
  assert.equal(requestedUrls[1].searchParams.get("titles"), "File:Cockade_example.jpg")
})

test("a word without a page image avoids the metadata request", async () => {
  let requestCount = 0
  const fetcher: WikimediaFetcher = async () => {
    requestCount++
    return jsonResponse({ query: { pages: [{ pageid: 2, title: "alacrity" }] } })
  }

  assert.equal(await fetchWordImage("alacrity", "wikipedia", fetcher), null)
  assert.equal(requestCount, 1)
})

test("an image still renders when optional metadata is unavailable", async () => {
  let requestCount = 0
  const fetcher: WikimediaFetcher = async () => {
    requestCount++
    if (requestCount === 1) {
      return jsonResponse({
        query: {
          pages: [{
            pageid: 3,
            title: "Aphid",
            pageimage: "Aphid.svg",
            thumbnail: { source: "https://upload.wikimedia.org/aphid.svg", width: 640, height: 400 },
          }],
        },
      })
    }
    return jsonResponse({ message: "temporary failure" }, 503)
  }

  const image = await fetchWordImage("aphid", "wikipedia", fetcher)
  assert.equal(image?.source, "wikipedia")
  assert.equal(image?.creator, undefined)
  assert.equal(image?.filePageUrl, "https://en.wikipedia.org/wiki/File%3AAphid.svg")
})
