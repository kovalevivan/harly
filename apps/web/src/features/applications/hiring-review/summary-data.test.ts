import { beforeEach, describe, expect, it, vi } from "vitest";
import { callCenterProfile } from "@/features/jobs/briefing/call-center";
import { savedVacancyDraft } from "@/features/jobs/briefing/job-description";
import { reviewReference } from "@/features/jobs/briefing/workflow";
vi.mock("./queue", () => ({
  loadReviewQueueStates: vi.fn(async () => new Map()),
}));
const m = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));
vi.mock("@harly/db", () => ({
  db: { select: m.select },
  jobs: {
    id: "jobs.id",
    workspaceId: "jobs.workspace",
    deletedAt: "jobs.deleted",
  },
  jobBriefs: {
    jobId: "briefs.job",
    workspaceId: "briefs.workspace",
    updatedAt: "briefs.updated",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: m.eq,
  inArray: m.inArray,
  and: vi.fn(),
  isNull: vi.fn(),
  desc: vi.fn(),
}));
import { loadHiringReviewSummaries } from "./summary-data";
const job = {
  id: "job",
  title: "Оператор",
  description: "Сохранённые требования",
  contentSections: [],
  requirements: null,
  benefits: null,
};
const reference = reviewReference(callCenterProfile, savedVacancyDraft(job));
const row = () => ({
  job,
  brief: {
    id: "plan",
    profile: callCenterProfile,
    intake: {
      caseId: null,
      messages: [],
      profileApproved: true,
      vacancyApproved: true,
    },
    resumeReviews: [
      {
        id: "report",
        applicationId: "first",
        candidateId: null,
        candidateName: "Кандидат",
        summary: "Подтверждён опыт работы",
        resumeText: "Приватный текст резюме",
        reference,
        createdAt: "2026-10-11T12:00:00Z",
        criteria: [],
        assessments: [],
      },
    ],
  },
});
beforeEach(() => vi.clearAllMocks());
function rows(values: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "leftJoin", "where"])
    chain[method] = () => chain;
  chain.orderBy = () => Promise.resolve(values);
  m.select.mockReturnValue(chain);
}
describe("batched initial hiring review summaries", () => {
  it("does not query when there are no visible applications", async () => {
    expect(await loadHiringReviewSummaries("workspace", [])).toEqual([]);
    expect(m.select).not.toHaveBeenCalled();
  });
  it("uses one workspace-scoped query, isolates application results, and never serializes resume text", async () => {
    rows([row()]);
    const result = await loadHiringReviewSummaries("workspace", [
      { id: "first", jobId: "job" },
      { id: "second", jobId: "job" },
    ]);
    expect(m.select).toHaveBeenCalledTimes(1);
    expect(m.eq).toHaveBeenCalledWith("jobs.workspace", "workspace");
    expect(m.eq).toHaveBeenCalledWith("briefs.workspace", "workspace");
    expect(m.inArray).toHaveBeenCalledWith("jobs.id", ["job"]);
    expect(result.map((summary) => summary.status)).toEqual(["ready", "empty"]);
    expect(result[1].summary).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Приватный текст резюме");
  });
  it("uses saved vacancy content when deciding whether a report is stale", async () => {
    const changed = row();
    changed.job = { ...job, description: "Требования изменились" };
    rows([changed]);
    expect(
      (
        await loadHiringReviewSummaries("workspace", [
          { id: "first", jobId: "job" },
        ])
      )[0].status,
    ).toBe("stale");
  });
  it("distinguishes jobs without a linked profile from unavailable jobs", async () => {
    rows([{ job, brief: null }]);
    const result = await loadHiringReviewSummaries("workspace", [
      { id: "first", jobId: "job" },
      { id: "second", jobId: "deleted-job" },
    ]);
    expect(result.map((summary) => summary.status)).toEqual([
      "needs_profile",
      "unavailable",
    ]);
  });
});
