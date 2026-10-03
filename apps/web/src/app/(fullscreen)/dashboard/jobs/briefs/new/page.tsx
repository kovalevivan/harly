import { requirePermission } from "@/features/workspaces/permissions-server";
import { NewBriefingClient } from "@/features/jobs/briefing/BriefingClient";

export const dynamic = "force-dynamic";

export default async function NewBriefPage() {
  await requirePermission("jobs:create");
  return <NewBriefingClient />;
}
