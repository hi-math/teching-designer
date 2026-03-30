import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const cookieStore = await cookies();

  // response 객체를 먼저 생성하고 supabase 클라이언트에 전달해
  // setAll이 response 쿠키에도 직접 쓰도록 함
  const createSupabase = (response: NextResponse) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // 읽기 전용 컨텍스트에서 무시
              }
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

  // 이메일 인증 (회원가입 확인 링크)
  if (token_hash && type) {
    const response = NextResponse.redirect(`${origin}/dashboard`);
    const supabase = createSupabase(response);
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return response;
  }

  // Google OAuth 코드 교환
  if (code) {
    const response = NextResponse.redirect(`${origin}/dashboard`);
    const supabase = createSupabase(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
