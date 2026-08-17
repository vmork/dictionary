type SessionClient = {
  cookie: string
  request(path: string, init?: RequestInit): Promise<Response>
}

const baseURL = process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:3003"
const ownerEmail = process.env.AUTH_TEST_OWNER_EMAIL ?? "owner-test@example.invalid"
const ownerPassword = process.env.AUTH_TEST_OWNER_PASSWORD
const expectedOwnerCollections = Number(process.env.AUTH_TEST_EXPECT_OWNER_COLLECTIONS ?? 1)
const expectedOwnerWords = Number(process.env.AUTH_TEST_EXPECT_OWNER_WORDS ?? 292)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function signIn(email: string, password: string): Promise<SessionClient> {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email, password }),
  })
  assert(response.status === 200, `Sign-in failed for ${email}: ${response.status}`)
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ")
  assert(cookie, `No session cookie returned for ${email}`)
  return {
    cookie,
    request: (path, init = {}) =>
      fetch(`${baseURL}${path}`, {
        ...init,
        headers: { ...init.headers, Cookie: cookie, Origin: baseURL },
      }),
  }
}

async function signUp(): Promise<SessionClient> {
  const email = `public-signup-${Date.now()}@example.invalid`
  const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email, name: "Public signup test", password: "PublicSignup-2026!" }),
  })
  assert(response.status === 200, `Public signup returned ${response.status}`)
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ")
  assert(cookie, "Public signup did not return a session cookie")
  return {
    cookie,
    request: (path, init = {}) =>
      fetch(`${baseURL}${path}`, {
        ...init,
        headers: { ...init.headers, Cookie: cookie, Origin: baseURL },
      }),
  }
}

async function main() {
  assert(ownerPassword, "Set AUTH_TEST_OWNER_PASSWORD")

  const anonymous = await fetch(`${baseURL}/api/collections`)
  assert(anonymous.status === 401, `Anonymous collections request returned ${anonymous.status}`)
  const anonymousLookup = await fetch(`${baseURL}/api/fetchWord?word=test`)
  assert(anonymousLookup.status === 401, `Anonymous dictionary lookup returned ${anonymousLookup.status}`)

  const anonymousHome = await fetch(baseURL, { redirect: "manual" })
  assert([303, 307, 308].includes(anonymousHome.status), `Anonymous home returned ${anonymousHome.status}`)
  assert(anonymousHome.headers.get("location")?.endsWith("/sign-in"), "Anonymous home did not redirect to sign-in")

  const owner = await signIn(ownerEmail, ownerPassword)
  const user = await signUp()

  const ownerCollectionsResponse = await owner.request("/api/collections")
  assert(ownerCollectionsResponse.status === 200, `Owner collections returned ${ownerCollectionsResponse.status}`)
  const ownerCollections = await ownerCollectionsResponse.json()
  assert(
    ownerCollections.length === expectedOwnerCollections,
    `Owner expected ${expectedOwnerCollections} collection(s), received ${ownerCollections.length}`
  )
  const ownerCollectionId = ownerCollections[0].id
  assert(ownerCollections[0].wordCount === expectedOwnerWords, `Owner collection count was ${ownerCollections[0].wordCount}`)

  const ownerHome = await owner.request("/")
  assert(ownerHome.status === 200, `Owner home returned ${ownerHome.status}`)
  const ownerAccountPage = await owner.request("/account")
  assert(ownerAccountPage.status === 200, `Owner account page returned ${ownerAccountPage.status}`)
  const ownerCollectionPage = await owner.request(`/collection?cid=${ownerCollectionId}`)
  assert(ownerCollectionPage.status === 200, `Owner collection page returned ${ownerCollectionPage.status}`)
  const crossUserCollectionPage = await user.request(`/collection?cid=${ownerCollectionId}`)
  assert(crossUserCollectionPage.status === 404, `Cross-user collection page returned ${crossUserCollectionPage.status}`)
  const ownerPracticePage = await owner.request(`/practice?cid=${ownerCollectionId}`)
  assert(ownerPracticePage.status === 200, `Owner practice page returned ${ownerPracticePage.status}`)
  const crossUserPracticePage = await user.request(`/practice?cid=${ownerCollectionId}`)
  assert(crossUserPracticePage.status === 404, `Cross-user practice page returned ${crossUserPracticePage.status}`)
  const ownerOverviewPage = await owner.request(`/practice/overview?cid=${ownerCollectionId}`)
  assert(ownerOverviewPage.status === 200, `Owner overview page returned ${ownerOverviewPage.status}`)
  const crossUserOverviewPage = await user.request(`/practice/overview?cid=${ownerCollectionId}`)
  assert(crossUserOverviewPage.status === 404, `Cross-user overview page returned ${crossUserOverviewPage.status}`)

  const ownerWordsResponse = await owner.request(`/api/allWords?cid=${ownerCollectionId}&info=false`)
  assert(ownerWordsResponse.status === 200, `Owner words returned ${ownerWordsResponse.status}`)
  const ownerWords = await ownerWordsResponse.json()
  assert(ownerWords.length === expectedOwnerWords, `Owner expected ${expectedOwnerWords} words, received ${ownerWords.length}`)

  const userCollectionsResponse = await user.request("/api/collections")
  assert(userCollectionsResponse.status === 200, `User collections returned ${userCollectionsResponse.status}`)
  const userCollections = await userCollectionsResponse.json()
  assert(
    userCollections.length === 0,
    `Newly signed-up user expected 0 collections, received ${userCollections.length}`
  )

  const forbiddenRead = await user.request(`/api/allWords?cid=${ownerCollectionId}&info=true`)
  assert(forbiddenRead.status === 404, `Cross-user read returned ${forbiddenRead.status}`)

  const forbiddenWrite = await user.request("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid: ownerCollectionId,
      word: "cross-user-test",
      info: { word: "cross-user-test", type: "net" },
      timeString: new Date().toISOString(),
    }),
  })
  assert(forbiddenWrite.status === 404, `Cross-user insert returned ${forbiddenWrite.status}`)

  const forbiddenPracticeUpdate = await user.request("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "updatePracticeData",
      cid: ownerCollectionId,
      word: ownerWords[0],
      practiceData: { numSeen: 1, numCorrect: 1, lastFive: [true] },
    }),
  })
  assert(forbiddenPracticeUpdate.status === 404, `Cross-user practice update returned ${forbiddenPracticeUpdate.status}`)

  const forbiddenPracticeReset = await user.request("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resetAllPracticeData", cid: ownerCollectionId }),
  })
  assert(forbiddenPracticeReset.status === 404, `Cross-user practice reset returned ${forbiddenPracticeReset.status}`)

  const forbiddenDelete = await user.request(
    `/api/word?cid=${ownerCollectionId}&word=${encodeURIComponent(ownerWords[0])}`,
    { method: "DELETE" }
  )
  assert(forbiddenDelete.status === 404, `Cross-user delete returned ${forbiddenDelete.status}`)

  const forbiddenCollectionDelete = await user.request(`/api/collections?cid=${ownerCollectionId}`, { method: "DELETE" })
  assert(forbiddenCollectionDelete.status === 404, `Cross-user collection delete returned ${forbiddenCollectionDelete.status}`)

  const nonEmptyCollectionDelete = await owner.request(`/api/collections?cid=${ownerCollectionId}`, { method: "DELETE" })
  assert(nonEmptyCollectionDelete.status === 409, `Non-empty collection delete returned ${nonEmptyCollectionDelete.status}`)

  const createResponse = await user.request("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Isolation ${Date.now()}`, type: "dictionary", lang1: "english", lang2: null }),
  })
  assert(createResponse.status === 201, `User collection creation returned ${createResponse.status}`)
  const createdCollection = await createResponse.json()
  assert(createdCollection.wordCount === 0, `New collection count was ${createdCollection.wordCount}`)

  const ownerCannotReadUserCollection = await owner.request(`/api/allWords?cid=${createdCollection.id}&info=true`)
  assert(ownerCannotReadUserCollection.status === 404, `Reverse cross-user read returned ${ownerCannotReadUserCollection.status}`)

  const ownerStillHasOne = await owner.request("/api/collections").then((response) => response.json())
  const userNowHasOne = await user.request("/api/collections").then((response) => response.json())
  assert(
    ownerStillHasOne.length === expectedOwnerCollections,
    "Owner collection list changed after another user created a collection"
  )
  assert(userNowHasOne.length === 1, "User cannot see their newly created collection")

  const testWord = "isolation-entry"
  const addOwnWord = await user.request("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cid: createdCollection.id,
      word: testWord,
      timeString: new Date().toISOString(),
      info: {
        word: testWord,
        definitions: [{ wordType: "noun", definition: "test entry", example: "", synonyms: [] }],
        translations: [],
        etymologies: [],
        definitionsSource: { title: "test", href: "https://example.invalid" },
        translationsSource: { title: "test", href: "https://example.invalid" },
        etymologySource: { title: "test", href: "https://example.invalid" },
        type: "net",
      },
    }),
  })
  assert(addOwnWord.status === 200, `Own word insert returned ${addOwnWord.status}`)

  const storedWordsResponse = await user.request(`/api/allWords?cid=${createdCollection.id}&info=true`)
  assert(storedWordsResponse.status === 200, `Stored word read returned ${storedWordsResponse.status}`)
  const storedWords = await storedWordsResponse.json()
  assert(storedWords.length === 1, `Expected one stored word, received ${storedWords.length}`)
  assert(Array.isArray(storedWords[0].dict_entry.definitions), "Definitions were not stored as a JSON array")
  assert(Array.isArray(storedWords[0].dict_entry.translations), "Translations were not stored as a JSON array")
  assert(Array.isArray(storedWords[0].practice_data.lastFive), "Practice history was not stored as a JSON array")

  const updateOwnPractice = await user.request("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "updatePracticeData",
      cid: createdCollection.id,
      word: testWord,
      practiceData: { numSeen: 1, numCorrect: 1, lastFive: [true] },
    }),
  })
  assert(updateOwnPractice.status === 200, `Own practice update returned ${updateOwnPractice.status}`)
  const updatedWords = await user.request(`/api/allWords?cid=${createdCollection.id}&info=true`).then((response) => response.json())
  assert(updatedWords[0].practice_data.numSeen === 1, "Practice count did not round-trip")
  assert(updatedWords[0].practice_data.lastFive[0] === true, "Practice history did not round-trip")

  const userCollectionWithWord = await user.request("/api/collections").then((response) => response.json())
  assert(userCollectionWithWord[0].wordCount === 1, `Collection word count was ${userCollectionWithWord[0].wordCount}`)
  const rejectNonEmptyDelete = await user.request(`/api/collections?cid=${createdCollection.id}`, { method: "DELETE" })
  assert(rejectNonEmptyDelete.status === 409, `Non-empty own collection delete returned ${rejectNonEmptyDelete.status}`)

  const deleteOwnWord = await user.request(`/api/word?cid=${createdCollection.id}&word=${testWord}`, { method: "DELETE" })
  assert(deleteOwnWord.status === 200, `Own word delete returned ${deleteOwnWord.status}`)
  const deleteEmptyCollection = await user.request(`/api/collections?cid=${createdCollection.id}`, { method: "DELETE" })
  assert(deleteEmptyCollection.status === 204, `Empty collection delete returned ${deleteEmptyCollection.status}`)
  const userAfterDelete = await user.request("/api/collections").then((response) => response.json())
  assert(userAfterDelete.length === 0, "Deleted collection still appears in the user's collection list")

  console.log("Auth isolation passed: JSON writes, collection lifecycle, public signup, and owner boundaries work")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
