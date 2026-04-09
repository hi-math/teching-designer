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
  const [newItemType, setNewItemType] = useState<"folder" | "lesson" | null>(null);

  const handleNewItem = (type: "folder" | "lesson") => {
    setView("all");
    setNewItemType(type);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      <AppShellHeader style={getAppShellHeaderSurface()}>
        <div className="flex min-w-0 items-center px-1">
          <span className="text-[18px] font-bold tracking-tight text-white whitespace-nowrap">T-CID Assistant</span>
        </div>
        <div className="w-8 shrink-0" aria-hidden />
      </AppShellHeader>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          profile={profile}
          view={view}
          onViewChange={setView}
          onNewItem={handleNewItem}
        />
        <ProjectGrid
          view={view}
          userId={profile.id || "me"}
          newItemType={newItemType}
          onNewItemDone={() => setNewItemType(null)}
        />
      </div>
    </div>
  );
}
