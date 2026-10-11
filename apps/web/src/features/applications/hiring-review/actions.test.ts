import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  callCenterProfile,
  callCenterDraft,
} from "@/features/jobs/briefing/call-center";
import { savedVacancyDraft } from "@/features/jobs/briefing/job-description";
import { reviewReference } from "@/features/jobs/briefing/workflow";
const m = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  requireApplicationPermission: vi.fn(),
  requireCandidatePermission: vi.fn(),
  generateText: vi.fn(),
  loadResumeText: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@harly/db", () => ({
  db: { select: m.select, update: m.update },
  applications: {},
  candidates: {},
  jobs: {},
  jobBriefs: {},
}));
vi.mock("@/features/workspaces/permissions-server", () => ({
  ...m,
  can: vi.fn(async () => true),
}));
vi.mock("@/lib/ai/config", () => ({
  getWorkspaceAiConfig: vi.fn(async () => ({ provider: "openrouter" })),
}));
vi.mock("@/lib/ai/registry", () => ({ getModel: vi.fn(() => "model") }));
vi.mock("@/lib/resume/load-resume-text", () => ({
  loadResumeText: m.loadResumeText,
}));
vi.mock("@/lib/resume/extract-text", () => ({ extractResumeText: vi.fn() }));
vi.mock("@/features/jobs/briefing/service", () => ({
  versionMatch: vi.fn(),
  leaseFree: vi.fn(),
}));
vi.mock("ai", () => ({
  generateText: m.generateText,
  Output: { object: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  getApplicationHiringReviewAction,
  reviewApplicationResumeAction,
} from "./actions";
const applicationId = "11111111-1111-4111-8111-111111111111";
const job = {
  id: "job",
  title: "Оператор",
  description: "<p>Фактический сохранённый текст</p>",
  contentSections: [],
  requirements: null,
  benefits: null,
  updatedAt: new Date("2026-10-11T12:00:00Z"),
};
const brief = {
  id: "plan",
  updatedAt: new Date("2026-10-11T12:00:00Z"),
  profile: callCenterProfile,
  generatedDraft: callCenterDraft,
  intake: {
    messages: [],
    caseId: null,
    profileApproved: true,
    vacancyApproved: true,
  },
  resumeReviews: [],
};
function chain(rows: unknown[]) {
  const q: {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>;
    [key: string]: unknown;
  } = {
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(rows).then(resolve),
  };
  for (const key of [
    "from",
    "innerJoin",
    "where",
    "orderBy",
    "limit",
    "set",
    "returning",
  ])
    q[key] = vi.fn(() => q);
  return q;
}
function input() {
  return {
    applicationId,
    expectedVersion: brief.updatedAt.toISOString(),
    expectedReference: reviewReference(
      callCenterProfile,
      savedVacancyDraft(job),
    ),
    resumeText:
      "С 2023 года работаю оператором контакт-центра. Принимаю входящие звонки и записываю пациентов.",
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(m)) mock.mockReset();
  m.requireApplicationPermission.mockResolvedValue({
    organization: { id: "ws" },
  });
  m.requireCandidatePermission.mockResolvedValue({});
  m.select
    .mockImplementationOnce(() =>
      chain([
        {
          application: { id: applicationId },
          candidate: {
            id: "candidate",
            firstName: "Елена",
            lastName: "Воронцова",
          },
          job,
        },
      ]),
    )
    .mockImplementationOnce(() => chain([brief]));
  m.update.mockReturnValue(chain([{ updatedAt: new Date() }]));
  m.generateText.mockResolvedValue({
    output: { summary: "Требуется проверка", assessments: [] },
  });
});
describe("application-scoped hiring review", () => {
  it("enforces application access before reading profiles or sending data to AI", async () => {
    m.requireApplicationPermission.mockRejectedValue(new Error("not assigned"));
    expect((await reviewApplicationResumeAction(input())).ok).toBe(false);
    expect(m.select).not.toHaveBeenCalled();
    expect(m.generateText).not.toHaveBeenCalled();
  });
  it("uses saved editor content and stores the exact application and vacancy snapshot", async () => {
    const result = await reviewApplicationResumeAction(input());
    expect(result.ok).toBe(true);
    const prompt = JSON.parse(m.generateText.mock.calls[0][0].prompt);
    expect(prompt.vacancy.summary).toContain("Фактический сохранённый текст");
    expect(prompt.vacancy).not.toEqual(callCenterDraft);
    if (result.ok) {
      expect(result.review.applicationId).toBe(applicationId);
      expect(result.review.candidateId).toBe("candidate");
      expect(result.review.vacancySnapshot).toEqual(savedVacancyDraft(job));
    }
  });
  it("rejects outdated editor content before spending an AI request", async () => {
    const result = await reviewApplicationResumeAction({
      ...input(),
      expectedReference: "old saved text",
    });
    expect(result.ok).toBe(false);
    expect(m.generateText).not.toHaveBeenCalled();
  });
  it("does not save a late result after concurrent profile or vacancy changes", async () => {
    m.update.mockReturnValue(chain([]));
    const result = await reviewApplicationResumeAction(input());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Результат не сохранён");
  });
  it("returns only this application's reports, including older plan versions", async () => {
    m.select.mockReset();
    const review = {
      id: "review",
      candidateId: "candidate",
      candidateName: "Елена",
      createdAt: "2026-10-11T12:00:00Z",
      resumeText: "resume",
      reference: "old",
      criteria: [],
      summary: "old report",
      assessments: [],
      applicationId,
    };
    m.select
      .mockImplementationOnce(() =>
        chain([
          {
            application: { id: applicationId },
            candidate: { id: "candidate" },
            job,
          },
        ]),
      )
      .mockImplementationOnce(() =>
        chain([
          {
            ...brief,
            resumeReviews: [
              { ...review, id: "other", applicationId: "another-application" },
            ],
          },
          { ...brief, resumeReviews: [review] },
        ]),
      );
    const result = await getApplicationHiringReviewAction(applicationId);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.reviews.map((r) => r.id)).toEqual(["review"]);
  });
});
