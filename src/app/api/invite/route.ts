import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

// POST /api/invite  { lessonId, email? }  → { token, url }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lessonId, email } = body as { lessonId?: string; email?: string };
  if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 });

  // 소유자 확인
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, owner_id')
    .eq('id', lessonId)
    .single();
  if (!lesson || lesson.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = randomBytes(24).toString('base64url');

  const admin = createAdminClient();
  const { error } = await admin.from('lesson_invites').insert({
    lesson_id: lessonId,
    email: email?.toLowerCase().trim() || null,
    token,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = req.nextUrl.origin;
  return NextResponse.json({ token, url: `${origin}/invite/${token}` });
}
