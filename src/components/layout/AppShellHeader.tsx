"use client";

import type { CSSProperties, ReactNode } from "react";

/** 레이아웃만 (배경·하단선은 style로 테마별 지정) */
export const appShellHeaderClassName =
  "flex min-h-[3.75rem] shrink-0 items-center justify-between px-6";

type AppShellHeaderProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function AppShellHeader({ children, className = "", style }: AppShellHeaderProps) {
  return (
    <header
      style={style}
      className={`${appShellHeaderClassName} ${className}`.trim()}
    >
      {children}
    </header>
  );
}

/** 헤더 좌측 앱 아이콘 */
export function AppShellBrandIcon() {
  return (
    <img
      src="/logo.svg"
      alt="logo"
      className="h-9 w-9 shrink-0 object-contain"
    />
  );
}
