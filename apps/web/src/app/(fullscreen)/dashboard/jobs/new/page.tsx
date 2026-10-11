import { redirect } from "next/navigation";
import { readIntake } from "@/features/jobs/briefing/workflow";
import { createJobAction } from "@/features/jobs/actions";
import { listWorkspaceDepartments } from "@/features/jobs/data";
import { getCareerPageData } from "@/features/career-page/data";
import { JobForm } from "@/features/jobs/JobForm";
import { getWorkspaceContext } from "@/features/workspaces/context";
import { getJobBrief } from "@/features/jobs/briefing/actions";
import { descriptionPrefill } from "@/features/jobs/briefing/job-description";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ briefId?: string }>;
}) {
  const { organization: workspace } = await getWorkspaceContext();
  const { briefId } = await searchParams;
  const [departments, careerPageData, brief] = await Promise.all([
    listWorkspaceDepartments(),
    getCareerPageData(workspace.slug),
    briefId ? getJobBrief(briefId) : Promise.resolve(null),
  ]);
  if (
    brief?.intake &&
    (!readIntake(brief.intake).profileApproved ||
      !readIntake(brief.intake).vacancyApproved)
  )
    redirect(`/dashboard/jobs/briefs/${brief.id}?step=3`);
  if (brief?.jobId)
    redirect(`/dashboard/jobs/${brief.jobId}?briefId=${brief.id}`);
  const briefPrefill = brief ? descriptionPrefill(brief) : undefined;

  return (
    <JobForm
      action={createJobAction}
      submitLabel={"Опубликовать"}
      departments={departments}
      previewWorkspace={careerPageData?.workspace ?? null}
      previewConfig={careerPageData?.config ?? null}
      briefPrefill={briefPrefill}
    />
  );
}
