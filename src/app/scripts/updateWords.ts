import path from 'path'
import dotenv from 'dotenv'
import { fetchWordInfoFromWeb } from '../lib/scraping'
import { APIError, NotFound, DictEntryFromNet } from '../lib/types'
import { getSql } from '../lib/db'

// Load .env.local like seed script (relative two levels up from this file)
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })

/**
 * Script to refresh dictionary / thesaurus data for all existing words.
 *
 * Usage examples:
 *   pnpm run update:words                     # update all collections
 *   pnpm run update:words -- 3                # only collection 3
 *   pnpm run update:words -- --dry-run        # simulate, no DB writes
 *   pnpm run update:words -- 4 --dry-run --max=5
 *   pnpm run update:words -- 4 --maxNumWords=10
 *
 * Flags:
 *   --dry-run / --dry          Do not persist changes (still fetches)
 *   --max=<n> / --maxNumWords=<n> Limit number of words processed (after filtering by collection)
 */
async function getAllWordsWithIds(collectionFilter?: number) {
  const sql = getSql()
  type WordRow = { id: number; word: string; collection_id: number }

  if (collectionFilter != null) {
    return sql<WordRow[]>`SELECT id, word, collection_id FROM words WHERE collection_id = ${collectionFilter}`
  }
  return sql<WordRow[]>`SELECT id, word, collection_id FROM words` // potentially large
}

async function updateWordDictEntry(wordId: number, info: DictEntryFromNet) {
  const sql = getSql()
  await sql`UPDATE words SET dict_entry = ${JSON.stringify(info)} WHERE id = ${wordId}`
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const rawArgs = process.argv.slice(2)
  const collectionArg = rawArgs.find(a => /^\d+$/.test(a))
  const collectionFilter = collectionArg ? Number(collectionArg) : undefined
  const dryRun = rawArgs.some(a => a === '--dry-run' || a === '--dry')
  const maxArgRaw = rawArgs.find(a => a.startsWith('--max=') || a.startsWith('--maxNumWords='))
  const maxNumWords = maxArgRaw ? Number(maxArgRaw.split('=')[1]) : undefined

  if (maxNumWords != null && (isNaN(maxNumWords) || maxNumWords <= 0)) {
    console.error('Invalid maxNumWords value provided.')
    process.exit(1)
  }

  const allWords = await getAllWordsWithIds(collectionFilter)
  const words = maxNumWords ? allWords.slice(0, maxNumWords) : allWords
  console.log(`Found ${allWords.length} words${collectionFilter != null ? ' in collection '+collectionFilter : ''}. Processing ${words.length}${dryRun ? ' (dry-run)' : ''}.`)

  let updated = 0, skippedNotFound = 0, failed = 0
  for (const { id, word, collection_id } of words) {
    try {
      const info = await fetchWordInfoFromWeb(word.toLowerCase())
      if (info instanceof NotFound) {
        console.warn(`[NotFound] ${word} (suggestions: ${info.didYouMean.slice(0,5).join(', ')})`)
        skippedNotFound++
        continue
      }
      if (info instanceof APIError) {
        console.error(`[APIError] ${word}: ${info.message}`)
        failed++
        continue
      }
      if (dryRun) {
        console.log(`[DryRun] Would update ${word} (collection ${collection_id})`)
      } else {
        await updateWordDictEntry(id, info)
        console.log(`[Updated] ${word} (collection ${collection_id})`)
        updated++
      }
      console.log(info)
      // Be gentle to upstream APIs (esp Merriam-Webster free tier)
      await sleep(250)
    } catch (e: any) {
      console.error(`[Fail] ${word}:`, e.message)
      failed++
    }
  }

  console.log(`\nDone. Updated=${updated}, NotFound=${skippedNotFound}, Failed=${failed}${dryRun ? ' (dry-run, no writes performed)' : ''}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
