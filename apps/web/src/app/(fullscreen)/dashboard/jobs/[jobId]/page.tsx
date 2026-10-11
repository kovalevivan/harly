import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { updateJobAction } from "@/features/jobs/actions";
import {
  getDashboardJob,
  listWorkspaceDepartments,
} from "@/features/jobs/data";
import { getCareerPageData } from "@/features/career-page/data";
import {
  listJobHiringTeam,
  listWorkspaceMembers,
} from "@/features/jobs/hiring-team-data";
import { JobForm } from "@/features/jobs/JobForm";
import { JobActionsMenu } from "@/features/jobs/JobActionsMenu";
import { JobShareButton } from "@/features/jobs/JobShareButton";
import { JobStatusActions } from "@/features/jobs/JobStatusActions";
import { getWorkspaceAiStatus } from "@/lib/ai/config";
import { getHarlyPublicOrigin } from "@/lib/public-origin";
import { countCandidatePool } from "@/features/matching/data";
import { getWorkspaceContext } from "@/features/workspaces/context";

import { getJobBrief } from "@/features/jobs/briefing/actions";
import { descriptionPrefill } from "@/features/jobs/briefing/job-description";
import { readIntake } from "@/features/jobs/briefing/workflow";
import { can } from "@/features/workspaces/permissions-server";
import { db, jobBriefs } from "@harly/db";
import { and, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type DashboardJobPageProps = {
  searchParams: Promise<{ briefId?: string }>;
  params: Promise<{
    jobId: string;
  }>;
};

export default async function DashboardJobPage({
  params,
  searchParams,
}: DashboardJobPageProps) {
  const { jobId } = await params;
  const { briefId } = await searchParams;
  const { organization: workspace } = await getWorkspaceContext();
  const [
    result,
    departments,
    hiringTeam,
    workspaceMembers,
    aiStatus,
    candidatePoolCount,
    careerPageData,
  ] = await Promise.all([
    getDashboardJob(jobId),
    listWorkspaceDepartments(),
    listJobHiringTeam(jobId),
    listWorkspaceMembers(),
    getWorkspaceAiStatus(workspace.id),
    countCandidatePool(workspace.id),
    getCareerPageData(workspace.slug),
  ]);

  if (!result) {
    notFound();
  }

  const { job } = result;
  const brief = briefId ? await getJobBrief(briefId) : null;
  if (briefId && (!brief || brief.jobId !== job.id)) notFound();
  if (
    brief?.intake &&
    (!readIntake(brief.intake).profileApproved ||
      !readIntake(brief.intake).vacancyApproved)
  )
    redirect(`/dashboard/jobs/briefs/${brief.id}?step=3`);
  const [linkedPlan] = await db
    .select({ id: jobBriefs.id, title: jobBriefs.title })
    .from(jobBriefs)
    .where(
      and(eq(jobBriefs.workspaceId, workspace.id), eq(jobBriefs.jobId, job.id)),
    )
    .orderBy(desc(jobBriefs.updatedAt))
    .limit(1);
  const canEditPlan = await can("jobs:create");
  const appUrl = getHarlyPublicOrigin();
  // Canonical public job details (overview), never the apply form.
  const publicUrl = `${appUrl}/board/${workspace.slug}/jobs/${job.slug}`;

  return (
    <JobForm
      key={`${job.id}:${brief?.updatedAt.toISOString() ?? "saved"}`}
      briefPrefill={brief ? descriptionPrefill(brief) : undefined}
      action={updateJobAction}
      job={job}
      submitLabel={"Сохранить изменения"}
      departments={departments}
      hiringTeam={hiringTeam}
      workspaceMembers={workspaceMembers}
      aiConfigured={aiStatus.enabled && aiStatus.hasApiKey}
      candidatePoolCount={candidatePoolCount}
      eyebrow={"Детали работы"}
      statusBadge={<JobStatusBadge status={job.status} />}
      previewWorkspace={careerPageData?.workspace ?? null}
      previewConfig={careerPageData?.config ?? null}
      headerActions={
        <JobActionsMenu jobId={job.id} slug={job.slug} redirectAfterTrash />
      }
      railActions={
        <>
          {linkedPlan && canEditPlan && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start"
            >
              <Link href={`/dashboard/jobs/briefs/${linkedPlan.id}?step=2`}>
                Профиль сотрудника
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Link href={`/dashboard/jobs/${job.id}/headhunter-demo`}>
              HeadHunter
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <a href={`/jobs/${job.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              {"Посмотреть вакансию "}
            </a>
          </Button>
          <JobShareButton
            url={publicUrl}
            title={job.title}
            workspaceSlug={workspace.slug}
            slug={job.slug}
          />
          <JobStatusActions job={job} />
        </>
      }
    />
  );
}
