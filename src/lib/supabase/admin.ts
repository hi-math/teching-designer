import { createClient } from '@supabase/supabase-js';

/**
 * Service-role 클라이언트 — API 라우트에서만 사용.
 * RLS를 우회하므로 브라우저로 절대 노출하지 말 것.
 * 환경변수: SUPABASE_SERVICE_ROLE_KEY (NEXT_PUBLIC_ 아님)
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false } });
}
