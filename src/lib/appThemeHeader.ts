import type { CSSProperties } from "react";

/** 사이드바 등 고정 브랜드 네이비 */
export const APP_SIDEBAR_BG = "#FFFFFF";

export function getAppShellHeaderSurface(): CSSProperties {
  return {
    background: "linear-gradient(135deg, #5044e3 0%, #4035c8 70%, #3a8e88 100%)",
    borderBottom: "1px solid #4035c8",
    boxShadow: "0 2px 12px 0 rgba(80,68,227,0.28)",
  };
}
