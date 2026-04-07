import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/?invite=${id}`);
  return <WorkspaceShell lessonId={id} />;
}
