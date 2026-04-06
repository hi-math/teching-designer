// ============================================================
// Minerva — Database Types
// Supabase 테이블 구조와 1:1 대응
// ============================================================

// ── 역할 ────────────────────────────────────────────────────
export type MemberRole = "owner" | "member" | "viewer";
export type LessonStatus = "ongoing" | "ended";
export type PhaseCode = "T" | "A" | "Ds" | "DI" | "E";
export type ChatRole = "user" | "assistant";

// ── 1. Folder ───────────────────────────────────────────────
export interface Folder {
  id: string;
  owner_id: string;
  title: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type FolderInsert = Pick<Folder, "title"> & {
  parent_id?: string | null;
};

// ── 2. Lesson ───────────────────────────────────────────────
export interface Lesson {
  id: string;
  owner_id: string;
  title: string;
  subject: string | null;
  folder_id: string | null;
  status: LessonStatus;
  current_phase: PhaseCode;
  bookmarked: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type LessonInsert = Pick<Lesson, "title"> & {
  subject?: string | null;
  folder_id?: string | null;
  status?: LessonStatus;
};

export type LessonUpdate = Partial<
  Pick<Lesson, "title" | "subject" | "folder_id" | "status" | "current_phase" | "bookmarked">
>;

// ── 3. LessonMember ─────────────────────────────────────────
export interface LessonMember {
  id: string;
  lesson_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

// 멤버 목록 조회 시 user 프로필 join
export interface LessonMemberWithProfile extends LessonMember {
  profile: {
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

// ── 4. ActivityContent ──────────────────────────────────────
// content 필드는 activity 종류에 따라 다른 구조를 가짐

/** 일반 텍스트 활동 */
export interface TextContent {
  type: "text";
  text: string;
}

/** 역할 분담 표 (T-2-1) */
export interface RoleTableContent {
  type: "role_table";
  rows: { name: string; role: string }[];
}

export type ActivityContentData = TextContent | RoleTableContent;

export interface ActivityContent {
  id: string;
  lesson_id: string;
  activity_code: string;
  content: ActivityContentData;
  version_number: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityContentUpsert = {
  lesson_id: string;
  activity_code: string;
  content: ActivityContentData;
};

// ── 5. ActivityVersion ──────────────────────────────────────
export interface ActivityVersion {
  id: string;
  lesson_id: string;
  activity_code: string;
  content: ActivityContentData;
  version_number: number;
  saved_by: string | null;
  note: string | null;
  saved_at: string;
}

// ── 6. TeamMessage ──────────────────────────────────────────
export interface TeamMessage {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  deleted_at: string | null;
}

export type TeamMessageInsert = {
  lesson_id: string;
  content: string;
  reply_to?: string | null;
};

// 채팅 렌더링 시 sender 정보 포함
export interface TeamMessageWithSender extends TeamMessage {
  sender: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  reply_message?: Pick<TeamMessage, "id" | "content" | "user_id"> | null;
}

// ── 7. AiMessage ────────────────────────────────────────────
export interface AiMessage {
  id: string;
  lesson_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  context_activity_code: string | null;
  created_at: string;
}

export type AiMessageInsert = {
  lesson_id: string;
  role: ChatRole;
  content: string;
  context_activity_code?: string | null;
};
