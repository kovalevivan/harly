"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db, applications, candidates, jobs } from "@harly/db";
import { requireJobPermission } from "@/features/workspaces/permissions-server";
import { createCandidateForApi } from "@/features/candidates/service";
import { createApplicationForApi } from "@/features/applications/service";
import { mockHhGateway } from "./mock";

export async function importDemoHhResponsesAction(jobId: string) {
  const context = await requireJobPermission("jobs:edit", jobId);
  const workspaceId = context.organization.id;
  const [job] = await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(
    eq(jobs.id, jobId), eq(jobs.workspaceId, workspaceId), isNull(jobs.deletedAt),
  )).limit(1);
  if (!job) return { ok: false as const, error: "Вакансия не найдена." };

  let imported = 0;
  let skipped = 0;
  for (const response of await mockHhGateway.listResponses(job)) {
    const [existing] = await db.select({ id: candidates.id }).from(candidates).where(and(
      eq(candidates.workspaceId, workspaceId), eq(candidates.email, response.email), isNull(candidates.deletedAt),
    )).limit(1);
    const candidateId = existing?.id ?? (await createCandidateForApi({
      workspaceId,
      values: {
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
        headline: response.headline,
      },
    })).id;
    const [linked] = await db.select({ id: applications.id }).from(applications).where(and(
      eq(applications.workspaceId, workspaceId),
      eq(applications.candidateId, candidateId),
      eq(applications.jobId, jobId),
    )).limit(1);
    if (linked) { skipped += 1; continue; }
    await createApplicationForApi({ workspaceId, jobId, candidateId, source: "HeadHunter · демо" });
    imported += 1;
  }
  return { ok: true as const, imported, skipped };
}
