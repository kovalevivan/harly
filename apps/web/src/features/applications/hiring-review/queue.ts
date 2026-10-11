import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, hiringReviewJobs } from "@harly/db";
import { loadHiringReviewContext, performHiringReview } from "./service";
import { resumeReviewsSchema } from "@/features/jobs/briefing/workflow";

export type ReviewQueueState = {
  id: string;
  status: string;
  reference: string;
  reviewId: string | null;
  lastError: string | null;
  requestedAt: string;
};
export function reviewDedupeKey(reference: string, resumeText: string) {
  return createHash("sha256")
    .update(JSON.stringify([reference, resumeText.trim()]))
    .digest("hex");
}
export async function loadReviewQueueStates(
  workspaceId: string,
  applicationIds: string[],
) {
  if (!applicationIds.length) return new Map<string, ReviewQueueState>();
  const rows = await db
    .select({
      id: hiringReviewJobs.id,
      applicationId: hiringReviewJobs.applicationId,
      status: hiringReviewJobs.status,
      reference: hiringReviewJobs.reference,
      reviewId: hiringReviewJobs.reviewId,
      lastError: hiringReviewJobs.lastError,
      requestedAt: hiringReviewJobs.requestedAt,
    })
    .from(hiringReviewJobs)
    .where(
      and(
        eq(hiringReviewJobs.workspaceId, workspaceId),
        inArray(hiringReviewJobs.applicationId, applicationIds),
      ),
    )
    .orderBy(desc(hiringReviewJobs.requestedAt), desc(hiringReviewJobs.id));
  const result = new Map<string, ReviewQueueState>();
  for (const row of rows)
    if (!result.has(row.applicationId))
      result.set(row.applicationId, {
        ...row,
        requestedAt: row.requestedAt.toISOString(),
      });
  return result;
}
export async function loadReviewQueueDetail(
  workspaceId: string,
  applicationId: string,
) {
  const [row] = await db
    .select({
      id: hiringReviewJobs.id,
      status: hiringReviewJobs.status,
      reference: hiringReviewJobs.reference,
      reviewId: hiringReviewJobs.reviewId,
      lastError: hiringReviewJobs.lastError,
      requestedAt: hiringReviewJobs.requestedAt,
      resumeText: hiringReviewJobs.resumeText,
    })
    .from(hiringReviewJobs)
    .where(
      and(
        eq(hiringReviewJobs.workspaceId, workspaceId),
        eq(hiringReviewJobs.applicationId, applicationId),
      ),
    )
    .orderBy(desc(hiringReviewJobs.requestedAt), desc(hiringReviewJobs.id))
    .limit(1);
  return row ? { ...row, requestedAt: row.requestedAt.toISOString() } : null;
}
export async function enqueueHiringReview(
  state: Awaited<ReturnType<typeof loadHiringReviewContext>>,
  resumeText: string,
) {
  resumeText = resumeText.trim();
  if (!state.ready || !state.brief)
    return {
      ok: false as const,
      error:
        "Резюме загружено. Для автоматического разбора HR должен утвердить профиль и описание вакансии.",
    };
  const inputError =
    resumeText.length < 50 || resumeText.length > 20000
      ? "Не удалось прочитать резюме. Нужен текст от 50 до 20 000 символов; для скана вставьте текст вручную."
      : null;
  resumeText = resumeText.slice(0, 20000);
  const dedupeKey = reviewDedupeKey(state.reference, resumeText);
  const cached = state.briefs
    .flatMap((b) => resumeReviewsSchema.parse(b.resumeReviews))
    .find(
      (r) =>
        r.applicationId === state.application.id &&
        r.reference === state.reference &&
        r.resumeText.trim() === resumeText,
    );
  const queued = await db.transaction(async (tx) => {
    // Serialize submissions for this application; a replacement invalidates an
    // older worker's fence without cancelling unrelated applications.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${state.application.id}))`,
    );
    await tx
      .update(hiringReviewJobs)
      .set({
        status: "cancelled",
        leaseId: null,
        leaseUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(hiringReviewJobs.applicationId, state.application.id),
          ne(hiringReviewJobs.dedupeKey, dedupeKey),
          inArray(hiringReviewJobs.status, ["queued", "running"]),
        ),
      );
    const [existing] = await tx
      .select()
      .from(hiringReviewJobs)
      .where(
        and(
          eq(hiringReviewJobs.applicationId, state.application.id),
          eq(hiringReviewJobs.dedupeKey, dedupeKey),
        ),
      )
      .limit(1);
    if (existing?.status === "running") return existing;
    const values = {
      workspaceId: state.workspaceId,
      applicationId: state.application.id,
      candidateId: state.candidate.id,
      resumeText,
      reference: state.reference,
      dedupeKey,
      status: inputError ? "failed" : cached ? "completed" : "queued",
      reviewId: cached?.id ?? null,
      attempts: 0,
      lastError: inputError,
      leaseId: null,
      leaseUntil: null,
      requestedAt: new Date(),
      updatedAt: new Date(),
    };
    const [row] = existing
      ? await tx
          .update(hiringReviewJobs)
          .set(values)
          .where(eq(hiringReviewJobs.id, existing.id))
          .returning()
      : await tx.insert(hiringReviewJobs).values(values).returning();
    return row;
  });
  return {
    ok: true as const,
    jobId: queued.id,
    cached: Boolean(cached),
    status: queued.status,
    willRun: queued.status === "queued",
  };
}

/** One model call at a time per worker, with a durable lease and crash recovery. */
export async function processHiringReviewQueue(jobId?: string) {
  const leaseId = randomUUID();
  const rows = await db.execute(sql`
    with guard as (select pg_try_advisory_xact_lock(hashtext('harly-profile-review-worker')) as acquired), next_job as (
      select id from hiring_review_jobs, guard
      where guard.acquired and not exists (select 1 from hiring_review_jobs active where active.status = 'running' and active.lease_until >= now()) and (status = 'queued' or (status = 'running' and lease_until < now()))
        ${jobId ? sql`and id = ${jobId}::uuid` : sql``}
      order by requested_at asc
      for update of hiring_review_jobs skip locked limit 1
    )
    update hiring_review_jobs q set status = 'running', attempts = attempts + 1,
      lease_id = ${leaseId}::uuid, lease_until = now() + interval '120 seconds', updated_at = now()
    from next_job where q.id = next_job.id
    returning q.id, q.application_id, q.candidate_id, q.workspace_id, q.resume_text, q.reference, q.attempts
  `);
  const job = rows[0] as
    | {
        id: string;
        application_id: string;
        candidate_id: string;
        workspace_id: string;
        resume_text: string;
        reference: string;
        attempts: number;
      }
    | undefined;
  if (!job) return { claimed: 0 };
  let status = "failed",
    reviewId: string | null = null,
    lastError: string | null =
      "Не удалось выполнить разбор. Повторите попытку.";
  try {
    const state = await loadHiringReviewContext(
      job.application_id,
      job.workspace_id,
    );
    if (
      !state.ready ||
      state.reference !== job.reference ||
      state.candidate.id !== job.candidate_id
    ) {
      status = "cancelled";
      lastError =
        "Требования изменились. Обновите данные и запустите разбор снова.";
    } else if (job.attempts > 3) {
      lastError =
        "Разбор прерван после нескольких попыток. Запустите его снова.";
    } else {
      const result = await performHiringReview(
        state,
        job.resume_text,
        state.brief!.updatedAt.toISOString(),
        { id: job.id, leaseId },
      );
      if (result.ok) {
        status = "completed";
        reviewId = result.review.id;
        lastError = null;
      } else lastError = result.error;
    }
  } catch {
    /* Do not log resume text or provider credentials. */
  }
  await db
    .update(hiringReviewJobs)
    .set({
      status,
      reviewId,
      lastError,
      leaseId: null,
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(hiringReviewJobs.id, job.id),
        eq(hiringReviewJobs.leaseId, leaseId),
        eq(hiringReviewJobs.status, "running"),
      ),
    );
  return { claimed: 1 };
}
