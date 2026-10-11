import type { ReviewQueueState } from "./queue";
import type { ResumeReview } from "@/features/jobs/briefing/workflow";

export type HiringReviewSummary = {
  applicationId: string;
  status:
    | "ready"
    | "stale"
    | "empty"
    | "needs_profile"
    | "unavailable"
    | "queued"
    | "running"
    | "failed";
  reviewId: string | null;
  summary: string | null;
};

export function summarizeHiringReview(
  applicationId: string,
  data: {
    ready: boolean;
    reference: string;
    reviews: ResumeReview[];
    queue?: ReviewQueueState | null;
  },
): HiringReviewSummary {
  const own = data.reviews
    .filter((review) => review.applicationId === applicationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Prefer a result for the current requirements, even if history contains a
  // newer report made against a different profile version.
  const current = data.ready
    ? own.find(
        (review) =>
          review.reference === data.reference &&
          (!data.queue?.reviewId || review.id === data.queue.reviewId),
      )
    : undefined;
  const report = current ?? own[0];
  return {
    applicationId,
    status:
      data.ready &&
      data.queue?.reference === data.reference &&
      ["queued", "running", "failed", "cancelled"].includes(data.queue.status)
        ? ((data.queue.status === "cancelled"
            ? "failed"
            : data.queue.status) as "queued" | "running" | "failed")
        : current
          ? "ready"
          : report
            ? "stale"
            : data.ready
              ? "empty"
              : "needs_profile",
    reviewId: report?.id ?? null,
    summary: report?.summary ?? null,
  };
}

export const reviewStatusLabels: Record<HiringReviewSummary["status"], string> =
  {
    ready: "Разбор резюме готов",
    stale: "Разбор резюме устарел",
    empty: "Резюме ещё не оценено",
    needs_profile: "Профиль вакансии ещё не утверждён",
    queued: "Разбор резюме в очереди",
    running: "Разбираем резюме…",
    failed: "Разбор не выполнен",
    unavailable: "Вакансия недоступна для разбора",
  };
