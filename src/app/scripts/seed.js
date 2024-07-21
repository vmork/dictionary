const { sql } = require("@vercel/postgres")
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.local') })

async function seed() {
  // await sql`
  //   create type lang as enum ('english', 'french', 'spanish', 'german');
  // `
  // await sql`
  //   create type collection_type as enum ('dictionary', 'translations');
  // `
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
        not null default (current_timestamp at time zone 'Europe/Stockholm')
    );
  `
  // await sql`
  //   create index idx on words(collection_id);
  // `
  
  console.log('Tables created')
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
})