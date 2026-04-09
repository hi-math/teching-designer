import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const aritaDotum = localFont({
  src: [
    { path: "../../public/font/AritaDotumKR-Thin.ttf",     weight: "100", style: "normal" },
    { path: "../../public/font/AritaDotumKR-Light.ttf",    weight: "300", style: "normal" },
    { path: "../../public/font/AritaDotumKR-Medium.ttf",   weight: "500", style: "normal" },
    { path: "../../public/font/AritaDotumKR-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/font/AritaDotumKR-Bold.ttf",     weight: "700", style: "normal" },
  ],
  variable: "--font-arita",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Minerva",
  description: "협력적 수업설계 AI 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className={`${aritaDotum.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
