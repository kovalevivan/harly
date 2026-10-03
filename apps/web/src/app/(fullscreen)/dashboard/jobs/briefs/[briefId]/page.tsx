import { notFound } from "next/navigation";

import { getJobBrief } from "@/features/jobs/briefing/actions";
import { BriefingClient } from "@/features/jobs/briefing/BriefingClient";
import { briefAnswersSchema, briefProfileSchema, briefTopics } from "@/features/jobs/briefing/model";
import { jobDraftSchema } from "@/lib/ai/schemas";
import { getWorkspaceAiStatus } from "@/lib/ai/config";
import { getWorkspaceContext } from "@/features/workspaces/context";

export const dynamic = "force-dynamic";

export default async function BriefPage({ params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await params;
  const brief = await getJobBrief(briefId);
  if (!brief) notFound();
  const { organization } = await getWorkspaceContext();
  const ai = await getWorkspaceAiStatus(organization.id);
  const answers = briefAnswersSchema.parse(brief.answers);
  const profile = briefProfileSchema.safeParse(brief.profile);
  const draft = jobDraftSchema.safeParse(brief.generatedDraft);
  return <BriefingClient
    briefId={brief.id}
    title={brief.title}
    initialAnswers={answers}
    initialQuestion={brief.currentQuestion ?? briefTopics[answers.length]?.question ?? null}
    initialProfile={profile.success ? profile.data : null}
    initialDraft={draft.success ? draft.data : null}
    aiConfigured={ai.enabled && ai.encryptionReady && ai.hasApiKey}
  />;
}
