import { describe, expect, it, vi, beforeEach } from "vitest";
import { readIntake } from "./workflow";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/transport", () => ({ aiFetch: request }));
import {
  runBriefingAgent,
  supportedQuote,
  PostgresBriefingSession,
} from "./agent";
const response = (message: object) =>
  new Response(
    JSON.stringify({
      id: "chat-test",
      object: "chat.completion",
      created: 1,
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", ...message },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
const call = (name: string, args: object) => ({
  content: null,
  tool_calls: [
    {
      id: `call-${name}`,
      type: "function",
      function: {
        name,
        arguments: JSON.stringify(
          name === "update_brief" ? { updates: [args] } : args,
        ),
      },
    },
  ],
});
const input = () => ({
  id: "test",
  title: "Оператор",
  answers: [],
  intake: readIntake(null),
  message: "Нужен оператор для записи пациентов",
  requestId: "message-1",
  config: {
    provider: "openrouter" as const,
    modelId: "test",
    apiKey: "test-only",
  },
});
beforeEach(() => request.mockReset());
describe("SDK briefing agent", () => {
  it("runs tools through OpenRouter and buffers history without mutating saved input", async () => {
    request
      .mockResolvedValueOnce(
        response(
          call("update_brief", {
            topic: "purpose",
            answer: "Запись пациентов",
            kind: "manager",
            quote: "записи пациентов",
          }),
        ),
      )
      .mockResolvedValueOnce(
        response(call("prepare_summary", { openQuestions: ["Какой график?"] })),
      )
      .mockResolvedValueOnce(response({ content: "Какой график?" }));
    const value = input();
    const result = await runBriefingAgent(value);
    expect(result.answers[0].answer).toBe("Запись пациентов");
    expect(result.sources[0].messageId).toBe("message-1");
    expect(result.openQuestions).toEqual(["Какой график?"]);
    expect(result.agentHistory.length).toBeGreaterThan(3);
    expect(value.answers).toEqual([]);
    expect(value.intake.agentHistory).toEqual([]);
    expect(
      request.mock.calls.every(([url]) =>
        String(url).startsWith("https://openrouter.ai/api/v1"),
      ),
    ).toBe(true);
  });
  it("rejects invented source quotes", async () => {
    request
      .mockResolvedValueOnce(
        response(
          call("update_brief", {
            topic: "conditions",
            answer: "Зарплата 100000",
            kind: "manager",
            quote: "Зарплата 100000",
          }),
        ),
      )
      .mockResolvedValueOnce(
        response({ content: "Какую зарплату планируете?" }),
      );
    expect((await runBriefingAgent(input())).answers).toEqual([]);
  });
  it("does not persist partial changes on model failure", async () => {
    request
      .mockResolvedValueOnce(
        response(
          call("update_brief", {
            topic: "purpose",
            answer: "Запись пациентов",
            kind: "manager",
            quote: "записи пациентов",
          }),
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Provider unavailable" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      );
    const value = input();
    await expect(runBriefingAgent(value)).rejects.toThrow();
    expect(value.answers).toEqual([]);
    expect(value.intake.agentHistory).toEqual([]);
  });
  it("isolates session reads and supports pop/clear", async () => {
    const session = new PostgresBriefingSession("brief-1", []);
    await session.addItems([{ role: "user", content: "Привет" }]);
    const items = await session.getItems();
    items.length = 0;
    expect((await session.getItems()).length).toBe(1);
    expect(await session.getSessionId()).toBe("brief-1");
    expect(await session.popItem()).toBeDefined();
    await session.clearSession();
    expect(await session.getItems()).toEqual([]);
  });
  it("checks quote presence", () => {
    expect(supportedQuote("записи  пациентов", "Для записи пациентов")).toBe(
      true,
    );
    expect(supportedQuote("", "Что угодно")).toBe(false);
    expect(supportedQuote("100000", "40000")).toBe(false);
  });
});
