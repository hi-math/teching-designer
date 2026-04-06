import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/invite/[token]  → invite info (lesson title, email restriction)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('lesson_invites')
    .select('id, lesson_id, email, expires_at, used_by')
    .eq('token', token)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
  if (invite.used_by) return NextResponse.json({ error: 'Invite already used' }, { status: 410 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
  }

  const { data: lesson } = await admin
    .from('lessons')
    .select('id, title')
    .eq('id', invite.lesson_id)
    .single();

  return NextResponse.json({
    lessonId: invite.lesson_id,
    lessonTitle: lesson?.title ?? '수업 프로젝트',
    emailRequired: invite.email ?? null,
  });
}

// POST /api/invite/[token]  → accept invite, join as member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('lesson_invites')
    .select('id, lesson_id, email, expires_at, used_by')
    .eq('token', token)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
  if (invite.used_by) return NextResponse.json({ error: 'Invite already used' }, { status: 410 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
  }

  // 이메일 제한 확인
  if (invite.email) {
    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    const userEmail = authUser?.user?.email?.toLowerCase().trim();
    if (userEmail !== invite.email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
    }
  }

  // 이미 멤버인지 확인
  const { data: existing } = await admin
    .from('lesson_members')
    .select('id, role')
    .eq('lesson_id', invite.lesson_id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    // 멤버로 추가
    const { error: memberErr } = await admin.from('lesson_members').insert({
      lesson_id: invite.lesson_id,
      user_id: user.id,
      role: 'member',
    });
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  // 초대 사용 완료 처리
  await admin
    .from('lesson_invites')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  return NextResponse.json({ lessonId: invite.lesson_id });
}
