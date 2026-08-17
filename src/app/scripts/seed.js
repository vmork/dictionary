const postgres = require("postgres")
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.local') })

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  const sql = postgres(process.env.DATABASE_URL, { max: 1 })

  await sql`
    do $$ begin
      create type lang as enum ('english', 'french', 'spanish', 'german');
    exception
      when duplicate_object then null;
    end $$;
  `
  await sql`
    do $$ begin
      create type collection_type as enum ('dictionary', 'translations');
    exception
      when duplicate_object then null;
    end $$;
  `
  await sql`
    create table if not exists collections (
      id serial primary key,
      type collection_type not null,
      name text not null unique,
      lang1 lang not null,
      lang2 lang
    );
  `
  await sql`
    create table if not exists words (
      collection_id integer not null references collections(id),
      id serial primary key,
      word text not null unique,
      dict_entry jsonb not null,
      time_added timestamp with time zone 
        not null default (current_timestamp at time zone 'Europe/Stockholm'),
      practice_data jsonb not null default '{"numSeen": 0, "lastFive": [], "numCorrect": 0}'::jsonb
    );
  `
  // await sql`
  //   create index idx on words(collection_id);
  // `
  
  console.log('Tables created')
  await sql.end({ timeout: 5 })
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
})
