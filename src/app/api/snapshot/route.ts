import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { lesson_id, version_num, contents, trigger } = await req.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("lesson_snapshots").insert({
    lesson_id,
    version_num,
    contents,
    trigger,
    saved_by: user.id,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
