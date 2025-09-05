# AI Assistant Project Instructions

Concise, project-specific guidance for automated coding agents working in this repository.

## 1. High-Level Architecture
- Next.js (App Router) + TypeScript + Tailwind. No server actions; data flows through REST-like route handlers under `src/app/api/*`.
- Persistence: Vercel Postgres `words` + `collections` tables. Core domain object: *Word* with embedded dictionary entry JSON and `practice_data` JSON (shape: `{ numSeen: number; lastFive: boolean[]; numCorrect: number }`).
- Client data fetching & caching with React Query (see `providers.tsx` for QueryClient lifecycle). All mutations go through helper functions & hooks in `api/queries.ts`.
- Practice session logic encapsulated in `practice/scheduler.tsx` (probability-based spaced repetition). UI components consume only its public methods (`getNext`, `onAnswer`, `getWordAnalysis`). Keep new logic behind this boundary.
- Dictionary / translation acquisition logic in `lib/dictionary/scraping.ts` & `lib/translations/*` (network fetch abstraction). Avoid duplicating scraping logic elsewhere.

## 2. Key Directories
- `src/app/api/*`: Route handlers. Each file exposes HTTP verbs (e.g. `word/route.ts`). Keep mutations explicit via an `action` field in request body when multiple behaviors share POST.
- `src/app/api/queries.ts`: Single source of truth for client-side data access (query + mutation hooks). Add new server endpoints here first, then use hooks in components.
- `src/app/lib/dictionary/types.ts`: Canonical domain types (extend here before ad‑hoc typing elsewhere). `DictEntryFromDB` augments dictionary info with `timeAdded` + `practiceData`.
- `src/app/practice/scheduler.tsx`: Practice selection algorithm. Tuning through `SchedulerConfig`; avoid scattering probability math in UI.
- `src/app/collection/components/*` & `practice/components/*`: UI composition. Heavy logic should move down into lib or scheduler.

## 3. Data & State Conventions
- Words are stored & transmitted as lowercase (UI lowercases on search). When adding or updating, maintain canonical form before inserting.
- Practice updates: call `scheduler.onAnswer(word, 'correct'|'wrong')` then persist via `useUpdatePracticeData`. Never mutate `practice_data` directly in component state—treat server as source of truth and optimistically update React Query cache if needed.
- Adding words: use `useAddWord` which seeds default `practice_data`. Do not replicate the seeding object; import or mirror shape from types.
- Cache keys: `['wordsDB', cid]`, `['word', word, cid]`, `['collections']`. Invalidate or update these keys consistently after mutations.

## 4. Practice Algorithm (What Matters)
- Difficulty is inverse weighted accuracy (recent vs overall) with category boosts: struggling, recent mistake, mastered, new.
- New word surfacing controlled by `newWordProbability` with adaptive scaling by remaining new words count.
- Avoid immediate repetition: last word difficulty is penalized (×0.1).
- When extending: expose new tunables through `SchedulerConfig`; keep deterministic transformations pure (no random inside difficulty calc beyond selection stage) for testability.

## 5. UI Patterns
- All client components needing React Query or hooks have `'use client'` at top or reside under a client boundary; server components remain simple wrappers.
- Use Suspense boundaries for anything calling `useSearchParams()` or suspense-enabled queries (see `practice/overview/page.tsx` & `collection/components/Main.tsx`).
- Buttons use the shared `Button` component; pass utility classes for variant styling (no custom button elements elsewhere).
- Navigation patterns: top-left fixed cluster in practice mode (`TopNavigation`), table analytics in overview.

## 6. Extending API Routes
- Add new functionality either as a new route file (preferred for distinct resources) or as an `action` branch inside an existing POST when tightly coupled (e.g., `updatePracticeData`, `resetAllPracticeData`).
- Always validate `cid` and other critical params; return 400 early. Follow existing response patterns (`new Response("OK")`, or `Response.json(data)`).
- Keep DB access minimal—prefer a single SQL statement per action.

## 7. React Query Usage Tips
- For optimistic updates (example in `Main.tsx` add/delete word), use `queryClient.setQueryData` with a shallow-cloned Map (`new Map(old)`) to preserve immutability.
- Prefer derived views (sorting, filtering) via `useMemo` over storing duplicated arrays.
- Invalidate (`queryClient.invalidateQueries`) after bulk operations (e.g., reset practice data) instead of manual per-word updates.

## 8. Styling & Design
- Tailwind with custom colors: `primary`, `secondary`, `muted`, `border`, `background`. Favor subtle backgrounds (`bg-white`, `bg-muted`) and thin borders for panels.
- Avoid adding global utility classes; prefer composition in components.

## 9. Common Pitfalls & Gotchas
- Forgetting Suspense around `useSearchParams()` triggers build error (see current fix in overview page).
- Direct mutation of `PracticeData` object outside scheduler leads to stale cache inconsistencies—always go through scheduler + mutation hook.
- Recreating `QueryClient` can break caching—only create in `providers.tsx` using the provided factory.
- Ensure Maps are serialized only at API boundaries; never attempt to send a `Map` directly via fetch.

## 10. Adding New Features (Example Workflow)
1. Add/extend server route under `api/*`.
2. Create fetch helper + hook in `api/queries.ts` with stable `queryKey`.
3. (If practice logic) extend `SchedulerConfig` & internal methods; supply defaults via `DEFAULT_SCHEDULER_CONFIG`.
4. Consume hook in a client component; wrap with Suspense if using suspense query or search params.
5. Update affected cache keys on mutation success.

## 11. Testing & Verification (Manual for Now)
- Run type & build check: `npm run build` (watch for `_document` or Suspense errors). 
- Quick scheduler sanity: temporarily log `scheduler.getWordAnalysis()` in practice overview if tuning.

## 12. Future Improvement Ideas (Do NOT implement automatically)AI vinter 1975
- Formal unit tests for scheduler difficulty categories.
- Server actions for mutations to reduce boilerplate.
- Shared button variants (utility generator) to centralize style tokens.

---
If a change would alter multiple layers (DB, API, hooks, UI), modify in that order and keep types in sync. Ask for clarification only when domain behavior is ambiguous (e.g., new practice categories).
