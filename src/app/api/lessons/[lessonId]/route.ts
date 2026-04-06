import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/lessons/[lessonId]/members  { email }  → { userId, displayName }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 소유자 확인
  const { data: lesson } = await supabase
    .from('lessons')
    .select('owner_id')
    .eq('id', lessonId)
    .single();
  if (!lesson || lesson.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email } = body as { email?: string };
  if (!email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  // 이메일로 유저 검색
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('email', normalizedEmail)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // 본인 초대 방지
  if (profile.id === user.id) {
    return NextResponse.json({ error: 'self_invite' }, { status: 400 });
  }

  // 이미 멤버인지 확인 (소유자 포함)
  const { data: lessonOwner } = await supabase
    .from('lessons')
    .select('owner_id')
    .eq('id', lessonId)
    .eq('owner_id', profile.id)
    .single();
  if (lessonOwner) {
    return NextResponse.json({ error: 'already_member' }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from('lesson_members')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('user_id', profile.id)
    .single();
  if (existing) {
    return NextResponse.json({ error: 'already_member' }, { status: 409 });
  }

  // 멤버로 추가 (admin으로 RLS 우회)
  const admin = createAdminClient();
  const { error } = await admin.from('lesson_members').insert({
    lesson_id: lessonId,
    user_id: profile.id,
    role: 'member',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ userId: profile.id, displayName: profile.display_name ?? normalizedEmail });
}
