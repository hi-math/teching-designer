import type { CSSProperties } from "react";

/** 사이드바 등 고정 브랜드 네이비 */
export const APP_SIDEBAR_BG = "#FFFFFF";

export function getAppShellHeaderSurface(): CSSProperties {
  return {
    backgroundColor: "#6B7FC4",
    borderBottom: "1px solid #5B6EB4",
    boxShadow: "0 2px 10px 0 rgba(80,96,180,0.20)",
  };
}
