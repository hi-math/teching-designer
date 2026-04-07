"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfilePanel, { type UserProfile } from "@/components/dashboard/ProfilePanel";
import { AppShellBrandIcon, AppShellHeader } from "@/components/layout/AppShellHeader";
import { getAppShellHeaderSurface } from "@/lib/appThemeHeader";
import ChatInterface from "@/components/ChatInterface";
import TeamChatPanel from "@/components/TeamChatPanel";
import ReferenceModal from "@/components/workspace/ReferenceModal";
import StandardsModal, { type StandardItem } from "@/components/workspace/StandardsModal";
import IdeasModal, { type IdeaItem } from "@/components/workspace/IdeasModal";
import ShareModal from "@/components/workspace/ShareModal";

// ─── 워크스페이스 UI 토큰 (세이지 테마 고정) ─────────────────────

const SIDEBAR_BG = "#f1f4f9";

// ─── 상수 ─────────────────────────────────────────────────────────

const PHASES = [
  { code: "T",  label: "팀 준비",   english: "PHASE 01 — Team Prep",     description: "협력적 수업설계를 위한 팀 비전을 설정하고, 역할과 일정을 합의합니다." },
  { code: "A",  label: "분석",      english: "PHASE 02 — Analysis",       description: "수업 주제를 선정하고 핵심 아이디어와 성취 기준을 분석합니다." },
  { code: "Ds", label: "설계",      english: "PHASE 03 — Design",         description: "평가 계획, 문제 상황, 학습 활동 및 지원 도구를 설계합니다." },
  { code: "DI", label: "개발/실행", english: "PHASE 04 — Development",    description: "수업 자료를 개발하고 실제 수업을 실행하며 기록합니다." },
  { code: "E",  label: "평가/성찰", english: "PHASE 05 — Evaluation",     description: "수업과 설계 과정을 성찰하고 다음 설계를 위한 개선안을 도출합니다." },
];

type Activity = { code: string; label: string; description: string; badge?: string };
type PhaseSection = { code: string; label: string; tabLabel: string; activities: Activity[] };

const PHASE_SECTIONS: Record<string, PhaseSection[]> = {
  T: [
    {
      code: "T-1", label: "비전 설정", tabLabel: "팀 비전 및 설계 방향 설정",
      activities: [
        { code: "T-1-1", label: "비전 설정", description: "협력적 수업설계를 통해 실현하고자 하는 교육적인 목적에 대해 자유롭게 논의하고 공통의 비전을 설정한다." },
        { code: "T-1-2", label: "수업설계 방향 수립", description: "팀원들이 협력적 수업설계의 목적을 달성하기 위해 지향해야 할 수업설계의 방향을 설정한다." },
      ],
    },
    {
      code: "T-2", label: "역할 분담", tabLabel: "팀 운영 구조 수립",
      activities: [
        { code: "T-2-1", label: "역할 분담", description: "협력적 수업설계에 필요한 역할을 나열하고, 팀원들의 특성과 희망을 고려하여 역할을 배분한다." },
        { code: "T-2-2", label: "팀 규칙", description: "팀의 협력적 수업 설계를 위한 팀 규칙에 대해 논의하고, 팀원들의 상황을 고려하여 결정한다." },
        { code: "T-2-3", label: "팀 일정", description: "팀의 협력적 수업설계를 위한 팀 일정에 대해 논의하고, 팀원들의 상황을 고려하여 결정한다." },
        { code: "학습자 분석", label: "학습자 분석", description: "학습자의 특성을 분석한다." },
      ],
    },
  ],
  A: [
    {
      code: "A-1", label: "주제 선정", tabLabel: "수업 주제 선정",
      activities: [
        { code: "A-1-1", label: "주제 선정 기준", description: "팀원들이 주제선정기준에 대해 논의하고 조정한다." },
        { code: "A-1-2", label: "주제 선정", description: "팀원들이 협력적 수업 설계할 주제를 나열한다." },
      ],
    },
    {
      code: "A-2", label: "핵심 아이디어 분석", tabLabel: "학습 내용 분석 및 목표 진술",
      activities: [
        { code: "A-2-1", label: "핵심 아이디어 및 성취 기준 분석", description: "팀원들은 선정된 주제와 관련하여 학습자들이 학습해야 할 내용과 기능요소를 나열하고, 팀 자원에서 핵심적으로 반영할 내용과 기능을 조정한다." },
        { code: "A-2-2", label: "통합된 수업 목표", description: "팀원들은 내용요소, 기능요소 등을 결합하여 통합된 수업목표를 진술한다." },
      ],
    },
  ],
  Ds: [
    {
      code: "Ds-1", label: "평가 및 문제 설계", tabLabel: "평가·문제·학습활동 설계",
      activities: [
        { code: "Ds-1-1", label: "평가 계획", description: "수업목표에 적합한 평가 아이디어에 대해 논의하고, 최종결과와 활동과정상의 평가내용 및 방법을 조정한다." },
        { code: "Ds-1-2", label: "문제 상황", description: "팀원들은 문제상황에 대한 아이디어를 나열하고, 팀원들의 논의를 통해 조정한다." },
        { code: "Ds-1-3", label: "학습 활동 설계", description: "팀원들은 학습자들이 수행해야 할 학습활동을 나열하고, 팀원들의 논의를 통해 조정한다." },
      ],
    },
    {
      code: "Ds-2", label: "지원 도구 설계", tabLabel: "학습 지원 환경 설계",
      activities: [
        { code: "Ds-2-1", label: "지원 도구 설계", description: "학습활동을 지원하는 도구들을 각각의 활동과 연결하고, 공동의 논의를 통해 조정한다." },
        { code: "Ds-2-2", label: "스캐폴딩 설계", description: "각 활동에서 학습자들에게 필요한 스캐폴딩을 나열하고, 공동의 논의를 통해 조정한다." },
      ],
    },
  ],
  DI: [
    {
      code: "DI-1", label: "개발 및 프로토타이핑", tabLabel: "수업 자료 개발",
      activities: [
        { code: "DI-1-1", label: "개발 자료 목록", description: "팀의 학습활동 설계안 및 개별 교사의 설계안에 근거하여 교과별 개발할 자료 목록을 나열하고 팀원들의 논의를 통해 조정한다." },
        { code: "DI-AI", label: "AI 자료 프로토타이핑", description: "산출물을 확인하고, HUMAN IN THE LOOP를 경험해 보자." },
        { code: "DI-SIM", label: "수업 시뮬레이션", description: "시뮬레이션을 바탕으로 수업을 더 개선해 보자." },
      ],
    },
    {
      code: "DI-2", label: "수업 기록", tabLabel: "수업 실행 및 기록",
      activities: [
        { code: "DI-2-1", label: "수업 기록", description: "각 수업을 실행하고 수업의 주요 상황 또는 에피소드를 기록한다." },
      ],
    },
  ],
  E: [
    {
      code: "E-1", label: "수업 성찰", tabLabel: "수업 성찰 및 개선",
      activities: [
        { code: "E-1-1", label: "수업 성찰", description: "수업실행과정에서 집한 학습(평가) 자료에 근거하여 성찰 및 평가한 내용을 공유하고, 설계안 수립을 공동으로 개선한다." },
      ],
    },
    {
      code: "E-2", label: "수업설계 과정 성찰", tabLabel: "협력적 설계 과정 평가",
      activities: [
        { code: "E-2-1", label: "수업설계 과정 성찰", description: "각 단계별 협력적 수업설계 목표에 근거하여 활동 결과를 성찰하고 평가한다." },
      ],
    },
  ],
};


// ─── 버전 타입 ────────────────────────────────────────────────────

type Snapshot = {
  id: string;
  version_num: number;
  trigger: "auto" | "session_end" | "manual";
  created_at: string;
};

// ─── 버전 관리 모달 ───────────────────────────────────────────────

function VersionModal({
  snapshots,
  lessonId,
  onRestore,
  onClose,
}: {
  snapshots: Snapshot[];
  lessonId: string;
  onRestore: (contents: Record<string, { type: string; text?: string; status?: string }>) => Promise<void>;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { type: string; text?: string; status?: string }> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmSnap, setConfirmSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleExpand = async (snap: Snapshot) => {
    if (expandedId === snap.id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(snap.id);
    setDetail(null);
    const { data } = await createClient()
      .from("lesson_snapshots")
      .select("contents")
      .eq("id", snap.id)
      .single();
    if (data) setDetail(data.contents as Record<string, { type: string; text?: string; status?: string }>);
  };

  const handleRestore = async (snap: Snapshot) => {
    setRestoring(true);
    const { data } = await createClient()
      .from("lesson_snapshots")
      .select("contents")
      .eq("id", snap.id)
      .single();
    if (data) await onRestore(data.contents as Record<string, { type: string; text?: string; status?: string }>);
    setRestoring(false);
  };

  function formatTs(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex w-[560px] max-h-[78vh] flex-col rounded-2xl border border-gray-200 bg-white shadow-xl">

        {/* 복원 확인 다이얼로그 */}
        {confirmSnap && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/20">
            <div className="w-[340px] rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <div className="mb-1 flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-[15px] font-semibold text-gray-900">버전 복원</h3>
              </div>
              <p className="mb-1 text-[13px] text-[#5a6066]">
                <span className="font-semibold text-[#5044e3]">v{confirmSnap.version_num}</span> 으로 복원합니다.
              </p>
              <p className="mb-5 text-[13px] text-amber-600">입력 내용이 삭제될 수 있습니다.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmSnap(null)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-[13px] font-medium text-[#757b82] transition hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  disabled={restoring}
                  onClick={async () => {
                    await handleRestore(confirmSnap);
                    setConfirmSnap(null);
                  }}
                  className="flex-1 rounded-lg bg-[#5044e3] py-2 text-[13px] font-semibold text-white transition hover:bg-[#4035c8] disabled:opacity-40"
                >
                  {restoring ? "복원 중…" : "복원"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#5044e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-[17px] font-semibold text-gray-900">버전 관리</h2>
            <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[12px] font-medium text-[#757b82]">{snapshots.length}개</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 버전 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-[#adb2ba]">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[14px]">저장된 버전이 없습니다</p>
              <p className="text-[12px]">내용 입력 후 1분이 지나면 자동으로 버전이 생성됩니다</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {snapshots.map((snap, idx) => (
                <div key={snap.id} className="rounded-xl border border-[#eef0f6] bg-[#fafbff] overflow-hidden">
                  {/* 버전 행 */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-[#f3f4fc]"
                    onClick={() => handleExpand(snap)}
                  >
                    <div className="flex items-center gap-3">
                      {/* 깃 커밋 dot */}
                      <div className="relative flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full border-2 border-[#5044e3] bg-white" />
                        {idx < snapshots.length - 1 && (
                          <div className="absolute top-3 h-full w-px bg-[#dde3eb]" style={{ top: "12px", height: "calc(100% + 6px)" }} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] font-bold text-[#5044e3]">v{snap.version_num}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              snap.trigger === "session_end"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-indigo-50 text-indigo-500"
                            }`}
                          >
                            {snap.trigger === "session_end" ? "세션 종료" : "자동 저장"}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#adb2ba]">{formatTs(snap.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmSnap(snap); }}
                        className="rounded-lg border border-[#dde3eb] bg-white px-3 py-1 text-[12px] font-medium text-[#5a6066] transition hover:border-[#5044e3] hover:text-[#5044e3]"
                      >
                        복원
                      </button>
                      <svg
                        className={`h-4 w-4 text-[#adb2ba] transition-transform ${expandedId === snap.id ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 상세 내용 */}
                  {expandedId === snap.id && (
                    <div className="border-t border-[#eef0f6] bg-white px-4 py-3">
                      {!detail ? (
                        <p className="text-[13px] text-[#adb2ba]">불러오는 중…</p>
                      ) : Object.keys(detail).length === 0 ? (
                        <p className="text-[13px] text-[#adb2ba]">저장된 내용 없음</p>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {Object.entries(detail)
                            .filter(([, c]) => c.text?.trim())
                            .map(([code, c]) => (
                              <div key={code}>
                                <span className="font-mono text-[11px] font-bold text-[#5044e3]">{code}</span>
                                <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-[#5a6066]">{c.text}</p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 수업정보 모달 ────────────────────────────────────────────────

const GRADE_BUTTONS = ["중학교 1학년", "중학교 2학년", "중학교 3학년"];

const SUBJECT_BUTTONS = [
  "국어", "수학", "영어", "과학", "사회", "역사", "도덕",
  "기술·가정", "정보", "체육", "음악", "미술", "한문",
  "생활 일본어", "생활 중국어", "생활 프랑스어", "생활 독일어",
  "생활 스페인어", "생활 러시아어", "생활 아랍어", "생활 베트남어",
];

function toArr(v: string): string[] {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
function toStr(arr: string[]): string {
  return arr.join(",");
}

function LessonInfoModal({
  lessonId,
  title,
  targetGrade,
  relatedSubjects,
  onTitleChange,
  onTargetGradeChange,
  onRelatedSubjectsChange,
  onClose,
  readOnly = false,
}: {
  lessonId: string;
  title: string;
  targetGrade: string;
  relatedSubjects: string;
  onTitleChange: (v: string) => void;
  onTargetGradeChange: (v: string) => void;
  onRelatedSubjectsChange: (v: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [localTitle, setLocalTitle] = useState(title);
  const [selectedGrades, setSelectedGrades] = useState<string[]>(() => toArr(targetGrade));
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => toArr(relatedSubjects));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleConfirm = async () => {
    setSaving(true);
    const g = toStr(selectedGrades);
    const s = toStr(selectedSubjects);
    await createClient().from("lessons").update({
      title: localTitle || "새 수업설계",
      target_grade: g || null,
      related_subjects: s || null,
    }).eq("id", lessonId);
    onTitleChange(localTitle);
    onTargetGradeChange(g);
    onRelatedSubjectsChange(s);
    setSaving(false);
    onClose();
  };

  const toggleGrade = (g: string) =>
    setSelectedGrades((prev) =>
      prev.includes(g) ? prev.filter((v) => v !== g) : [...prev, g]
    );

  const toggleSubject = (s: string) =>
    setSelectedSubjects((prev) =>
      prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[700px] max-h-[88vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-8 py-6">
          <h2 className="text-[24px] font-bold text-gray-900">수업정보</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 폼 */}
        <div className="flex-1 overflow-y-auto space-y-8 px-8 py-7">

          {/* 수업 제목 */}
          <div>
            <label className="mb-2 block text-[14px] font-semibold text-[#5a6066]">수업 제목</label>
            <input
              value={localTitle}
              onChange={(e) => !readOnly && setLocalTitle(e.target.value)}
              readOnly={readOnly}
              placeholder="수업 제목을 입력하세요"
              className={`w-full rounded-xl bg-[#f1f4f9] px-4 py-3 text-[16px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:ring-2 focus:ring-[#5044e3]/20 ${readOnly ? "cursor-default" : ""}`}
            />
          </div>

          {/* 대상 학년 */}
          <div>
            <label className="mb-2.5 block text-[14px] font-semibold text-[#5a6066]">대상 학년</label>
            <div className="flex gap-2.5">
              {GRADE_BUTTONS.map((g) => (
                <button
                  key={g}
                  onClick={() => !readOnly && toggleGrade(g)}
                  disabled={readOnly}
                  className={`rounded-full px-6 py-2.5 text-[14px] font-medium transition ${
                    selectedGrades.includes(g)
                      ? "bg-[#5044e3] text-white"
                      : "bg-[#f1f4f9] text-[#757b82] hover:bg-[#e8eaf4] hover:text-[#5044e3]"
                  } ${readOnly ? "cursor-default" : ""}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 연계 과목 */}
          <div>
            <label className="mb-2.5 block text-[14px] font-semibold text-[#5a6066]">연계 과목</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_BUTTONS.map((s) => (
                <button
                  key={s}
                  onClick={() => !readOnly && toggleSubject(s)}
                  disabled={readOnly}
                  className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                    selectedSubjects.includes(s)
                      ? "bg-[#5044e3] text-white"
                      : "bg-[#f1f4f9] text-[#757b82] hover:bg-[#e8eaf4] hover:text-[#5044e3]"
                  } ${readOnly ? "cursor-default" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 푸터 */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-gray-100 px-8 py-5">
          {readOnly ? (
            <button
              onClick={onClose}
              className="rounded-xl bg-[#5044e3] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#4035c8]"
            >
              닫기
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-6 py-2.5 text-[14px] font-medium text-[#757b82] transition hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="rounded-xl bg-[#5044e3] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#4035c8] disabled:opacity-50"
              >
                {saving ? "저장 중…" : "완료"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 워크스페이스 모달 ────────────────────────────────────────────

function WorkModal({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[520px] rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-[18px] font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex h-40 items-center justify-center p-6">
          <p className="text-[16px] text-gray-400">준비 중</p>
        </div>
      </div>
    </div>
  );
}

// ─── 권한관리 모달 ────────────────────────────────────────────────

type Permissions = { phaseNav: boolean; complete: boolean; skip: boolean; opinion: boolean; titleEdit: boolean };

function PermissionsModal({
  permissions,
  onChange,
  onClose,
}: {
  permissions: Permissions;
  onChange: (p: Permissions) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const toggle = (key: keyof Permissions) => onChange({ ...permissions, [key]: !permissions[key] });

  const items: { key: keyof Permissions; label: string; desc: string }[] = [
    { key: "phaseNav", label: "단계 이동", desc: "ON: 참여자가 상위 탭으로 단계를 자유롭게 이동할 수 있습니다. OFF: 소유자의 단계를 따라갑니다." },
    { key: "complete", label: "완료", desc: "ON: 참여자가 카드의 완료 버튼을 사용할 수 있습니다." },
    { key: "skip", label: "건너뛰기", desc: "ON: 참여자가 카드의 건너뛰기 버튼을 사용할 수 있습니다." },
    { key: "titleEdit", label: "제목 수정", desc: "ON: 모든 사용자가 프로젝트 제목을 수정할 수 있습니다." },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[520px] rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#5044e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h2 className="text-[17px] font-semibold text-gray-900">권한 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 권한 목록 */}
        <div className="divide-y divide-gray-100 px-6 py-2">
          {items.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#2d3339]">{label}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#757b82]">{desc}</p>
              </div>
              {/* 토글 스위치 */}
              <button
                type="button"
                onClick={() => toggle(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${permissions[key] ? "bg-[#5044e3]" : "bg-gray-200"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${permissions[key] ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#5044e3] px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-[#4035c8]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

function WorkNavButton({
  active,
  onClick,
  icon,
  label,
  collapsed = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
  children?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        title={collapsed ? label : undefined}
        onClick={onClick}
        className={`flex w-full items-center rounded-full py-2.5 text-[16px] font-medium transition-colors outline-none focus:outline-none ${
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        } ${
          active
            ? "bg-[#5044e3]/10 font-semibold text-[#5044e3]"
            : "text-[#757b82] hover:bg-[#5044e3]/5 hover:text-[#5044e3]"
        }`}
      >
        {icon}
        {!collapsed && label}
      </button>
      {children}
    </li>
  );
}

export default function WorkspaceShell({ lessonId }: { lessonId: string }) {
  const [activePhase, setActivePhase] = useState("T");
  const [activeSection, setActiveSection] = useState("T-1");
  const [projectTitle, setProjectTitle] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [relatedSubjects, setRelatedSubjects] = useState("");
  const [titleSaveStatus, setTitleSaveStatus] = useState<"idle" | "saved">("idle");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"team" | "ai">("team");
  const [aiReady, setAiReady] = useState(false);
  const [activityInputs, setActivityInputs] = useState<Record<string, string>>({});
  const [activityStatus, setActivityStatus] = useState<Record<string, "active" | "completed" | "skipped">>({});
  const [selectedActivityCode, setSelectedActivityCode] = useState<string | null>(null);
  const activityStatusRef = useRef<Record<string, "active" | "completed" | "skipped">>({});

  // ── 의견묻기 ─────────────────────────────────────────────────
  type Member = { id: string; name: string; email: string; avatarUrl: string | null };
  // opinions: opinionKey(actCode__timestamp) → { question, hidden, actCode }
  // opinionResponses: opinionKey → { userId → response }
  const [lessonMembers, setLessonMembers] = useState<Member[]>([]);
  const [opinionModal, setOpinionModal] = useState<string | null>(null); // activityCode
  const [opinionDraft, setOpinionDraft] = useState("");
  const [opinions, setOpinions] = useState<Record<string, { question: string; hidden: boolean; actCode: string }>>({});
  const [opinionResponses, setOpinionResponses] = useState<Record<string, Record<string, string>>>({});
  const [myOpinionDrafts, setMyOpinionDrafts] = useState<Record<string, string>>({});
  const [editingOpinions, setEditingOpinions] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opinionChannelRef = useRef<any>(null);
  const [roleRows, setRoleRows] = useState<{ name: string; role: string }[]>([
    { name: "", role: "" }, { name: "", role: "" },
    { name: "", role: "" }, { name: "", role: "" },
  ]);
  // ── 버전 관리 ────────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  // ── 참고자료 ─────────────────────────────────────────────────
  type RefFile = { name: string; mime: string; content?: string; pdfData?: string };
  const [referenceFiles, setReferenceFiles] = useState<RefFile[]>([]);

  // ── 성취기준 ─────────────────────────────────────────────────
  const [selectedStandards, setSelectedStandards] = useState<StandardItem[]>([]);

  // ── 핵심아이디어 ──────────────────────────────────────────────
  const [selectedIdeas, setSelectedIdeas] = useState<IdeaItem[]>([]);

  const [isHost, setIsHost] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({
    phaseNav: false, complete: true, skip: true, opinion: true, titleEdit: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceChannelRef = useRef<any>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [ownerOffline, setOwnerOffline] = useState(false);
  const router = useRouter();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 자동저장 디바운스 타이머
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 미저장 콘텐츠 추적 (세션 종료 시 flush용)
  const pendingContent = useRef<Record<string, object>>({});
  const projectTitleRef = useRef("");
  // 버전 생성용 refs (클로저 의존성 없이 최신값 참조)
  const hasNewSavesRef = useRef(false);
  const nextVersionRef = useRef(1);
  const lastSnapshotTimeRef = useRef(0);
  const activityInputsRef = useRef<Record<string, string>>({});
  const userProfileRef = useRef<UserProfile | null>(null);

  // ── 유저 프로필 로드 ─────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata ?? {};
      setUserProfile({
        id: data.user.id,
        email: data.user.email ?? "",
        display_name: meta.display_name ?? meta.full_name ?? meta.name ?? null,
        school: meta.school ?? null,
        subject: meta.subject ?? null,
        avatar_url: meta.avatar_url ?? null,
      });
    });
  }, []);

  // ── 레슨 데이터 & 입력 내용 로드 ─────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const [lessonRes, contentsRes] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).single(),
        supabase.from("activity_contents").select("*").eq("lesson_id", lessonId),
      ]);

      if (lessonRes.data) {
        setProjectTitle(lessonRes.data.title);
        setActivePhase(lessonRes.data.current_phase ?? "T");
        setTargetGrade(lessonRes.data.target_grade ?? "");
        setRelatedSubjects(lessonRes.data.related_subjects ?? "");
        if (lessonRes.data.permissions) setPermissions(lessonRes.data.permissions as Permissions);
      }

      if (contentsRes.data) {
        const inputs: Record<string, string> = {};
        const statusMap: Record<string, "active" | "completed" | "skipped"> = {};
        const loadedOpinions: Record<string, { question: string; hidden: boolean; actCode: string }> = {};
        const loadedOpinionResponses: Record<string, Record<string, string>> = {};
        for (const row of contentsRes.data) {
          const code = row.activity_code as string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = row.content as any;
          if (code.endsWith("__opinion")) {
            if (c?.active !== false && c?.question) {
              const opinionKey = code.slice(0, -"__opinion".length);
              // new format: actCode__timestamp, old format: actCode (no timestamp)
              const m = opinionKey.match(/^(.+)__(\d+)$/);
              const actCodeFromKey = m ? m[1] : opinionKey;
              loadedOpinions[opinionKey] = { question: c.question, hidden: false, actCode: actCodeFromKey };
            }
            continue;
          }
          const resIdx = code.indexOf("__opinion_res_");
          if (resIdx !== -1) {
            const opinionKey = code.slice(0, resIdx);
            const uid = code.slice(resIdx + "__opinion_res_".length);
            if (!loadedOpinionResponses[opinionKey]) loadedOpinionResponses[opinionKey] = {};
            loadedOpinionResponses[opinionKey][uid] = c?.response ?? "";
            continue;
          }
          if (c.status === "completed" || c.status === "skipped") {
            statusMap[code] = c.status;
          }
          if (c.type === "text" && c.text !== undefined) {
            inputs[code] = c.text;
          } else if (c.type === "role_table" && code === "T-2-1" && c.rows) {
            setRoleRows(c.rows);
          }
        }
        setActivityInputs(inputs);
        setActivityStatus(statusMap);
        activityStatusRef.current = statusMap;
        if (Object.keys(loadedOpinions).length > 0) setOpinions(loadedOpinions);
        if (Object.keys(loadedOpinionResponses).length > 0) setOpinionResponses(loadedOpinionResponses);
      }

      // 최근 접근 시간 갱신
      supabase.from("lessons")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", lessonId);

      // 레슨 멤버 로드 + 현재 유저 역할 확인
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      const membersRes = await supabase
        .from("lesson_members")
        .select("user_id, role")
        .eq("lesson_id", lessonId);
      if (membersRes.data && membersRes.data.length > 0) {
        const myRow = membersRes.data.find((m: { user_id: string; role: string }) => m.user_id === currentUserId);
        setIsHost(myRow?.role === "owner");
        const ids = membersRes.data.map((m: { user_id: string }) => m.user_id);
        const profilesRes = await supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", ids);
        if (profilesRes.data) {
          setLessonMembers(
            profilesRes.data.map((p: { id: string; display_name: string | null; email: string | null; avatar_url: string | null }) => ({
              id: p.id,
              name: p.display_name ?? p.email ?? "알 수 없음",
              email: p.email ?? "",
              avatarUrl: p.avatar_url ?? null,
            }))
          );
        }
      }
    };
    load();

    // ── Realtime + Presence 설정 (async IIFE로 감싸서 await 사용 가능하게)
    const supabaseRt = createClient();
    // cleanup용 ref — IIFE 내에서 할당 후 cleanup에서 참조
    let rtChannel: ReturnType<typeof supabaseRt.channel> | null = null;
    let presenceChannel: ReturnType<typeof supabaseRt.channel> | null = null;
    let opinionChannel: ReturnType<typeof supabaseRt.channel> | null = null;
    let workspaceChannel: ReturnType<typeof supabaseRt.channel> | null = null;

    (async () => {
      // 세션이 준비될 때까지 대기 (첫 렌더 시 auth 미초기화 방지)
      await supabaseRt.auth.getSession();

      // ── 의견묻기 Broadcast 채널 (publication 설정 불필요) ──────
      opinionChannel = supabaseRt
        .channel(`opinions:${lessonId}`)
        .on("broadcast", { event: "question" }, ({ payload }) => {
          const { opinionKey, actCode, question } = payload as { opinionKey: string; actCode: string; question: string };
          setOpinions((prev) => ({ ...prev, [opinionKey]: { question, hidden: false, actCode } }));
        })
        .on("broadcast", { event: "delete_question" }, ({ payload }) => {
          const { opinionKey } = payload as { opinionKey: string };
          setOpinions((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
          setOpinionResponses((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
        })
        .on("broadcast", { event: "response" }, ({ payload }) => {
          const { opinionKey, userId, response } = payload as { opinionKey: string; userId: string; response: string };
          setOpinionResponses((prev) => ({
            ...prev,
            [opinionKey]: { ...(prev[opinionKey] ?? {}), [userId]: response },
          }));
        })
        .subscribe();
      opinionChannelRef.current = opinionChannel;

      // Workspace Broadcast: permissions + phase_change + title_change
      workspaceChannel = supabaseRt
        .channel(`workspace:${lessonId}`)
        .on("broadcast", { event: "permissions" }, ({ payload }) => {
          setPermissions(payload as Permissions);
        })
        .on("broadcast", { event: "phase_change" }, ({ payload }) => {
          setActivePhase((payload as { phase: string }).phase);
        })
        .on("broadcast", { event: "title_change" }, ({ payload }) => {
          setProjectTitle((payload as { title: string }).title);
        })
        .subscribe();
      workspaceChannelRef.current = workspaceChannel;

      // Realtime: 다른 참여자의 activity_contents 텍스트 변경 실시간 반영
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleContentChange = (payload: any) => {
        const row = payload.new as { lesson_id: string; activity_code: string; content: Record<string, unknown> };
        if (row.lesson_id !== lessonId) return;
        const { activity_code, content } = row;
        // 의견 관련 코드는 Broadcast로 처리 → 무시
        if (activity_code.includes("__opinion")) return;
        // 일반 텍스트
        if ((content as { text?: string })?.text !== undefined) {
          setActivityInputs((prev) => ({ ...prev, [activity_code]: (content as { text: string }).text }));
        }
      };

      rtChannel = supabaseRt
        .channel(`activity-contents:${lessonId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_contents" },
          handleContentChange
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "activity_contents" },
          handleContentChange
        )
        .on(
          "postgres_changes",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { event: "UPDATE", schema: "public", table: "lessons", filter: `id=eq.${lessonId}` } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const row = payload.new as { id: string; title?: string; current_phase?: string; permissions?: Permissions };
            if (row.id !== lessonId) return;
            // 다른 참여자가 변경한 경우만 반영 (소유자 본인은 로컬 업데이트 이미 반영됨)
            if (row.title !== undefined) setProjectTitle((prev) => prev === row.title ? prev : row.title!);
            if (row.current_phase !== undefined) setActivePhase((prev) => prev === row.current_phase ? prev : row.current_phase!);
            if (row.permissions !== undefined) setPermissions((prev) => JSON.stringify(prev) === JSON.stringify(row.permissions) ? prev : row.permissions!);
          }
        )
        .subscribe();

      // Presence: 소유자 오프라인 감지
      const [lessonData, { data: { user: me } }] = await Promise.all([
        supabaseRt.from("lessons").select("owner_id").eq("id", lessonId).single(),
        supabaseRt.auth.getUser(),
      ]);
      const ownerId = lessonData.data?.owner_id;
      const amOwner = me?.id === ownerId;

      presenceChannel = supabaseRt.channel(`presence:${lessonId}`, {
        config: { presence: { key: me?.id ?? "anon" } },
      });
      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel!.presenceState<{ userId: string }>();
          const ids: string[] = [];
          Object.values(state).forEach((arr) => arr.forEach((u) => ids.push(u.userId)));
          setOnlineUserIds(ids);
          if (!amOwner) setOwnerOffline(!ids.includes(ownerId ?? ""));
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          setOnlineUserIds((prev) => {
            const next = [...prev];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newPresences as any[]).forEach((p) => { if (p.userId && !next.includes(p.userId)) next.push(p.userId); });
            return next;
          });
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const leftIds = (leftPresences as any[]).map((p) => p.userId as string).filter(Boolean);
          setOnlineUserIds((prev) => prev.filter((id) => !leftIds.includes(id)));
          if (!amOwner && leftIds.includes(ownerId ?? "")) setOwnerOffline(true);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && me) {
            await presenceChannel!.track({ userId: me.id, role: amOwner ? "owner" : "member" });
          }
        });
    })();

    return () => {
      if (rtChannel) supabaseRt.removeChannel(rtChannel);
      if (presenceChannel) supabaseRt.removeChannel(presenceChannel);
      if (opinionChannel) supabaseRt.removeChannel(opinionChannel);
      if (workspaceChannel) supabaseRt.removeChannel(workspaceChannel);
    };
  }, [lessonId]);

  // ── lesson_members Realtime: 새 멤버 합류 시 아바타 즉시 반영 ──
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`lesson_members:${lessonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lesson_members", filter: `lesson_id=eq.${lessonId}` },
        async (payload) => {
          const newUserId = (payload.new as { user_id: string }).user_id;
          const { data } = await supabase
            .from("profiles")
            .select("id, display_name, email, avatar_url")
            .eq("id", newUserId)
            .single();
          if (data) {
            setLessonMembers((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, { id: data.id, name: data.display_name ?? data.email ?? "알 수 없음", email: data.email ?? "", avatarUrl: data.avatar_url ?? null }];
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lessonId]);

  // ── 버전 로드 ────────────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    const { data, error } = await createClient()
      .from("lesson_snapshots")
      .select("id, version_num, trigger, created_at")
      .eq("lesson_id", lessonId)
      .order("version_num", { ascending: false })
      .limit(30);
    if (error) { console.error("[snapshots] load error:", error.message, "| code:", error.code, "| details:", error.details); return; }
    if (data) {
      setSnapshots(data as Snapshot[]);
      if (data.length > 0) {
        const latest = data[0] as Snapshot;
        nextVersionRef.current = latest.version_num + 1;
        lastSnapshotTimeRef.current = new Date(latest.created_at).getTime();
      }
    }
  }, [lessonId]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // ── 참고자료 로드 (텍스트 파일은 내용도 포함) ──────────────
  const loadReferenceFiles = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("lesson-files")
      .list(lessonId, { sortBy: { column: "created_at", order: "desc" } });
    if (!data) return;

    const items = data.filter((f) => f.name !== ".emptyFolderPlaceholder");
    const results: { name: string; mime: string; content?: string; pdfData?: string }[] = [];

    for (const f of items) {
      const mime: string = (f as { metadata?: { mimetype?: string } }).metadata?.mimetype ?? "";
      const size: number = (f as { metadata?: { size?: number } }).metadata?.size ?? 0;
      const isPdf = mime === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const isText =
        !isPdf &&
        (mime.startsWith("text/") ||
          ["txt", "md", "csv", "json"].some((ext) => f.name.toLowerCase().endsWith("." + ext)));

      if (isPdf && size < 10 * 1024 * 1024) {
        // PDF → base64 (Claude native document block)
        const { data: blob } = await supabase.storage
          .from("lesson-files")
          .download(`${lessonId}/${f.name}`);
        if (blob) {
          const pdfData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          results.push({ name: f.name, mime: "application/pdf", pdfData });
        }
      } else if (isText && size < 60_000) {
        const { data: blob } = await supabase.storage
          .from("lesson-files")
          .download(`${lessonId}/${f.name}`);
        const content = blob ? await blob.text() : undefined;
        results.push({ name: f.name, mime, content });
      } else {
        results.push({ name: f.name, mime });
      }
    }
    setReferenceFiles(results);
  }, [lessonId]);

  useEffect(() => { loadReferenceFiles(); }, [loadReferenceFiles]);

  // ── 스냅샷 생성 (최대 10개 유지) ────────────────────────────
  const createSnapshot = useCallback(async (trigger: "auto" | "session_end") => {
    lastSnapshotTimeRef.current = Date.now();
    hasNewSavesRef.current = false;
    const versionNum = nextVersionRef.current++;

    const contents: Record<string, object> = {};
    for (const [code, text] of Object.entries(activityInputsRef.current)) {
      const status = activityStatusRef.current[code] ?? "active";
      contents[code] = { type: "text", text, status };
    }


    const supabase = createClient();
    await supabase.from("lesson_snapshots").insert({
      lesson_id: lessonId,
      version_num: versionNum,
      contents,
      trigger,
      saved_by: userProfileRef.current?.id ?? null,
    });

    // 10개 초과 시 오래된 것부터 삭제
    const { data: all } = await supabase
      .from("lesson_snapshots")
      .select("id")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (all && all.length > 10) {
      const toDelete = all.slice(0, all.length - 10).map((r: { id: string }) => r.id);
      await supabase.from("lesson_snapshots").delete().in("id", toDelete);
    }

    loadSnapshots();
  }, [lessonId, loadSnapshots]);

  // ── 자동저장 헬퍼 ────────────────────────────────────────────
  const scheduleSave = useCallback((activityCode: string, content: object) => {
    clearTimeout(saveTimers.current[activityCode]);
    saveTimers.current[activityCode] = setTimeout(() => {
      setTitleSaveStatus("saved");
      hasNewSavesRef.current = true;
      delete pendingContent.current[activityCode];

      const supabase = createClient();
      supabase.from("activity_contents").upsert(
        { lesson_id: lessonId, activity_code: activityCode, content },
        { onConflict: "lesson_id,activity_code" }
      ).then(({ error }) => {
        if (error) { console.error("[save] error", error); return; }
        // 마지막 버전 생성으로부터 1분 이상 지났으면 자동 버전 생성
        if (Date.now() - lastSnapshotTimeRef.current > 60_000) {
          createSnapshot("auto");
        }
      });
    }, 1000);
  }, [lessonId, createSnapshot]);


  // ── activity 텍스트 변경 ─────────────────────────────────────
  const handleActivityChange = useCallback((code: string, text: string) => {
    setActivityInputs((prev) => ({ ...prev, [code]: text }));
    setTitleSaveStatus("idle");
    const status = activityStatusRef.current[code] ?? "active";
    const content = { type: "text", text, status };
    pendingContent.current[code] = content;
    scheduleSave(code, content);
  }, [scheduleSave]);

  // ── 완료 / 건너뛰기 ──────────────────────────────────────────
  const handleActivityStatusChange = useCallback(async (code: string, newStatus: "active" | "completed" | "skipped") => {
    activityStatusRef.current = { ...activityStatusRef.current, [code]: newStatus };
    setActivityStatus((prev) => ({ ...prev, [code]: newStatus }));
    setTitleSaveStatus("saved");
    const text = activityInputs[code] ?? "";
    const rows = code === "T-2-1" ? undefined : undefined;
    const content = code === "T-2-1"
      ? { type: "role_table", rows: roleRows, status: newStatus }
      : { type: "text", text, status: newStatus };
    createClient().from("activity_contents").upsert(
      { lesson_id: lessonId, activity_code: code, content },
      { onConflict: "lesson_id,activity_code" }
    );
  }, [lessonId, activityInputs, roleRows]);

  // ── 역할 분담 변경 ───────────────────────────────────────────
  const handleRoleRowChange = useCallback((index: number, field: "name" | "role", value: string) => {
    setTitleSaveStatus("idle");
    setRoleRows((prev) => {
      const next = prev.map((r, j) => j === index ? { ...r, [field]: value } : r);
      pendingContent.current["T-2-1"] = { type: "role_table", rows: next };
      scheduleSave("T-2-1", { type: "role_table", rows: next });
      return next;
    });
  }, [scheduleSave]);


  // ── 단계 변경 (DB 저장 + Broadcast) ────────────────────────────
  const handlePhaseChange = useCallback(async (phase: string) => {
    setActivePhase(phase);
    await createClient().from("lessons").update({ current_phase: phase }).eq("id", lessonId);
    workspaceChannelRef.current?.send({ type: "broadcast", event: "phase_change", payload: { phase } });
  }, [lessonId]);

  // ── 권한 변경 (소유자만) ─────────────────────────────────────
  const handlePermissionsChange = useCallback(async (newPerms: Permissions) => {
    setPermissions(newPerms);
    await createClient().from("lessons").update({ permissions: newPerms }).eq("id", lessonId);
    workspaceChannelRef.current?.send({ type: "broadcast", event: "permissions", payload: newPerms });
  }, [lessonId]);

  const handleLeave = () => {
    setMenuOpen(false);
    router.refresh();
    router.push("/dashboard");
  };

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleOpenEdit = () => {
    setMenuOpen(false);
    setProfileModalOpen(true);
  };


  // projectTitle을 ref에 동기화 (beforeunload 클로저용)
  useEffect(() => { projectTitleRef.current = projectTitle; }, [projectTitle]);
  // 버전 생성 클로저용 ref 동기화
  useEffect(() => { activityInputsRef.current = activityInputs; }, [activityInputs]);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);

  // 세션 종료 시 미저장 내용 flush + 버전 생성 (keepalive fetch로 보장)
  useEffect(() => {
    const flush = () => {
      const supabase = createClient();
      // 타이틀 저장
      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
        const t = projectTitleRef.current;
        if (t.trim()) supabase.from("lessons").update({ title: t }).eq("id", lessonId);
      }
      // 콘텐츠 저장
      Object.entries(pendingContent.current).forEach(([code, content]) => {
        clearTimeout(saveTimers.current[code]);
        supabase.from("activity_contents").upsert(
          { lesson_id: lessonId, activity_code: code, content },
          { onConflict: "lesson_id,activity_code" }
        );
      });
      // 세션 종료 스냅샷 — keepalive fetch로 페이지 종료 후에도 전송 보장
      const versionNum = nextVersionRef.current++;
      const contents: Record<string, object> = {};
      for (const [code, text] of Object.entries(activityInputsRef.current)) {
        const status = activityStatusRef.current[code] ?? "active";
        contents[code] = { type: "text", text, status };
      }
      fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, version_num: versionNum, contents, trigger: "session_end" }),
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [lessonId]);

  // 단계 변경 시 첫 번째 섹션으로 초기화
  useEffect(() => {
    const first = PHASE_SECTIONS[activePhase]?.[0]?.code;
    if (first) setActiveSection(first);
  }, [activePhase]);



  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 소유자 오프라인 알림 */}
      {ownerOffline && !isHost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-[400px] rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <svg className="h-7 w-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="mb-2 text-[18px] font-bold text-gray-900">소유자가 오프라인 상태입니다</h2>
            <p className="mb-6 text-[14px] text-gray-500">
              소유자가 세션을 종료했습니다. 일부 기능이 제한될 수 있습니다.
            </p>
            <button
              onClick={() => setOwnerOffline(false)}
              className="w-full rounded-xl bg-[#5044e3] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#4035c8]"
            >
              계속 이용하기
            </button>
          </div>
        </div>
      )}

      {/* 공유 모달 */}
      {shareModalOpen && (
        <ShareModal
          lessonId={lessonId}
          members={[
            ...(userProfile ? [{ id: userProfile.id, name: userProfile.display_name ?? userProfile.email ?? "나", email: userProfile.email ?? "", avatarUrl: userProfile.avatar_url ?? null }] : []),
            ...lessonMembers.filter((m) => m.id !== userProfile?.id),
          ]}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* 워크스페이스 모달 */}
      {activeModal === "수업정보" ? (
        <LessonInfoModal
          lessonId={lessonId}
          title={projectTitle}
          targetGrade={targetGrade}
          relatedSubjects={relatedSubjects}
          onTitleChange={setProjectTitle}
          onTargetGradeChange={setTargetGrade}
          onRelatedSubjectsChange={setRelatedSubjects}
          onClose={() => setActiveModal(null)}
          readOnly={!isHost}
        />
      ) : activeModal === "버전 관리" ? (
        <VersionModal
          snapshots={snapshots}
          lessonId={lessonId}
          onClose={() => setActiveModal(null)}
          onRestore={async (contents) => {
            const supabase = createClient();
            await Promise.all(
              Object.entries(contents)
                .map(([code, content]) =>
                  supabase.from("activity_contents").upsert(
                    { lesson_id: lessonId, activity_code: code, content },
                    { onConflict: "lesson_id,activity_code" }
                  )
                )
            );
            const inputs: Record<string, string> = {};
            const statusMap: Record<string, "active" | "completed" | "skipped"> = {};
            for (const [code, c] of Object.entries(contents)) {
              if (c.text !== undefined) inputs[code] = c.text;
              if (c.status === "completed" || c.status === "skipped") statusMap[code] = c.status;
            }
            setActivityInputs(inputs);
            setActivityStatus(statusMap);
            activityStatusRef.current = statusMap;
            setActiveModal(null);
          }}
        />
      ) : activeModal === "성취기준" ? (
        <StandardsModal
          onClose={() => setActiveModal(null)}
          selectedStandards={selectedStandards}
          onSelectionChange={setSelectedStandards}
          readOnly={!isHost}
        />
      ) : activeModal === "핵심아이디어" ? (
        <IdeasModal
          onClose={() => setActiveModal(null)}
          selectedIdeas={selectedIdeas}
          onSelectionChange={setSelectedIdeas}
          readOnly={!isHost}
        />
      ) : activeModal === "참고자료" ? (
        <ReferenceModal
          lessonId={lessonId}
          onClose={() => setActiveModal(null)}
          onFilesChange={loadReferenceFiles}
        />
      ) : activeModal === "권한관리" ? (
        <PermissionsModal
          permissions={permissions}
          onChange={handlePermissionsChange}
          onClose={() => setActiveModal(null)}
        />
      ) : activeModal ? (
        <WorkModal title={activeModal} onClose={() => setActiveModal(null)} />
      ) : null}

      {/* 의견묻기 모달 */}
      {opinionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setOpinionModal(null); setOpinionDraft(""); } }}
        >
          <div className="w-[480px] rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-[17px] font-semibold text-gray-900">의견 묻기</h2>
              <button
                onClick={() => { setOpinionModal(null); setOpinionDraft(""); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <label className="mb-2 block text-[13px] font-medium text-[#757b82]">질문을 입력하세요</label>
              <textarea
                value={opinionDraft}
                onChange={(e) => setOpinionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (opinionDraft.trim() && opinionModal) {
                      const actCode = opinionModal;
                      const opinionKey = `${actCode}__${Date.now()}`;
                      const q = opinionDraft.trim();
                      // DB 저장 (페이지 새로고침 대비)
                      createClient().from("activity_contents").insert(
                        { lesson_id: lessonId, activity_code: `${opinionKey}__opinion`, content: { type: "opinion", question: q, active: true } }
                      );
                      // Broadcast로 모든 참여자에게 즉시 전파
                      opinionChannelRef.current?.send({ type: "broadcast", event: "question", payload: { opinionKey, actCode, question: q } });
                      setOpinions((prev) => ({ ...prev, [opinionKey]: { question: q, hidden: false, actCode } }));
                      setOpinionModal(null);
                      setOpinionDraft("");
                    }
                  }
                }}
                placeholder="팀원들에게 묻고 싶은 내용을 입력하세요…"
                autoFocus
                className="w-full min-h-[90px] resize-none rounded-xl bg-[#f1f4f9] px-4 py-3 text-[15px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:ring-2 focus:ring-[#5044e3]/20"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setOpinionModal(null); setOpinionDraft(""); }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-[14px] font-medium text-[#757b82] transition hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  disabled={!opinionDraft.trim()}
                  onClick={() => {
                    if (opinionDraft.trim() && opinionModal) {
                      const actCode = opinionModal;
                      const opinionKey = `${actCode}__${Date.now()}`;
                      const q = opinionDraft.trim();
                      // DB 저장 (페이지 새로고침 대비)
                      createClient().from("activity_contents").insert(
                        { lesson_id: lessonId, activity_code: `${opinionKey}__opinion`, content: { type: "opinion", question: q, active: true } }
                      );
                      // Broadcast로 모든 참여자에게 즉시 전파
                      opinionChannelRef.current?.send({ type: "broadcast", event: "question", payload: { opinionKey, actCode, question: q } });
                      setOpinions((prev) => ({ ...prev, [opinionKey]: { question: q, hidden: false, actCode } }));
                      setOpinionModal(null);
                      setOpinionDraft("");
                    }
                  }}
                  className="rounded-lg bg-[#5044e3] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#4035c8] disabled:opacity-40"
                >
                  질문 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 수정 모달 */}
      {profileModalOpen && userProfile && (
        <ProfilePanel
          profile={userProfile}
          onClose={() => setProfileModalOpen(false)}
          onSave={(updated) => {
            setUserProfile(updated);
            setProfileModalOpen(false);
          }}
        />
      )}

      {/* ── 전체 너비 헤더 ── */}
      <AppShellHeader style={getAppShellHeaderSurface()}>
        {/* 좌: 로고 자리 + 사이드바 너비만큼 띄운 후 프로젝트 제목 */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* 로고 플레이스홀더 — 사이드바 너비와 맞춤 */}
          <span className="shrink-0 text-[15px] font-black tracking-widest text-white/80 uppercase">로고</span>
          <div className={`shrink-0 ${sidebarCollapsed ? "w-14" : "w-[11%] min-w-[150px]"}`} />
          {/* 저장 표식 + 타이틀 */}
          <div className="flex items-center gap-3">
            <div
              className={`relative inline-grid rounded-lg px-2.5 py-1 border transition-colors duration-200 ${
                !isHost && !permissions.titleEdit
                  ? "border-transparent"
                  : "border-white/20 hover:border-white/40 focus-within:border-white/60"
              }`}
            >
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1 whitespace-pre text-[22px] font-extrabold tracking-tight"
              >
                {projectTitle || "제목 없음"}
              </span>
              <input
                ref={titleInputRef}
                value={projectTitle}
                onChange={(e) => {
                  if (!isHost && !permissions.titleEdit) return;
                  const val = e.target.value;
                  setProjectTitle(val);
                  setTitleSaveStatus("idle");
                  if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
                  titleTimerRef.current = setTimeout(() => {
                    if (val.trim() && lessonId) {
                      createClient().from("lessons").update({ title: val }).eq("id", lessonId)
                        .then(({ error }) => { if (error) console.error('[title] DB save error:', error.message); });
                      workspaceChannelRef.current?.send({ type: "broadcast", event: "title_change", payload: { title: val } });
                    }
                    setTitleSaveStatus("saved");
                    setTimeout(() => setTitleSaveStatus("idle"), 1500);
                  }, 800);
                }}
                readOnly={!isHost && !permissions.titleEdit}
                placeholder="제목 없음"
                className={`col-start-1 row-start-1 w-full bg-transparent text-[22px] font-extrabold text-white outline-none tracking-tight placeholder-white/40 ${!isHost && !permissions.titleEdit ? "cursor-default" : ""}`}
              />
            </div>
            {/* 저장 상태 메시지 */}
            <span
              className="text-[12px] text-white/70 whitespace-nowrap transition-opacity duration-700"
              style={{ opacity: titleSaveStatus === "saved" ? 1 : 0 }}
            >
              변경사항이 저장되었습니다
            </span>
          </div>
        </div>
        {/* 우: 멤버 아바타 + 액션 버튼 */}
        <div className="flex shrink-0 items-center gap-3">
          {/* 전체 멤버 아바타 (본인 포함) */}
          {(() => {
            const me: Member | null = userProfile
              ? { id: userProfile.id, name: userProfile.display_name ?? userProfile.email ?? "나", email: userProfile.email ?? "", avatarUrl: userProfile.avatar_url ?? null }
              : null;
            const onlineSet = new Set(onlineUserIds);
            // 온라인 유저만 표시 (Presence 미등록 상태면 본인만)
            const others = lessonMembers.filter((m) => m.id !== userProfile?.id && onlineSet.has(m.id));
            const all = me ? [me, ...others] : others;
            const colors = ["bg-[#3D5A7A]","bg-[#4A7A5A]","bg-[#7A5A3D]","bg-[#5A3D7A]","bg-[#7A3D5A]"];
            return all.length > 0 ? (
              <div className="flex items-center -space-x-2 mr-1">
                {all.slice(0, 6).map((m, idx) => {
                  let n = 0; for (let i = 0; i < m.id.length; i++) n += m.id.charCodeAt(i);
                  const color = colors[n % colors.length];
                  const isMe = idx === 0 && !!me;
                  return (
                    <div key={m.id} className="group relative">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={m.name}
                          className={`h-8 w-8 rounded-full object-cover ${isMe ? "border-2 border-white" : "border-2 border-white/40"}`}
                        />
                      ) : (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${color} text-[13px] font-bold text-white ${isMe ? "border-2 border-white" : "border-2 border-white/40"}`}>
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {isMe ? `${m.name} (나)` : m.name}
                      </div>
                    </div>
                  );
                })}
                {all.length > 6 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-[12px] font-semibold text-white">
                    +{all.length - 6}
                  </div>
                )}
              </div>
            ) : null;
          })()}

          <button
            onClick={() => setShareModalOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-4 text-[16px] font-medium text-white transition hover:bg-white/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            공유
          </button>

          <button className="flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-4 text-[16px] font-medium text-white transition hover:bg-white/25">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            출력
          </button>
        </div>
      </AppShellHeader>

      {/* ── 사이드바 + 콘텐츠 + 푸터 ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fd]">
      <div className="flex min-h-0 flex-1 overflow-hidden">

      {/* ── 좌측 사이드바 ── */}
      <aside
        style={{ backgroundColor: SIDEBAR_BG }}
        className={`flex h-full min-h-0 shrink-0 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-14" : "w-[11%] min-w-[150px]"
        }`}
      >
        {/* 접기/펼치기 토글 */}
        <div className={`flex shrink-0 px-2 pt-2 pb-1 ${sidebarCollapsed ? "justify-center pt-4" : "justify-end"}`}>
          <button
            type="button"
            title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        <nav className={`flex flex-1 flex-col overflow-y-auto px-2 py-2 ${sidebarCollapsed ? "hidden" : ""}`}>

          {/* 수업설계 그룹 */}
          {!sidebarCollapsed && <p className="mb-1.5 px-3 text-[12px] font-semibold uppercase tracking-wider text-[#adb2ba]">수업설계</p>}
          {sidebarCollapsed && <div className="mb-1 mt-1 h-px bg-[#adb2ba]/30" />}
          <ul className="space-y-0.5">
            {/* 설계도구 — 아코디언 */}
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
              label="기본정보"
              active={openAccordion === "기본정보"}
              collapsed={sidebarCollapsed}
              onClick={() => setOpenAccordion(openAccordion === "기본정보" ? null : "기본정보")}
            >
              {openAccordion === "기본정보" && !sidebarCollapsed && (
                <div className="ml-2 mt-0.5 overflow-hidden rounded-xl bg-[#f8f9fd]">
                  {["수업정보", "성취기준", "핵심아이디어"].map((sub) => (
                    <button key={sub} onClick={() => setActiveModal(sub)}
                      className="w-full rounded-full px-4 py-2 text-left text-[15px] text-[#757b82] transition hover:text-[#5044e3]">
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </WorkNavButton>
            {/* 버전 관리 — 소유자만 */}
            {isHost && (
              <WorkNavButton
                icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="버전 관리"
                active={activeModal === "버전 관리"}
                collapsed={sidebarCollapsed}
                onClick={() => { loadSnapshots(); setActiveModal("버전 관리"); }}
              />
            )}
            {/* 참고자료 — 바로 모달 */}
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
              label="참고자료"
              active={activeModal === "참고자료"}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveModal("참고자료")}
            />
          </ul>

          {/* 설정 그룹 */}
          {!sidebarCollapsed && <p className="mb-1.5 mt-5 px-3 text-[12px] font-semibold uppercase tracking-wider text-[#adb2ba]">설정</p>}
          {sidebarCollapsed && <div className="mb-1 mt-4 h-px bg-[#adb2ba]/30" />}
          <ul className="space-y-0.5">
            {/* 권한관리 — 소유자만 */}
            {isHost && (
              <WorkNavButton
                icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                label="권한관리"
                active={activeModal === "권한관리"}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveModal("권한관리")}
              />
            )}
            {/* 채팅관리 — 소유자만 */}
            {isHost && (
              <WorkNavButton
                icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                label="채팅관리"
                active={activeModal === "채팅관리"}
                collapsed={sidebarCollapsed}
                onClick={() => setActiveModal("채팅관리")}
              />
            )}
          </ul>
        </nav>

        <div className={`shrink-0 px-2 pb-1 ${sidebarCollapsed ? "hidden" : ""}`}>
          <button
            type="button"
            title={sidebarCollapsed ? (isHost ? "세션 종료하기" : "나가기") : undefined}
            onClick={handleLeave}
            className={`flex w-full items-center rounded-full py-2.5 text-[16px] font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 ${
              sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && (isHost ? "세션 종료하기" : "나가기")}
          </button>
        </div>

        <div className={`relative p-3 ${sidebarCollapsed ? "hidden" : ""}`} ref={menuRef}>
          {menuOpen && userProfile && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl bg-white shadow-[0px_8px_24px_rgba(45,51,57,0.12)]">
              <div className="px-3 py-2.5">
                <p className="truncate text-[14px] text-[#757b82]">{userProfile.email}</p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-[15px] text-[#5a6066] transition-colors hover:bg-[#5044e3]/5 hover:text-[#5044e3]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  프로필 설정
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-[15px] text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            title={sidebarCollapsed ? (userProfile?.display_name ?? userProfile?.email ?? "프로필") : undefined}
            onClick={() => userProfile && setMenuOpen((v) => !v)}
            className={`group flex w-full items-center rounded-full px-2 py-2 transition-colors hover:bg-[#5044e3]/5 ${
              sidebarCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt="프로필"
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                {(userProfile?.display_name ?? userProfile?.email ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[14px] font-semibold text-[#2d3339]">
                  {userProfile?.display_name ?? userProfile?.email ?? "—"}
                </p>
                <p className="truncate text-[13px] text-[#757b82]">
                  {userProfile?.school ??
                    userProfile?.subject ??
                    (isHost ? "Host" : "Editor")}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── 워크스페이스 + 채팅 ── */}
      <div className="flex flex-1 overflow-hidden">

          {/* ── 워크스페이스 ───────────────────────────────────────── */}
          <main className="flex flex-1 flex-col overflow-hidden bg-[#f8f9fd]">
            {/* 단계 스테퍼 + 섹션 탭 통합 영역 */}
            <div className="shrink-0 pt-3" style={{ backgroundColor: "#f8f9fd" }}>

              {/* 상위 탭 — pill 진행형 */}
              {(() => {
                const activeIdx = PHASES.findIndex((p) => p.code === activePhase);
                return (
                  <div className="flex items-center gap-2 px-8 py-4">
                    {PHASES.map((phase, idx) => {
                      const status =
                        idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'default';
                      return (
                        <div key={phase.code} className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (!isHost && !permissions.phaseNav) return;
                              handlePhaseChange(phase.code);
                            }}
                            className={`flex w-40 items-center gap-2.5 rounded-full pl-2 pr-4 py-2 transition-all ${!isHost && !permissions.phaseNav ? "cursor-default" : ""}`}
                            style={{
                              backgroundColor: status === 'active' ? '#5044e3' : '#f1f4f9',
                            }}
                            onMouseEnter={(e) => { if (status !== 'active' && (isHost || permissions.phaseNav)) e.currentTarget.style.backgroundColor = '#e8eaf0'; }}
                            onMouseLeave={(e) => { if (status !== 'active') e.currentTarget.style.backgroundColor = '#f1f4f9'; }}
                          >
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] font-bold leading-none"
                              style={{
                                backgroundColor: status === 'active' ? 'rgba(255,255,255,0.25)' : status === 'done' ? '#adb2ba' : '#dde3eb',
                                color: status === 'active' ? '#fff' : status === 'done' ? '#fff' : '#adb2ba',
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className="text-[18px] font-semibold leading-tight"
                              style={{
                                color: status === 'active' ? '#fff' : status === 'done' ? '#757b82' : '#adb2ba',
                              }}
                            >
                              {phase.label}
                            </span>
                          </button>
                          {idx < PHASES.length - 1 && (
                            <div className="h-px w-4 shrink-0 bg-[#dde3eb]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}


            </div>{/* 단계 스테퍼 통합 영역 끝 */}

            {/* 콘텐츠 */}
            {(() => {
              const activePhaseData = PHASES.find((p) => p.code === activePhase);
              const allActivities = (PHASE_SECTIONS[activePhase] ?? []).flatMap((s) => s.activities);
              return (
                <div className="flex-1 overflow-y-auto bg-[#f8f9fd] px-14 pt-8 pb-10">
                  <div className="mb-8">
                    <div className="flex items-baseline gap-4">
                      <span className="text-6xl font-black text-[#5044e3]/20 leading-none">{activePhaseData?.code}</span>
                      <h2 className="text-3xl font-bold text-[#2d3339]">{activePhaseData?.label}</h2>
                    </div>
                    <p className="mt-2 text-[16px] leading-relaxed text-[#5a6066]">{activePhaseData?.description}</p>
                  </div>
                  {allActivities.map((act) => {
                    const st = activityStatus[act.code] ?? "active";
                    const locked = st === "completed" || st === "skipped";
                    return (
                      <div
                        key={act.code}
                        onClick={() => {
                          setSelectedActivityCode(act.code);
                          setRightTab("ai");
                        }}
                        className={`mb-6 rounded-2xl p-6 border transition-colors cursor-pointer ${
                          st === "completed" ? "bg-[#eff8ff] border-[#bae0ff]"
                          : st === "skipped"  ? "bg-[#f5f6f8] border-[#e2e4ea]"
                          : "bg-white border-transparent"
                        } ${selectedActivityCode === act.code ? "ring-2 ring-[#5044e3]" : ""}`}
                      >
                        {/* 헤더: 코드 + 토글 버튼 */}
                        <div className="mb-2 flex items-center justify-between">
                          <p className={`text-[13px] font-bold tracking-widest uppercase ${locked ? "text-[#adb2ba]" : "text-[#5044e3]"}`}>
                            {act.code}
                          </p>
                          <div className="flex flex-row gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedActivityCode(act.code); handleActivityStatusChange(act.code, st === "completed" ? "active" : "completed"); }}
                              disabled={!isHost && !permissions.complete}
                              className={`rounded-md px-3 py-1 text-[12px] font-medium transition ${
                                st === "completed"
                                  ? "bg-[#bae0ff] text-[#0369a1]"
                                  : "bg-[#f1f4f9] text-[#adb2ba] hover:bg-[#e8ebf0]"
                              } ${!isHost && !permissions.complete ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              완료
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedActivityCode(act.code); handleActivityStatusChange(act.code, st === "skipped" ? "active" : "skipped"); }}
                              disabled={!isHost && !permissions.skip}
                              className={`rounded-md px-3 py-1 text-[12px] font-medium transition ${
                                st === "skipped"
                                  ? "bg-[#e2e4ea] text-[#5a6066]"
                                  : "bg-[#f1f4f9] text-[#adb2ba] hover:bg-[#e8ebf0]"
                              } ${!isHost && !permissions.skip ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              건너뛰기
                            </button>
                            {isHost && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedActivityCode(act.code); setOpinionModal(act.code); }}
                                className="rounded-md px-3 py-1 text-[12px] font-medium transition bg-[#f1f4f9] text-[#adb2ba] hover:bg-[#ede9fb] hover:text-[#5044e3]"
                              >
                                의견묻기
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 제목 + 설명 */}
                        <div className="mb-4 flex flex-col gap-1.5">
                          <div>
                            <h3 className={`text-xl font-semibold ${locked ? "text-[#adb2ba]" : "text-[#2d3339]"}`}>
                              {act.label}
                            </h3>
                            {act.badge && (
                              <span className="mt-1 inline-block rounded-full bg-[#f1f4f9] px-2.5 py-1 text-xs text-[#757b82]">
                                {act.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[16px] leading-relaxed text-[#5a6066]">{act.description}</p>
                        </div>

                        {/* 입력 영역 */}
                        {act.code === "T-2-1" ? (
                          <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                            {roleRows.map((row, i) => (
                              <div key={i} className="flex overflow-hidden rounded-xl bg-[#f1f4f9]">
                                <input
                                  value={row.name}
                                  onChange={(e) => handleRoleRowChange(i, "name", e.target.value)}
                                  disabled={locked}
                                  placeholder={i === 0 ? "팀장 이름" : "이름"}
                                  className="w-[40%] border-none bg-transparent px-3 py-3 text-[15px] text-[#2d3339] placeholder-[#adb2ba] outline-none disabled:opacity-50"
                                />
                                <div className="w-px bg-[#adb2ba]/30 self-stretch" />
                                <input
                                  value={row.role}
                                  onChange={(e) => handleRoleRowChange(i, "role", e.target.value)}
                                  disabled={locked}
                                  placeholder="역할"
                                  className="flex-1 border-none bg-transparent px-3 py-3 text-[15px] text-[#2d3339] placeholder-[#adb2ba] outline-none disabled:opacity-50"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            value={activityInputs[act.code] ?? ""}
                            onChange={(e) => handleActivityChange(act.code, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={locked}
                            placeholder="내용을 입력하세요…"
                            className="w-full min-h-[100px] resize-y rounded-xl border-none bg-[#f1f4f9] px-4 py-3 text-[16px] leading-relaxed text-[#2d3339] placeholder-[#adb2ba] outline-none transition focus:ring-2 focus:ring-[#5044e3]/20 disabled:opacity-60 disabled:resize-none"
                          />
                        )}

                        {/* 의견묻기 섹션 — opinionKey별로 스택 */}
                        {Object.entries(opinions)
                          .filter(([, o]) => o.actCode === act.code)
                          .map(([opinionKey, opinionData]) => {
                          const myId = userProfile?.id ?? "";
                          const myResponse = opinionResponses[opinionKey]?.[myId];
                          const hasSubmitted = !!myResponse;
                          const allResponses = Object.entries(opinionResponses[opinionKey] ?? {});
                          // 멤버 이름 조회 (소유자 포함)
                          const allMembers = [
                            ...(userProfile ? [{ id: userProfile.id, name: userProfile.display_name ?? userProfile.email ?? "나" }] : []),
                            ...lessonMembers.filter((m) => m.id !== userProfile?.id),
                          ];
                          const getName = (uid: string) => allMembers.find((m) => m.id === uid)?.name ?? uid;

                          return (
                            <div key={opinionKey} className="mt-4 rounded-xl border border-[#e0e2f0] bg-[#f8f9ff] p-4" onClick={(e) => e.stopPropagation()}>
                              {/* 헤더 */}
                              <div className="mb-3 flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#5044e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-[14px] font-semibold text-[#5044e3]">{opinionData.question}</p>
                                </div>
                                {isHost && (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      onClick={() => setOpinions((prev) => ({ ...prev, [opinionKey]: { ...prev[opinionKey], hidden: !prev[opinionKey].hidden } }))}
                                      title={opinionData.hidden ? "보이기" : "숨기기"}
                                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#adb2ba] transition hover:bg-[#e8eaf4] hover:text-[#5044e3]"
                                    >
                                      {opinionData.hidden
                                        ? <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      }
                                    </button>
                                    <button
                                      onClick={() => {
                                        createClient().from("activity_contents").update(
                                          { content: { type: "opinion", question: opinionData.question, active: false } }
                                        ).eq("lesson_id", lessonId).eq("activity_code", `${opinionKey}__opinion`);
                                        opinionChannelRef.current?.send({ type: "broadcast", event: "delete_question", payload: { opinionKey } });
                                        setOpinions((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
                                        setOpinionResponses((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
                                      }}
                                      title="삭제"
                                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#adb2ba] transition hover:bg-red-50 hover:text-red-400"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {!opinionData.hidden && (
                                <div className="space-y-3">
                                  {/* 내 답변 입력 (미제출이거나 수정 중) */}
                                  {(!hasSubmitted || editingOpinions.has(opinionKey)) ? (
                                    <div className="flex gap-2">
                                      <input
                                        value={myOpinionDrafts[opinionKey] ?? ""}
                                        onChange={(e) => setMyOpinionDrafts((prev) => ({ ...prev, [opinionKey]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            const resp = myOpinionDrafts[opinionKey]?.trim();
                                            if (!resp) return;
                                            createClient().from("activity_contents").upsert(
                                              { lesson_id: lessonId, activity_code: `${opinionKey}__opinion_res_${myId}`, content: { type: "opinion_response", response: resp } },
                                              { onConflict: "lesson_id,activity_code" }
                                            );
                                            opinionChannelRef.current?.send({ type: "broadcast", event: "response", payload: { opinionKey, userId: myId, response: resp } });
                                            setOpinionResponses((prev) => ({ ...prev, [opinionKey]: { ...(prev[opinionKey] ?? {}), [myId]: resp } }));
                                            setMyOpinionDrafts((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
                                            setEditingOpinions((prev) => { const n = new Set(prev); n.delete(opinionKey); return n; });
                                          }
                                        }}
                                        autoFocus={editingOpinions.has(opinionKey)}
                                        placeholder="의견을 입력하세요…"
                                        className="flex-1 rounded-lg border border-[#dde3eb] bg-white px-3 py-2 text-[14px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:border-[#5044e3]"
                                      />
                                      <button
                                        disabled={!myOpinionDrafts[opinionKey]?.trim()}
                                        onClick={() => {
                                          const resp = myOpinionDrafts[opinionKey]?.trim();
                                          if (!resp) return;
                                          createClient().from("activity_contents").upsert(
                                            { lesson_id: lessonId, activity_code: `${opinionKey}__opinion_res_${myId}`, content: { type: "opinion_response", response: resp } },
                                            { onConflict: "lesson_id,activity_code" }
                                          );
                                          opinionChannelRef.current?.send({ type: "broadcast", event: "response", payload: { opinionKey, userId: myId, response: resp } });
                                          setOpinionResponses((prev) => ({ ...prev, [opinionKey]: { ...(prev[opinionKey] ?? {}), [myId]: resp } }));
                                          setMyOpinionDrafts((prev) => { const n = { ...prev }; delete n[opinionKey]; return n; });
                                          setEditingOpinions((prev) => { const n = new Set(prev); n.delete(opinionKey); return n; });
                                        }}
                                        className="shrink-0 rounded-lg bg-[#5044e3] px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4035c8] disabled:opacity-40"
                                      >
                                        전송
                                      </button>
                                    </div>
                                  ) : null}

                                  {/* 내 제출 답변 표시 + 수정 버튼 */}
                                  {hasSubmitted && !editingOpinions.has(opinionKey) && (
                                    <div className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-semibold text-indigo-700">
                                        {getName(myId).charAt(0)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-indigo-600">나의 답변</p>
                                        <p className="text-[14px] leading-snug text-[#2d3339]">{myResponse}</p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setMyOpinionDrafts((prev) => ({ ...prev, [opinionKey]: myResponse ?? "" }));
                                          setEditingOpinions((prev) => new Set([...prev, opinionKey]));
                                        }}
                                        className="shrink-0 rounded-md border border-[#dde3eb] bg-white px-2 py-1 text-[12px] font-medium text-[#5a6066] transition hover:bg-gray-50"
                                      >
                                        수정
                                      </button>
                                    </div>
                                  )}

                                  {/* 다른 사람 답변 목록 */}
                                  {allResponses.filter(([uid, r]) => uid !== myId && r.trim()).length > 0 && (
                                    <div className="space-y-2">
                                      {allResponses.filter(([uid, r]) => uid !== myId && r.trim()).map(([uid, resp]) => (
                                        <div key={uid} className="flex items-start gap-2">
                                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                                            {getName(uid).charAt(0)}
                                          </div>
                                          <div>
                                            <p className="text-[12px] font-semibold text-[#5a6066]">{getName(uid)}</p>
                                            <p className="text-[14px] leading-snug text-[#2d3339]">{resp}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </main>

          {/* ── 우측 패널 ────────────────────────────────────────────── */}
          <div className="flex w-[30%] min-w-[360px] shrink-0 flex-col bg-white shadow-[-4px_0px_24px_rgba(45,51,57,0.06)]">

            {/* 탭 헤더 */}
            <div className="shrink-0 flex bg-white border-b border-[#adb2ba]/20">
              <button
                onClick={() => setRightTab("team")}
                className={`flex-1 py-3.5 text-[15px] font-semibold transition-colors ${
                  rightTab === "team"
                    ? "border-b-2 border-[#5044e3] text-[#2d3339]"
                    : "text-[#757b82] hover:text-[#2d3339]"
                }`}
              >
                팀 채팅
              </button>
              <button
                onClick={() => setRightTab("ai")}
                className={`flex-1 py-3.5 text-[15px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  rightTab === "ai"
                    ? "border-b-2 border-[#5044e3] text-[#2d3339]"
                    : "text-[#757b82] hover:text-[#2d3339]"
                }`}
              >
                Minerva AI
                {aiReady && (
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                )}
              </button>
            </div>

            {/* Minerva AI 탭 */}
            <div className={`flex-1 flex-col overflow-hidden bg-white ${rightTab === "ai" ? "flex" : "hidden"}`}>
              <ChatInterface
                stage={activePhase}
                onReady={() => setAiReady(true)}
                pageContext={(() => {
                  // 의견묻기 데이터를 멤버 이름으로 매핑
                  const allMembers = [
                    ...(userProfile ? [{ id: userProfile.id, name: userProfile.display_name ?? userProfile.email ?? "나" }] : []),
                    ...lessonMembers.filter((m) => m.id !== userProfile?.id),
                  ];
                  const opinionsForContext = Object.entries(opinions).reduce<
                    { activityCode: string; question: string; responses: { name: string; text: string }[] }[]
                  >((acc, [opKey, data]) => {
                    const named = Object.entries(opinionResponses[opKey] ?? {})
                      .filter(([, text]) => text.trim())
                      .map(([memberId, text]) => {
                        const member = allMembers.find((m) => m.id === memberId);
                        return { name: member?.name ?? memberId, text };
                      });
                    if (named.length > 0) {
                      acc.push({ activityCode: data.actCode, question: data.question, responses: named });
                    }
                    return acc;
                  }, []);
                  return {
                    projectTitle,
                    activePhase,
                    activeSection,
                    activityInputs,
                    selectedActivityCode: selectedActivityCode ?? undefined,
                    referenceFiles: referenceFiles.length > 0 ? referenceFiles : undefined,
                    selectedStandards: selectedStandards.length > 0 ? selectedStandards : undefined,
                    selectedIdeas: selectedIdeas.length > 0 ? selectedIdeas : undefined,
                    opinions: opinionsForContext.length > 0 ? opinionsForContext : undefined,
                  };
                })()}
                lessonId={lessonId}
                userId={userProfile?.id ?? ""}
              />
            </div>

            {/* 팀 채팅 패널 */}
            <div className={`flex-1 flex-col overflow-hidden ${rightTab === "team" ? "flex" : "hidden"}`}>
              {userProfile && <TeamChatPanel lessonId={lessonId} currentUserId={userProfile.id} />}
            </div>

          </div>

        </div>
      </div>

      {/* ── 푸터 ── */}
      <div className="shrink-0 h-8 bg-[#f1f4f9] flex items-center px-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[#adb2ba]">Teaching Designer</p>
      </div>

    </div>
    </div>
  );
}
