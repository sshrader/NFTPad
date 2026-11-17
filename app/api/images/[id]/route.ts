import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const pool = await db();
  const { rows } = await pool.query("SELECT content_type, data FROM images WHERE id = $1", [id]);
  if (!rows[0]) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(rows[0].data as Buffer), {
    headers: {
      "Content-Type": rows[0].content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
