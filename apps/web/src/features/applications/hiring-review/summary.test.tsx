import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResumeReview } from "@/features/jobs/briefing/workflow";
import { summarizeHiringReview } from "./summary";
import { HiringReviewStatusCards } from "./HiringReviewStatusCards";

export const report = (
  id: string,
  applicationId = "own",
  reference = "current",
  createdAt = "2026-10-11T12:00:00Z",
): ResumeReview => ({
  id,
  applicationId,
  reference,
  createdAt,
  candidateId: null,
  candidateName: "Кандидат",
  summary: `Сводка ${id}`,
  resumeText: "Исходное резюме",
  criteria: [],
  assessments: [],
});
describe("application hiring review status", () => {
  it("ignores reports for another application", () => {
    const summary = summarizeHiringReview("own", {
      ready: true,
      reference: "current",
      reviews: [report("private", "other")],
    });
    expect(summary.status).toBe("empty");
    expect(summary.summary).toBeNull();
  });
  it("prefers the newest current result to newer stale history", () => {
    const summary = summarizeHiringReview("own", {
      ready: true,
      reference: "current",
      reviews: [
        report("old-current"),
        report("latest-current", "own", "current", "2026-10-12T12:00:00Z"),
        report("stale", "own", "outdated", "2026-10-13T12:00:00Z"),
      ],
    });
    expect(summary.status).toBe("ready");
    expect(summary.reviewId).toBe("latest-current");
  });
  it("marks reports stale when saved job content changed or approval was removed", () => {
    expect(
      summarizeHiringReview("own", {
        ready: true,
        reference: "edited-job",
        reviews: [report("r")],
      }).status,
    ).toBe("stale");
    expect(
      summarizeHiringReview("own", {
        ready: false,
        reference: "current",
        reviews: [report("r")],
      }).status,
    ).toBe("stale");
  });
  it("distinguishes missing requirements from an approved profile without a review", () => {
    expect(
      summarizeHiringReview("own", { ready: false, reference: "", reviews: [] })
        .status,
    ).toBe("needs_profile");
    expect(
      summarizeHiringReview("own", {
        ready: true,
        reference: "current",
        reviews: [],
      }).status,
    ).toBe("empty");
  });
  it("renders a saved result on the initial HTML, with an application-specific action", () => {
    const html = renderToStaticMarkup(
      <HiringReviewStatusCards
        applications={[{ id: "own", jobTitle: "Врач" }]}
        summaries={[
          summarizeHiringReview("own", {
            ready: true,
            reference: "current",
            reviews: [report("r")],
          }),
        ]}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("Разбор резюме готов");
    expect(html).toContain("Открыть результат: Врач");
    expect(html).toContain("Сводка r");
    expect(html).not.toContain("Автоматической оценки пока нет");
  });
  it("labels incomplete requirements consistently for sighted and screen-reader users", () => {
    const html = renderToStaticMarkup(
      <HiringReviewStatusCards
        applications={[{ id: "own", jobTitle: "Врач" }]}
        summaries={[
          summarizeHiringReview("own", {
            ready: false,
            reference: "",
            reviews: [],
          }),
        ]}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("Профиль вакансии ещё не утверждён");
    expect(html).toContain("Открыть требования: Врач");
  });
});

describe("automatic review status", () => {
  const queue = {
    id: "task",
    status: "running",
    reference: "current",
    reviewId: null,
    lastError: null,
    requestedAt: "2026-10-12T12:00:00Z",
  };
  it("shows pending and failed work even when a previous resume has a ready report", () => {
    for (const status of ["queued", "running", "failed"] as const)
      expect(
        summarizeHiringReview("own", {
          ready: true,
          reference: "current",
          reviews: [report("previous")],
          queue: { ...queue, status },
        }).status,
      ).toBe(status);
  });
  it("opens the report for the last uploaded resume when its cached report is older", () => {
    const result = summarizeHiringReview("own", {
      ready: true,
      reference: "current",
      reviews: [
        report("latest", "own", "current", "2026-10-13T12:00:00Z"),
        report("cached"),
      ],
      queue: { ...queue, status: "completed", reviewId: "cached" },
    });
    expect(result.status).toBe("ready");
    expect(result.reviewId).toBe("cached");
  });
  it("does not call queued work current after requirements changed", () => {
    expect(
      summarizeHiringReview("own", {
        ready: true,
        reference: "changed",
        reviews: [report("previous")],
        queue,
      }).status,
    ).toBe("stale");
  });
  it("renders a retry action and failure instead of a successful old result", () => {
    const html = renderToStaticMarkup(
      <HiringReviewStatusCards
        applications={[{ id: "own", jobTitle: "Врач" }]}
        summaries={[
          summarizeHiringReview("own", {
            ready: true,
            reference: "current",
            reviews: [report("previous")],
            queue: { ...queue, status: "failed" },
          }),
        ]}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("Разбор не выполнен");
    expect(html).toContain("Повторить разбор: Врач");
  });
});
