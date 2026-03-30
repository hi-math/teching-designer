import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkspaceShell lessonId={id} />;
}
