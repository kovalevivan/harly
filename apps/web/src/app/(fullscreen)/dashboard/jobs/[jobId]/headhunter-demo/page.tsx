import { notFound } from "next/navigation";
import { getDashboardJob } from "@/features/jobs/data";
import { requireJobPermission } from "@/features/workspaces/permissions-server";
import { mockHhGateway } from "@/features/jobs/headhunter/mock";
import { HeadHunterDemoClient } from "@/features/jobs/headhunter/HeadHunterDemoClient";

export const dynamic = "force-dynamic";

export default async function HeadHunterDemoPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  await requireJobPermission("jobs:edit", jobId);
  const result = await getDashboardJob(jobId);
  if (!result) notFound();
  const responses = await mockHhGateway.listResponses(result.job);
  return <HeadHunterDemoClient jobId={jobId} title={result.job.title} responses={responses} />;
}
