import { createJobAction } from "@/features/jobs/actions";
import { listWorkspaceDepartments } from "@/features/jobs/data";
import { getCareerPageData } from "@/features/career-page/data";
import { JobForm } from "@/features/jobs/JobForm";
import { getWorkspaceContext } from "@/features/workspaces/context";
import { getJobBrief } from "@/features/jobs/briefing/actions";
import { jobDraftSchema } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ briefId?: string }> }) {
  const { organization: workspace } = await getWorkspaceContext();
  const { briefId } = await searchParams;
  const [departments, careerPageData, brief] = await Promise.all([
    listWorkspaceDepartments(),
    getCareerPageData(workspace.slug),
    briefId ? getJobBrief(briefId) : Promise.resolve(null),
  ]);
  const draft = jobDraftSchema.safeParse(brief?.generatedDraft);
  const briefPrefill = brief && draft.success ? {
    id: brief.id,
    title: brief.title,
    description: `<p>${escapeHtml(draft.data.summary)}</p>`,
    sections: draft.data.sections.map((section, index) => ({
      id: `brief-${index}`,
      title: section.title,
      body: `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`,
    })),
  } : undefined;

  return (
    <JobForm
      action={createJobAction}
      submitLabel="Publish"
      departments={departments}
      previewWorkspace={careerPageData?.workspace ?? null}
      previewConfig={careerPageData?.config ?? null}
      briefPrefill={briefPrefill}
    />
  );
}
