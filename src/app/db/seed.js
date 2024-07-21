const { sql } = require("@vercel/postgres")
require('dotenv').config({ path: './.env.local' });

async function seed() {
  await sql`
    create table if not exists words (
      id serial primary key,
      word text not null unique,
      dict_entry jsonb not null,
      time_added timestamp with time zone 
        not null default (current_timestamp at time zone 'Europe/Stockholm')
    )`
  
  console.log('Table created')
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
})