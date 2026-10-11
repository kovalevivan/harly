import "server-only";
import { loadReviewQueueStates } from "./queue";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, jobs, jobBriefs } from "@harly/db";
import { savedVacancyDraft } from "@/features/jobs/briefing/job-description";
import {
  readEmployeeProfile,
  readIntake,
  resumeReviewsSchema,
  reviewReference,
} from "@/features/jobs/briefing/workflow";
import { summarizeHiringReview, type HiringReviewSummary } from "./summary";

/** Internal loader: the page supplies only applications it has authorized. */
export async function loadHiringReviewSummaries(
  workspaceId: string,
  applications: Array<{ id: string; jobId: string }>,
): Promise<HiringReviewSummary[]> {
  if (!applications.length) return [];
  // One query for all visible jobs; do not issue one action/request per card.
  const rows = await db
    .select({
      job: {
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        contentSections: jobs.contentSections,
        requirements: jobs.requirements,
        benefits: jobs.benefits,
      },
      brief: {
        id: jobBriefs.id,
        profile: jobBriefs.profile,
        intake: jobBriefs.intake,
        resumeReviews: jobBriefs.resumeReviews,
      },
    })
    .from(jobs)
    .leftJoin(
      jobBriefs,
      and(eq(jobBriefs.jobId, jobs.id), eq(jobBriefs.workspaceId, workspaceId)),
    )
    .where(
      and(
        eq(jobs.workspaceId, workspaceId),
        inArray(jobs.id, [
          ...new Set(applications.map((application) => application.jobId)),
        ]),
        isNull(jobs.deletedAt),
      ),
    )
    .orderBy(desc(jobBriefs.updatedAt), desc(jobBriefs.id));
  const queueStates = await loadReviewQueueStates(
    workspaceId,
    applications.map((a) => a.id),
  );
  return applications.map((application) => {
    const own = rows.filter((row) => row.job.id === application.jobId);
    const latest = own.find((row) => row.brief)?.brief;
    if (!own.length)
      return {
        applicationId: application.id,
        status: "unavailable",
        reviewId: null,
        summary: null,
      };
    const profile = readEmployeeProfile(latest?.profile);
    const intake = readIntake(latest?.intake);
    return summarizeHiringReview(application.id, {
      queue: queueStates.get(application.id),
      ready: Boolean(
        profile && intake.profileApproved && intake.vacancyApproved,
      ),
      reference: profile
        ? reviewReference(profile, savedVacancyDraft(own[0].job))
        : "",
      reviews: own.flatMap((row) =>
        row.brief ? resumeReviewsSchema.parse(row.brief.resumeReviews) : [],
      ),
    });
  });
}
