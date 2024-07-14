const { sql } = require("@vercel/postgres")
require('dotenv').config({ path: './.env.local' });

async function seed() {
  await sql`
    create table if not exists words (
      id serial primary key,
      word text not null unique,
      dict_entry jsonb not null
    )`
  
  console.log('Table created')
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
})