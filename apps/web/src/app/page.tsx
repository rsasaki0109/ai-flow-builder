import { getServerContainer } from "../server/container.js";
import { FlowListClient } from "../features/flows/components/flow-list-client.js";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { config, flowService } = getServerContainer();
  const flows = await flowService.list({ limit: 50 });

  return (
    <FlowListClient
      aiEnabled={config.aiProvider !== "disabled"}
      initialItems={flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        revision: flow.revision,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
      }))}
    />
  );
}
