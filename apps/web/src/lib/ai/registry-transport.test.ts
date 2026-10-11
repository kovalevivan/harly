import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { aiFetch } = vi.hoisted(() => ({ aiFetch: vi.fn<typeof globalThis.fetch>() }));
vi.mock("./transport", () => ({ aiFetch }));

import { embedText } from "./embeddings";
import { AI_PROVIDER_IDS } from "./providers";
import { fetchOpenRouterModels, getModel } from "./registry";

beforeEach(() => { aiFetch.mockReset(); });

describe("AI SDK transport coverage", () => {
  it.each(AI_PROVIDER_IDS)("routes %s model calls through the AI transport", async (provider) => {
    aiFetch.mockRejectedValue(new Error("Test transport unavailable"));
    await expect(generateText({
      model: getModel({ provider, modelId: "test-model", apiKey: "test-key" }),
      prompt: "test",
      maxRetries: 0,
    })).rejects.toThrow();
    expect(aiFetch).toHaveBeenCalledOnce();
  });

  it("routes embeddings through the AI transport", async () => {
    aiFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [0.1, 0.2], index: 0 }], usage: { prompt_tokens: 1, total_tokens: 1 },
    }), { headers: { "Content-Type": "application/json" } }));
    expect(await embedText({ provider: "openai", modelId: "unused", apiKey: "test-key" }, "test")).toEqual([0.1, 0.2]);
    expect(aiFetch).toHaveBeenCalledOnce();
    expect(String(aiFetch.mock.calls[0]![0])).toContain("/embeddings");
  });

  it("routes the public model catalog through the AI transport", async () => {
    aiFetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "demo", pricing: { prompt: "0", completion: "0" } }] })));
    expect(await fetchOpenRouterModels()).toEqual([{ id: "demo", name: "demo", free: true }]);
    expect(aiFetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", expect.any(Object));
  });

  it("does not fall back to a direct catalog fetch after proxy failure", async () => {
    aiFetch.mockRejectedValue(new Error("Proxy unavailable"));
    const direct = vi.spyOn(globalThis, "fetch");
    try {
      expect(await fetchOpenRouterModels()).toEqual([]);
      expect(direct).not.toHaveBeenCalled();
    } finally {
      direct.mockRestore();
    }
  });
});
