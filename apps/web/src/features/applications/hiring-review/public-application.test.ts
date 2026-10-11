import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  load: vi.fn(),
  extract: vi.fn(),
  enqueue: vi.fn(),
  process: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("./service", () => ({ loadHiringReviewContext: m.load }));
vi.mock("./queue", () => ({
  enqueueHiringReview: m.enqueue,
  processHiringReviewQueue: m.process,
}));
vi.mock("@/lib/resume/extract-text", () => ({ extractResumeText: m.extract }));

import { privateResumeFileUrl } from "@/lib/resume/storage-key";
import { enqueuePublicApplicationReview } from "./public-application";

const key = "workspaces/ws-1/resumes/upload/cv.pdf";
const input = {
  workspaceId: "ws-1",
  applicationId: "accepted-application",
  resume: {
    key,
    fileUrl: privateResumeFileUrl(key),
    fileName: "cv.pdf",
    fileType: "application/pdf" as const,
    fileSize: 14,
    bytes: Buffer.from("%PDF-1.7\nresume"),
  },
};
function context() {
  return {
    workspaceId: "ws-1",
    ready: true,
    application: {
      id: "accepted-application",
      source: "public_form",
      status: "active",
      snapshot: { resumeUrl: input.resume.fileUrl },
    },
    candidate: { id: "existing-candidate-with-other-applications" },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  m.load.mockResolvedValue(context());
  m.extract.mockResolvedValue({ text: "Resume from this submission" });
  m.enqueue.mockResolvedValue({
    ok: true,
    willRun: true,
    jobId: "durable-job",
  });
});

describe("accepted public application profile review", () => {
  it("persists the exact verified submission before returning, then runs AI after response", async () => {
    const events: string[] = [];
    m.enqueue.mockImplementation(async () => {
      await Promise.resolve();
      events.push("saved");
      return { ok: true, willRun: true, jobId: "durable-job" };
    });
    m.after.mockImplementation(() => events.push("scheduled"));
    await enqueuePublicApplicationReview(input);
    events.push("returned");
    expect(events).toEqual(["saved", "scheduled", "returned"]);
    expect(m.load).toHaveBeenCalledWith("accepted-application", "ws-1");
    expect(m.extract).toHaveBeenCalledWith({
      buffer: input.resume.bytes,
      fileName: "cv.pdf",
      mimeType: "application/pdf",
    });
    expect(m.enqueue).toHaveBeenCalledWith(
      context(),
      "Resume from this submission",
    );
    expect(m.process).not.toHaveBeenCalled();
    await m.after.mock.calls[0][0]();
    expect(m.process).toHaveBeenCalledWith("durable-job");
  });

  it.each([
    { source: "manual" },
    { status: "rejected" },
    { id: "other-application" },
    { snapshot: { resumeUrl: "/another-resume.pdf" } },
    { snapshot: null },
  ])(
    "never queues another application or a mismatched file: %j",
    async (change) => {
      const state = context();
      m.load.mockResolvedValue({
        ...state,
        application: { ...state.application, ...change },
      });
      await enqueuePublicApplicationReview(input);
      expect(m.extract).not.toHaveBeenCalled();
      expect(m.enqueue).not.toHaveBeenCalled();
    },
  );

  it.each([{ ready: false }, { workspaceId: "another-workspace" }])(
    "does not parse or call AI without approved requirements in the correct workspace: %j",
    async (change) => {
      m.load.mockResolvedValue({ ...context(), ...change });
      await enqueuePublicApplicationReview(input);
      expect(m.extract).not.toHaveBeenCalled();
      expect(m.after).not.toHaveBeenCalled();
    },
  );

  it.each([
    { key: "workspaces/other/resumes/upload/cv.pdf" },
    { fileUrl: "https://attacker.example/cv.pdf" },
  ])(
    "rejects an untrusted storage source before loading the application: %j",
    async (change) => {
      await enqueuePublicApplicationReview({
        ...input,
        resume: { ...input.resume, ...change },
      });
      expect(m.load).not.toHaveBeenCalled();
      expect(m.enqueue).not.toHaveBeenCalled();
    },
  );

  it("persists an unreadable-file failure without rejecting the accepted application", async () => {
    m.extract.mockRejectedValue(new Error("parser failed"));
    m.enqueue.mockResolvedValue({ ok: true, willRun: false, status: "failed" });
    await expect(
      enqueuePublicApplicationReview(input),
    ).resolves.toBeUndefined();
    expect(m.enqueue).toHaveBeenCalledWith(context(), "");
    expect(m.after).not.toHaveBeenCalled();
  });

  it("does not start another worker for an identical queued, running or cached resume", async () => {
    m.enqueue.mockResolvedValue({ ok: true, willRun: false, cached: true });
    await enqueuePublicApplicationReview(input);
    expect(m.after).not.toHaveBeenCalled();
  });

  it("keeps submission successful and logs no source or secrets if persistence fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      m.enqueue.mockRejectedValue(new Error("PRIVATE resume and API key"));
      await expect(
        enqueuePublicApplicationReview(input),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        "Could not queue a public application profile review.",
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
      expect(m.after).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("leaves the durable job for the scheduler if the immediate kick cannot be registered", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      m.after.mockImplementation(() => {
        throw new Error("response ended");
      });
      await expect(
        enqueuePublicApplicationReview(input),
      ).resolves.toBeUndefined();
      expect(m.enqueue).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });

  it("keeps the persisted task recoverable if the after-response worker fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      m.process.mockRejectedValue(new Error("PRIVATE database error"));
      await enqueuePublicApplicationReview(input);
      await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();
      expect(m.enqueue).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(
        "Could not start a public application profile review.",
      );
    } finally {
      log.mockRestore();
    }
  });
});
