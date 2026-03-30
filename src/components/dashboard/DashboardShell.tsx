"use client";

import { useState } from "react";
import { AppShellHeader } from "@/components/layout/AppShellHeader";
import { getAppShellHeaderSurface } from "@/lib/appThemeHeader";
import Sidebar from "./Sidebar";
import ProjectGrid from "./ProjectGrid";
import type { UserProfile } from "./ProfilePanel";

export type View = "recent" | "all" | "mine" | "shared" | "ongoing" | "ended" | "trash";

export default function DashboardShell({ profile }: { profile: UserProfile }) {
  const [view, setView] = useState<View>("all");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <AppShellHeader style={getAppShellHeaderSurface()}>
        <div className="flex min-w-0 items-center gap-2.5 px-1">
          <img src="/documents.png" alt="logo" className="h-9 w-9 object-contain" />
          <span className="text-[16px] font-bold leading-tight text-white">LOGO</span>
        </div>
        <div className="w-8 shrink-0" aria-hidden />
      </AppShellHeader>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar profile={profile} view={view} onViewChange={setView} />
        <ProjectGrid view={view} userId={profile.id || "me"} />
      </div>
    </div>
  );
}
