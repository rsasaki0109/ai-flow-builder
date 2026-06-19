import { FlowNotFoundError } from "../../../server/errors.js";
import { getServerContainer } from "../../../server/container.js";
import { EditorShell } from "../../../features/editor/components/editor-shell.js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface FlowEditorPageProps {
  params: Promise<{ flowId: string }>;
}

export default async function FlowEditorPage({ params }: FlowEditorPageProps) {
  const { flowId } = await params;

  try {
    const flow = await getServerContainer().flowService.get(flowId);
    return <EditorShell flow={flow} />;
  } catch (error) {
    if (error instanceof FlowNotFoundError) {
      notFound();
    }

    throw error;
  }
}
