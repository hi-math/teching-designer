"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfilePanel, { type UserProfile } from "@/components/dashboard/ProfilePanel";
import { AppShellBrandIcon, AppShellHeader } from "@/components/layout/AppShellHeader";
import { getAppShellHeaderSurface } from "@/lib/appThemeHeader";
import ChatInterface from "@/components/ChatInterface";
import TeamChatPanel from "@/components/TeamChatPanel";

// ─── 워크스페이스 UI 토큰 (세이지 테마 고정) ─────────────────────

const SIDEBAR_BG = "#FFFFFF";

// ─── 상수 ─────────────────────────────────────────────────────────

const PHASES = [
  { code: "T",  label: "팀 준비" },
  { code: "A",  label: "분석" },
  { code: "Ds", label: "설계" },
  { code: "DI", label: "개발/실행" },
  { code: "E",  label: "평가/성찰" },
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
        { code: "학습자 분석", label: "학습자 분석", description: "학습자의 특성을 분석한다.", badge: "초등 필수 · 중등 옵션" },
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
          <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
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
          <p className="text-[15px] text-gray-400">준비 중</p>
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
        className={`relative flex w-full items-center rounded-lg py-2.5 text-[16px] font-medium transition-colors ${
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        } ${
          active
            ? "bg-[#E4EAF2] font-semibold text-[#2E5068]"
            : "text-gray-500 hover:bg-[#F2F5FA] hover:text-[#2E5068]"
        }`}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[#2E5068]" />
        )}
        {icon}
        {!collapsed && label}
      </button>
      {children}
    </li>
  );
}

export default function WorkspaceShell({ lessonId: _lessonId }: { lessonId: string }) {
  const [activePhase, setActivePhase] = useState("T");
  const [activeSection, setActiveSection] = useState("T-1");
  const [projectTitle, setProjectTitle] = useState("이차방정식 수업설계");
  const [editingTitle, setEditingTitle] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"team" | "ai">("team");
  const [aiReady, setAiReady] = useState(false);
  const [activityInputs, setActivityInputs] = useState<Record<string, string>>({});
  const isHost = true;
  const router = useRouter();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleLeave = () => {
    setMenuOpen(false);
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

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  // 단계 변경 시 첫 번째 섹션으로 초기화
  useEffect(() => {
    const first = PHASE_SECTIONS[activePhase]?.[0]?.code;
    if (first) setActiveSection(first);
  }, [activePhase]);



  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 워크스페이스 모달 */}
      {activeModal && (
        <WorkModal title={activeModal} onClose={() => setActiveModal(null)} />
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

      {/* ── 전체 너비 헤더 (대시보드와 동일 양식) ── */}
      <AppShellHeader style={getAppShellHeaderSurface()}>
        {/* 좌: 앱 아이콘 + 프로젝트 제목 */}
        <div className="flex min-w-0 items-center gap-3">
          <AppShellBrandIcon />
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }}
              className="rounded border border-indigo-300 bg-white/95 px-3 py-1.5 text-[18px] font-semibold text-gray-900 outline-none ring-2 ring-white/30"
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="group flex min-w-0 items-center gap-2">
              <span className="truncate text-[20px] font-bold text-white drop-shadow-sm sm:text-[22px]">
                {projectTitle}
              </span>
              <svg className="h-3.5 w-3.5 shrink-0 text-white/50 opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* 우: 팀원 아바타 + 액션 */}
        <div className="flex shrink-0 items-center gap-3">

          <button className="flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-4 text-[15px] font-medium text-white transition hover:bg-white/25">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            공유
          </button>
          <button className="flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-4 text-[15px] font-medium text-white transition hover:bg-white/25">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            출력
          </button>
        </div>
      </AppShellHeader>

      {/* ── 사이드바 + 콘텐츠 + 푸터 ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#EDF1F8]">
      <div className="flex min-h-0 flex-1 overflow-hidden">

      {/* ── 좌측 사이드바 ── */}
      <aside
        style={{ backgroundColor: SIDEBAR_BG }}
        className={`flex h-full min-h-0 shrink-0 flex-col border-r border-gray-200 transition-all duration-200 ${
          sidebarCollapsed ? "w-14" : "w-[11%] min-w-[150px]"
        }`}
      >
        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-4">
          {/* 접기/펼치기 토글 */}
          <div className={`mb-3 flex ${sidebarCollapsed ? "justify-center" : "justify-end"}`}>
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

          {/* 수업설계 그룹 */}
          {!sidebarCollapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">수업설계</p>}
          {sidebarCollapsed && <div className="mb-1 mt-1 border-t border-gray-200" />}
          <ul className="space-y-0.5">
            {/* 설계도구 — 아코디언 */}
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
              label="설계도구"
              active={openAccordion === "설계도구"}
              collapsed={sidebarCollapsed}
              onClick={() => setOpenAccordion(openAccordion === "설계도구" ? null : "설계도구")}
            >
              {openAccordion === "설계도구" && !sidebarCollapsed && (
                <div className="ml-2 mt-0.5 overflow-hidden rounded-lg bg-gray-50 shadow-inner">
                  {["공유하기", "출력하기", "불러오기", "내보내기"].map((sub) => (
                    <button key={sub} onClick={() => setActiveModal(sub)}
                      className="w-full px-4 py-2 text-left text-[14px] text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600">
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </WorkNavButton>
            {/* 버전 관리 — 바로 모달 */}
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              label="버전 관리"
              active={activeModal === "버전 관리"}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveModal("버전 관리")}
            />
            {/* 성취기준 — 아코디언 */}
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              label="성취기준"
              active={openAccordion === "성취기준"}
              collapsed={sidebarCollapsed}
              onClick={() => setOpenAccordion(openAccordion === "성취기준" ? null : "성취기준")}
            >
              {openAccordion === "성취기준" && !sidebarCollapsed && (
                <div className="ml-2 mt-0.5 overflow-hidden rounded-lg bg-gray-50 shadow-inner">
                  {["검색하기", "추가하기"].map((sub) => (
                    <button key={sub} onClick={() => setActiveModal(sub)}
                      className="w-full px-4 py-2 text-left text-[14px] text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600">
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </WorkNavButton>
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
          {!sidebarCollapsed && <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">설정</p>}
          {sidebarCollapsed && <div className="mb-1 mt-4 border-t border-gray-200" />}
          <ul className="space-y-0.5">
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
              label="권한관리"
              active={activeModal === "권한관리"}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveModal("권한관리")}
            />
            <WorkNavButton
              icon={<svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
              label="채팅관리"
              active={activeModal === "채팅관리"}
              collapsed={sidebarCollapsed}
              onClick={() => setActiveModal("채팅관리")}
            />
          </ul>
        </nav>

        <div className="shrink-0 border-t border-gray-200">
          <button
            type="button"
            title={sidebarCollapsed ? (isHost ? "세션 종료하기" : "나가기") : undefined}
            onClick={handleLeave}
            className={`flex w-full items-center py-2.5 text-[16px] font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 ${
              sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && (isHost ? "세션 종료하기" : "나가기")}
          </button>
        </div>

        <div className="relative border-t border-gray-200 p-3" ref={menuRef}>
          {menuOpen && userProfile && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-200 px-3 py-2.5">
                <p className="truncate text-[16px] text-gray-500">{userProfile.email}</p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[18px] text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  프로필 설정
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[18px] text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
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
            className={`group flex w-full items-center rounded-lg px-2 py-2 transition-colors hover:bg-gray-100 ${
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
                <p className="truncate text-[16px] font-medium text-gray-800">
                  {userProfile?.display_name ?? userProfile?.email ?? "—"}
                </p>
                <p className="truncate text-[16px] text-gray-500">
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
          <main className="flex flex-1 flex-col overflow-hidden bg-white">
            {/* 단계 스테퍼 + 섹션 탭 통합 영역 */}
            <div className="shrink-0 pt-6" style={{ backgroundColor: "#F2F5FA" }}>

              {/* 상위 탭 — 언더라인 진행형 */}
              {(() => {
                const activeIdx = PHASES.findIndex((p) => p.code === activePhase);
                return (
                  <div className="flex items-end px-14 border-b border-[#D8E2F0]">
                    {PHASES.map((phase, idx) => {
                      const status =
                        idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'default';
                      return (
                        <div key={phase.code} className="flex items-center">
                          <button
                            onClick={() => setActivePhase(phase.code)}
                            className="flex items-center px-4 py-5 transition-colors hover:opacity-70"
                            style={{
                              borderBottom: `4px solid ${
                                status === 'active' ? '#534AB7' : 'transparent'
                              }`,
                              marginBottom: -1,
                            }}
                          >
                            <span
                              className="text-[20px] leading-none"
                              style={{
                                color:
                                  status === 'active'
                                    ? '#1C2B3A'
                                    : status === 'done'
                                    ? '#9AAAC0'
                                    : '#C8D4E4',
                                fontWeight: status === 'active' ? 600 : 400,
                              }}
                            >
                              {phase.label}
                            </span>
                          </button>
                          {idx < PHASES.length - 1 && (
                            <span className="text-[16px] text-[#C8D4E4] px-1 pb-1 select-none">›</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 하위 탭 — 버튼형 */}
              <div className="flex items-center gap-2 bg-[#F2F5FA] px-14 pt-8 pb-0">
                {(PHASE_SECTIONS[activePhase] ?? []).map((sec) => {
                  const isActive = activeSection === sec.code;
                  return (
                    <button
                      key={sec.code}
                      onClick={() => setActiveSection(sec.code)}
                      className={`shrink-0 px-2 py-1 text-[17px] font-medium transition-colors ${
                        isActive
                          ? "text-[#534AB7]"
                          : "text-[#9AAAC0] hover:text-[#534AB7]"
                      }`}
                    >
                      {sec.tabLabel}
                    </button>
                  );
                })}
              </div>

            </div>{/* 단계 스테퍼 + 섹션 탭 통합 영역 끝 */}

            {/* 선택된 섹션 콘텐츠 */}
            {(() => {
              const sec = (PHASE_SECTIONS[activePhase] ?? []).find((s) => s.code === activeSection);
              if (!sec) return null;
              return (
                <div className="flex-1 overflow-y-auto bg-[#F2F5FA] px-14 pt-4 pb-10">
                  {sec.activities.map((act) => (
                    <div key={act.code} className="mb-6 rounded-2xl border border-[#E4EBF5] bg-white p-6 shadow-sm">
                      <p className="mb-1.5 text-[13px] font-semibold tracking-wider text-indigo-400">{act.code}</p>
                      <div className="mb-4 flex items-start gap-5">
                        <div className="shrink-0">
                          <h2 className="text-xl font-semibold text-[#1C2B3A]">{act.label}</h2>
                          {act.badge && (
                            <span className="mt-1 inline-block rounded-full bg-[#F2F5FA] px-2.5 py-1 text-xs text-[#6B7A99]">
                              {act.badge}
                            </span>
                          )}
                        </div>
                        <div className="self-stretch border-l border-gray-200" />
                        <p className="flex-1 text-[17px] leading-relaxed text-[#6B7A99]">{act.description}</p>
                      </div>
                      <textarea
                        value={activityInputs[act.code] ?? ""}
                        onChange={(e) =>
                          setActivityInputs((prev) => ({ ...prev, [act.code]: e.target.value }))
                        }
                        placeholder="내용을 입력하세요…"
                        className="w-full min-h-[100px] resize-y rounded-xl border border-[#E2E8F4] bg-white px-4 py-3 text-[15px] leading-relaxed text-[#1C2B3A] placeholder-[#B0BEDA] outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </main>

          {/* ── 우측 패널 ────────────────────────────────────────────── */}
          <div className="flex w-[30%] min-w-[360px] shrink-0 flex-col border-l border-[#E2E8F4]">

            {/* 탭 헤더 */}
            <div className="shrink-0 flex border-b border-[#E2E8F4] bg-white">
              <button
                onClick={() => setRightTab("team")}
                className={`flex-1 py-3 text-[14px] font-semibold transition-colors ${
                  rightTab === "team"
                    ? "border-b-2 border-[#1C2B3A] text-[#1C2B3A]"
                    : "text-[#9AAAC0] hover:text-[#3A4560]"
                }`}
              >
                팀 채팅
              </button>
              <button
                onClick={() => setRightTab("ai")}
                className={`flex-1 py-3 text-[14px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  rightTab === "ai"
                    ? "border-b-2 border-[#6E8EAA] text-[#1C2B3A]"
                    : "text-[#9AAAC0] hover:text-[#3A4560]"
                }`}
              >
                Minerva AI
                {aiReady && (
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                )}
              </button>
            </div>

            {/* Minerva AI 탭 */}
            <div className={`flex-1 flex-col overflow-hidden bg-[#F7F9FD] ${rightTab === "ai" ? "flex" : "hidden"}`}>
              <ChatInterface
                stage={activePhase}
                onReady={() => setAiReady(true)}
                pageContext={{
                  projectTitle,
                  activePhase,
                  activeSection,
                  activityInputs,
                }}
              />
            </div>

            {/* 팀 채팅 패널 */}
            <div className={`flex-1 flex-col overflow-hidden ${rightTab === "team" ? "flex" : "hidden"}`}>
              <TeamChatPanel />
            </div>

          </div>

        </div>
      </div>

      {/* ── 푸터 ── */}
      <div className="shrink-0 h-8 bg-[#E4EAF4] border-t border-[#D0D8E8] flex items-center px-4">
        <p className="text-[11px] text-[#9AAAC0]">Teching Designer</p>
      </div>

    </div>
    </div>
  );
}
