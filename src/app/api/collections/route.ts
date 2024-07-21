import { db } from "@vercel/postgres"

export async function GET(req: Request) {
  const client = await db.connect()
  const res = await client.sql`SELECT * FROM collections`
  return Response.json(res.rows)
}