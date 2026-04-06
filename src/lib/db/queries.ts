// ============================================================
// Minerva — DB Query Helpers (client-side)
// 모든 함수는 createClient()를 직접 호출하므로
// "use client" 컴포넌트 또는 클라이언트 전용 훅에서 사용
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type {
  Folder, FolderInsert,
  Lesson, LessonInsert, LessonUpdate,
  LessonMember, LessonMemberWithProfile,
  ActivityContent, ActivityContentUpsert,
  ActivityVersion,
  TeamMessage, TeamMessageInsert, TeamMessageWithSender,
  AiMessage, AiMessageInsert,
} from "./types";

// ── 헬퍼 ────────────────────────────────────────────────────
function db() {
  return createClient();
}

// ============================================================
// FOLDERS
// ============================================================

/** 현재 사용자의 폴더 트리 전체 조회 */
export async function getFolders(): Promise<Folder[]> {
  const { data, error } = await db()
    .from("folders")
    .select("*")
    .is("deleted_at", null)
    .order("title");
  if (error) throw error;
  return data as Folder[];
}

export async function createFolder(input: FolderInsert): Promise<Folder> {
  const { data, error } = await db()
    .from("folders")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Folder;
}

export async function renameFolder(id: string, title: string): Promise<void> {
  const { error } = await db()
    .from("folders")
    .update({ title })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await db()
    .from("folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}


// ============================================================
// LESSONS
// ============================================================

/** 대시보드 목록: 내 lesson + 참여 중인 lesson */
export async function getLessons(): Promise<Lesson[]> {
  const { data, error } = await db()
    .from("lessons")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as Lesson[];
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  const { data, error } = await db()
    .from("lessons")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data as Lesson;
}

export async function createLesson(input: LessonInsert): Promise<Lesson> {
  const { data, error } = await db()
    .from("lessons")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Lesson;
}

export async function updateLesson(id: string, patch: LessonUpdate): Promise<void> {
  const { error } = await db()
    .from("lessons")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** 휴지통 이동 (soft delete) */
export async function deleteLesson(id: string): Promise<void> {
  const { error } = await db()
    .from("lessons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** 휴지통에서 복원 */
export async function restoreLesson(id: string): Promise<void> {
  const { error } = await db()
    .from("lessons")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}

/** 완전 삭제 (휴지통에서) */
export async function hardDeleteLesson(id: string): Promise<void> {
  const { error } = await db()
    .from("lessons")
    .delete()
    .eq("id", id);
  if (error) throw error;
}


// ============================================================
// LESSON MEMBERS  (팀장 / 팀원 / 참고)
// ============================================================

export async function getLessonMembers(lessonId: string): Promise<LessonMember[]> {
  const { data, error } = await db()
    .from("lesson_members")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("joined_at");
  if (error) throw error;
  return data as LessonMember[];
}

// TODO: auth.users 테이블은 직접 join 불가 — user 프로필 테이블(public.profiles)을
//       별도로 만들어 display_name, avatar_url 등을 저장하면 아래 join이 가능합니다.
//       지금은 lesson_members만 반환합니다.
export async function getLessonMembersWithProfiles(
  lessonId: string
): Promise<LessonMemberWithProfile[]> {
  const { data, error } = await db()
    .from("lesson_members")
    .select("*, profile:profiles(display_name, email, avatar_url)")
    .eq("lesson_id", lessonId)
    .order("joined_at");
  if (error) throw error;
  return data as LessonMemberWithProfile[];
}

/** 멤버 초대 (이메일로 user_id 먼저 조회 후 호출) */
export async function inviteMember(
  lessonId: string,
  userId: string,
  role: LessonMember["role"] = "member"
): Promise<LessonMember> {
  const { data, error } = await db()
    .from("lesson_members")
    .insert({ lesson_id: lessonId, user_id: userId, role })
    .select()
    .single();
  if (error) throw error;
  return data as LessonMember;
}

export async function updateMemberRole(
  lessonId: string,
  userId: string,
  role: LessonMember["role"]
): Promise<void> {
  const { error } = await db()
    .from("lesson_members")
    .update({ role })
    .eq("lesson_id", lessonId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(lessonId: string, userId: string): Promise<void> {
  const { error } = await db()
    .from("lesson_members")
    .delete()
    .eq("lesson_id", lessonId)
    .eq("user_id", userId);
  if (error) throw error;
}


// ============================================================
// ACTIVITY CONTENTS  (단계별 입력 내용)
// ============================================================

/** 특정 activity의 현재 내용 조회 */
export async function getActivityContent(
  lessonId: string,
  activityCode: string
): Promise<ActivityContent | null> {
  const { data, error } = await db()
    .from("activity_contents")
    .select("*")
    .eq("lesson_id", lessonId)
    .eq("activity_code", activityCode)
    .single();
  if (error) return null;
  return data as ActivityContent;
}

/** lesson의 모든 activity 내용 한 번에 조회 */
export async function getAllActivityContents(
  lessonId: string
): Promise<ActivityContent[]> {
  const { data, error } = await db()
    .from("activity_contents")
    .select("*")
    .eq("lesson_id", lessonId);
  if (error) throw error;
  return data as ActivityContent[];
}

/**
 * activity 내용 저장 (upsert).
 * 저장 전 현재 버전을 activity_versions에 백업한 뒤 업데이트합니다.
 */
export async function saveActivityContent(
  input: ActivityContentUpsert,
  note?: string
): Promise<ActivityContent> {
  const supabase = db();

  // 1) 기존 버전 조회
  const existing = await getActivityContent(input.lesson_id, input.activity_code);

  // 2) 버전 히스토리에 현재 내용 백업
  if (existing) {
    await supabase.from("activity_versions").insert({
      lesson_id:      existing.lesson_id,
      activity_code:  existing.activity_code,
      content:        existing.content,
      version_number: existing.version_number,
      saved_by:       existing.updated_by,
      note:           note ?? null,
    });
  }

  const nextVersion = existing ? existing.version_number + 1 : 1;

  // 3) 현재 내용 upsert
  const { data, error } = await supabase
    .from("activity_contents")
    .upsert({
      lesson_id:      input.lesson_id,
      activity_code:  input.activity_code,
      content:        input.content,
      version_number: nextVersion,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityContent;
}


// ============================================================
// ACTIVITY VERSIONS  (버전 목록 조회)
// ============================================================

export async function getActivityVersions(
  lessonId: string,
  activityCode: string
): Promise<ActivityVersion[]> {
  const { data, error } = await db()
    .from("activity_versions")
    .select("*")
    .eq("lesson_id", lessonId)
    .eq("activity_code", activityCode)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data as ActivityVersion[];
}


// ============================================================
// TEAM MESSAGES  (팀 채팅)
// ============================================================

export async function getTeamMessages(
  lessonId: string,
  limit = 100
): Promise<TeamMessage[]> {
  const { data, error } = await db()
    .from("team_messages")
    .select("*")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as TeamMessage[];
}

// TODO: sender 프로필을 함께 가져오려면 public.profiles 테이블이 필요합니다.
export async function getTeamMessagesWithSenders(
  lessonId: string,
  limit = 100
): Promise<TeamMessageWithSender[]> {
  const { data, error } = await db()
    .from("team_messages")
    .select("*, sender:profiles(display_name, avatar_url)")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as TeamMessageWithSender[];
}

export async function sendTeamMessage(input: TeamMessageInsert): Promise<TeamMessage> {
  const { data, error } = await db()
    .from("team_messages")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as TeamMessage;
}

export async function softDeleteTeamMessage(id: string): Promise<void> {
  const { error } = await db()
    .from("team_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Realtime 구독: 팀 채팅 신규 메시지 */
export function subscribeTeamMessages(
  lessonId: string,
  onInsert: (msg: TeamMessage) => void
) {
  return db()
    .channel(`team_messages:${lessonId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "team_messages",
        filter: `lesson_id=eq.${lessonId}`,
      },
      (payload) => onInsert(payload.new as TeamMessage)
    )
    .subscribe();
}


// ============================================================
// AI MESSAGES  (Minerva AI 채팅)
// ============================================================

export async function getAiMessages(
  lessonId: string,
  limit = 100
): Promise<AiMessage[]> {
  const { data, error } = await db()
    .from("ai_messages")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as AiMessage[];
}

export async function saveAiMessage(input: AiMessageInsert): Promise<AiMessage> {
  const { data, error } = await db()
    .from("ai_messages")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as AiMessage;
}

/** AI 채팅 기록 전체 삭제 (lesson 기준) */
export async function clearAiMessages(lessonId: string): Promise<void> {
  const { error } = await db()
    .from("ai_messages")
    .delete()
    .eq("lesson_id", lessonId);
  if (error) throw error;
}
