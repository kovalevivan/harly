import { db, briefingInvitations } from "@harly/db";
import { eq, desc, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { getJobBrief } from "@/features/jobs/briefing/actions";
import { HiringPlanClient } from "@/features/jobs/briefing/HiringPlanClient";
import {
  readIntake,
  readEmployeeProfile,
} from "@/features/jobs/briefing/workflow";
import { briefAnswersSchema } from "@/features/jobs/briefing/model";
import { jobDraftSchema } from "@/lib/ai/schemas";
import { getWorkspaceAiStatus } from "@/lib/ai/config";
import { getWorkspaceContext } from "@/features/workspaces/context";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ briefId: string }>;
  searchParams: Promise<{
    step?: string;
    candidateId?: string;
    candidateName?: string;
  }>;
}) {
  const { briefId } = await params;
  const brief = await getJobBrief(briefId);
  if (!brief) notFound();
  const { organization } = await getWorkspaceContext();
  const ai = await getWorkspaceAiStatus(organization.id);
  const answers = briefAnswersSchema.parse(brief.answers);
  const profile = readEmployeeProfile(brief.profile);
  const draft = jobDraftSchema.safeParse(brief.generatedDraft);
  const query = await searchParams;
  if (query.step === "4" && query.candidateId)
    redirect(`/dashboard/candidates/${query.candidateId}`);
  if (query.step === "4") redirect(`/dashboard/jobs/briefs/${brief.id}?step=3`);
  const invitations = await db
    .select({
      id: briefingInvitations.id,
      expiresAt: briefingInvitations.expiresAt,
      revokedAt: briefingInvitations.revokedAt,
      completedAt: briefingInvitations.completedAt,
      expired: sql<boolean>`${briefingInvitations.expiresAt} <= now()`,
    })
    .from(briefingInvitations)
    .where(eq(briefingInvitations.briefId, brief.id))
    .orderBy(desc(briefingInvitations.createdAt))
    .limit(20);
  return (
    <HiringPlanClient
      initialVersion={brief.updatedAt.toISOString()}
      initialInvitations={invitations.map((v) => ({
        ...v,
        expired: v.expired,
        expiresAt: v.expiresAt.toISOString(),
        revokedAt: v.revokedAt?.toISOString() ?? null,
        completedAt: v.completedAt?.toISOString() ?? null,
      }))}
      initialStep={
        Number(query.step) >= 1 && Number(query.step) <= 3
          ? Number(query.step)
          : 1
      }
      briefId={brief.id}
      title={brief.title}
      initialAnswers={answers}
      initialProfile={profile}
      initialDraft={draft.success ? draft.data : null}
      initialIntake={readIntake(brief.intake)}
      jobId={brief.jobId}
      aiConfigured={ai.enabled && ai.encryptionReady && ai.hasApiKey}
    />
  );
}
