import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeInvitation: vi.fn(),
  publicBrief: vi.fn(),
}));
vi.mock("@/features/jobs/briefing/service", () => ({
  ...mocks,
  cookieName: () => "briefing",
  processBriefingMessage: vi.fn(),
  completeBriefing: vi.fn(),
  cancelBriefingTurn: vi.fn(),
}));
vi.mock("@/lib/public-origin", () => ({
  getHarlyPublicOrigin: () => "https://harly.example",
}));
vi.mock("@/features/jobs/briefing/edit-brief", () => ({
  saveBriefAnswers: vi.fn(),
}));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publicBrief.mockResolvedValue({
    title: "Оператор",
    intake: { completed: false, messages: [] },
  });
});
describe("external briefing invitation state", () => {
  it("keeps a completed invitation read-only when HR reopens the plan", async () => {
    mocks.authorizeInvitation.mockResolvedValue({
      briefId: "brief-1",
      completedAt: new Date(),
    });
    const response = await GET(
      new NextRequest("https://harly.example/api/public/briefing/invite-1"),
      { params: Promise.resolve({ inviteId: "invite-1" }) },
    );
    expect((await response.json()).intake.completed).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("leaves a fresh invitation open", async () => {
    mocks.authorizeInvitation.mockResolvedValue({
      briefId: "brief-1",
      completedAt: null,
    });
    const response = await GET(
      new NextRequest("https://harly.example/api/public/briefing/invite-2"),
      { params: Promise.resolve({ inviteId: "invite-2" }) },
    );
    expect((await response.json()).intake.completed).toBe(false);
  });
});
