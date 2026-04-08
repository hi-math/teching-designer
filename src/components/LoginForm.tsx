"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Neomorphic token ────────────────────────────────────────────
const BG = "#e8eaf0";

const raised = {
  backgroundColor: BG,
  boxShadow: "6px 6px 12px rgba(0,0,0,0.08), -6px -6px 12px rgba(255,255,255,0.6)",
} as const;

const inset = {
  backgroundColor: BG,
  boxShadow: "inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.5)",
} as const;

const raisedSm = {
  backgroundColor: BG,
  boxShadow: "3px 3px 7px rgba(0,0,0,0.07), -3px -3px 7px rgba(255,255,255,0.55)",
} as const;

// ─── Component ───────────────────────────────────────────────────
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const afterLoginPath = inviteToken ? `/invite/${inviteToken}` : "/dashboard";

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const next = inviteToken ? `/invite/${inviteToken}` : "/dashboard";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setError("이메일 인증이 완료되지 않았습니다. 가입 시 받은 이메일의 링크를 클릭해 주세요.");
      } else if (
        error.message.toLowerCase().includes("invalid login credentials") ||
        error.message.toLowerCase().includes("invalid credentials")
      ) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.refresh();
    router.push(afterLoginPath);
  };

  return (
    <div
      style={{ backgroundColor: BG }}
      className="flex min-h-screen items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-[400px]">

        {/* ── 로고 ── */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <div
            style={raised}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl"
          >
            <img src="/logo.svg" alt="Minerva" className="h-11 w-11 object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-semibold" style={{ color: "#1f2937" }}>
              로그인
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "#9ca3af" }}>
              계정에 로그인하세요
            </p>
          </div>
        </div>

        {/* ── 카드 ── */}
        <div style={raised} className="rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* 이메일 */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-medium"
                style={{ color: "#4b5563" }}
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={inset}
                className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1f2937] placeholder-[#b0b4be] outline-none transition focus-visible:ring-2 focus-visible:ring-[#6366f1]/25"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[13px] font-medium"
                  style={{ color: "#4b5563" }}
                >
                  비밀번호
                </label>
                <a
                  href="#"
                  className="text-[12px] font-medium transition"
                  style={{ color: "#6366f1" }}
                >
                  비밀번호 찾기
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inset}
                  className="w-full rounded-xl px-4 py-3 pr-11 text-[14px] text-[#1f2937] placeholder-[#b0b4be] outline-none transition focus-visible:ring-2 focus-visible:ring-[#6366f1]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition"
                  style={{ color: "#9ca3af" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#6366f1")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 로그인 상태 유지 */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                style={raisedSm}
                className="group relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                onClick={() => {
                  const cb = document.getElementById("remember") as HTMLInputElement | null;
                  if (cb) cb.checked = !cb.checked;
                }}
              >
                <input id="remember" type="checkbox" className="sr-only" />
                <svg
                  className="hidden h-3 w-3 group-[.checked]:block"
                  style={{ color: "#6366f1" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <label htmlFor="remember" className="cursor-pointer text-[13px]" style={{ color: "#6b7280" }}>
                로그인 상태 유지
              </label>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div
                style={inset}
                className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-[13px] leading-relaxed text-red-500">{error}</p>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading
                  ? "linear-gradient(135deg, #818cf8, #a78bfa)"
                  : "linear-gradient(135deg, #6366f1, #7c3aed)",
                boxShadow: loading
                  ? "inset 3px 3px 8px rgba(0,0,0,0.15), inset -2px -2px 6px rgba(255,255,255,0.1)"
                  : "4px 4px 10px rgba(99,102,241,0.35), -2px -2px 8px rgba(255,255,255,0.5)",
              }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* ── 구분선 ── */}
          <div className="my-6 flex items-center gap-3">
            <div
              className="h-px flex-1"
              style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.7), 0 -1px 0 rgba(0,0,0,0.05)" }}
            />
            <span className="text-[12px]" style={{ color: "#b0b4be" }}>또는</span>
            <div
              className="h-px flex-1"
              style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.7), 0 -1px 0 rgba(0,0,0,0.05)" }}
            />
          </div>

          {/* ── 구글 로그인 ── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            style={raised}
            className="flex w-full items-center justify-center gap-3 rounded-xl py-3 text-[14px] font-medium transition-all duration-150 active:scale-[0.98]"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "8px 8px 16px rgba(0,0,0,0.1), -8px -8px 16px rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = raised.boxShadow;
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.5)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = raised.boxShadow;
            }}
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span style={{ color: "#374151" }}>Google로 로그인</span>
          </button>
        </div>

        {/* ── 회원가입 ── */}
        <p className="mt-7 text-center text-[13px]" style={{ color: "#9ca3af" }}>
          계정이 없으신가요?{" "}
          <a
            href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}
            className="font-semibold transition"
            style={{ color: "#6366f1" }}
          >
            회원가입
          </a>
        </p>
      </div>
    </div>
  );
}
