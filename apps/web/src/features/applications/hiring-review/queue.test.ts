import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  execute: vi.fn(),
  update: vi.fn(),
  load: vi.fn(),
  perform: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));
vi.mock("@harly/db", () => ({
  db: { execute: m.execute, update: m.update },
  hiringReviewJobs: { id: "id", leaseId: "lease", status: "status" },
}));
vi.mock("./service", () => ({
  loadHiringReviewContext: m.load,
  performHiringReview: m.perform,
}));
import { processHiringReviewQueue, reviewDedupeKey } from "./queue";
const job = {
  id: "11111111-1111-4111-8111-111111111111",
  application_id: "application",
  candidate_id: "candidate",
  workspace_id: "workspace",
  resume_text: "Исходный текст именно этого отклика",
  reference: "approved",
  attempts: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.execute.mockResolvedValue([job]);
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.where.mockResolvedValue([]);
  m.load.mockResolvedValue({
    ready: true,
    candidate: { id: "candidate" },
    reference: "approved",
    brief: { updatedAt: new Date("2026-10-11T15:00:00Z") },
  });
  m.perform.mockResolvedValue({ ok: true, review: { id: "saved-report" } });
});
describe("durable application profile review worker", () => {
  it("deduplicates whitespace-equivalent resumes but separates profile and resume changes", () => {
    expect(reviewDedupeKey("a", "  resume  ")).toBe(
      reviewDedupeKey("a", "resume"),
    );
    expect(reviewDedupeKey("b", "resume")).not.toBe(
      reviewDedupeKey("a", "resume"),
    );
    expect(reviewDedupeKey("a", "new resume")).not.toBe(
      reviewDedupeKey("a", "resume"),
    );
  });
  it("does nothing when another worker owns the active lease", async () => {
    m.execute.mockResolvedValue([]);
    expect(await processHiringReviewQueue()).toEqual({ claimed: 0 });
    expect(m.load).not.toHaveBeenCalled();
    expect(m.perform).not.toHaveBeenCalled();
  });
  it("uses the queued resume and workspace, not the candidate's later shared file", async () => {
    await processHiringReviewQueue();
    expect(m.load).toHaveBeenCalledWith("application", "workspace");
    expect(m.perform).toHaveBeenCalledWith(
      await m.load.mock.results[0].value,
      job.resume_text,
      "2026-10-11T15:00:00.000Z",
      { id: job.id, leaseId: expect.any(String) },
    );
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        reviewId: "saved-report",
        lastError: null,
        leaseId: null,
      }),
    );
  });
  it("never sends an obsolete profile to AI and records an actionable status", async () => {
    m.load.mockResolvedValue({ ready: true, reference: "changed" });
    await processHiringReviewQueue();
    expect(m.perform).not.toHaveBeenCalled();
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        lastError: expect.stringContaining("Требования изменились"),
      }),
    );
  });
  it("does not attribute an old resume to a reassigned candidate", async () => {
    m.load.mockResolvedValue({
      ready: true,
      reference: "approved",
      candidate: { id: "another-candidate" },
    });
    await processHiringReviewQueue();
    expect(m.perform).not.toHaveBeenCalled();
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });
  it("does not analyze withdrawn approvals", async () => {
    m.load.mockResolvedValue({ ready: false, reference: "approved" });
    await processHiringReviewQueue();
    expect(m.perform).not.toHaveBeenCalled();
  });
  it("keeps model failure visible and retryable without claiming a completed result", async () => {
    m.perform.mockResolvedValue({
      ok: false,
      error: "Подключите ИИ в настройках",
    });
    await processHiringReviewQueue();
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        reviewId: null,
        lastError: "Подключите ИИ в настройках",
      }),
    );
  });
  it("stops crash recovery after three attempts", async () => {
    m.execute.mockResolvedValue([{ ...job, attempts: 4 }]);
    await processHiringReviewQueue();
    expect(m.perform).not.toHaveBeenCalled();
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
  it("does not expose storage/model exceptions or resume text in the failure message", async () => {
    m.load.mockRejectedValue(new Error("SECRET resume"));
    await processHiringReviewQueue();
    expect(JSON.stringify(m.set.mock.calls)).not.toContain("SECRET");
    expect(m.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
