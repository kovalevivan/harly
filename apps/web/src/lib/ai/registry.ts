import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import type { AiModelConfig, OpenRouterModel } from "./providers";
import { assertSafeAiBaseUrl } from "./base-url";
import { xaiCompatibleFetch } from "./provider-tools";
import { aiFetch } from "./transport";

/** Build a Vercel AI SDK LanguageModel for the given provider + key + model id. */
export function getModel(config: AiModelConfig): LanguageModel {
  const { provider, modelId, apiKey, baseUrl } = config;

  // Defense in depth: custom base URLs are validated at save time, but reject
  // any unsafe value here too (e.g. a key set via env or a future path).
  assertSafeAiBaseUrl(provider, baseUrl);

  const opts = { apiKey, baseURL: baseUrl, fetch: aiFetch };

  switch (provider) {
    case "openai":
      return createOpenAI(opts)(modelId);
    case "anthropic":
      return createAnthropic(opts)(modelId);
    case "google":
      return createGoogleGenerativeAI(opts)(modelId);
    case "xai":
      return createXai({
        ...opts,
        fetch: (input, init) => xaiCompatibleFetch(input, init, aiFetch),
      })(modelId);
    case "openrouter":
      return createOpenRouter(opts)(modelId);
    default:
      throw new Error(`Unknown AI provider: ${provider as string}`);
  }
}

/** Live OpenRouter catalog for the searchable model picker. Public endpoint. */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await aiFetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };

    return (payload.data ?? []).map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      free: model.pricing?.prompt === "0" && model.pricing?.completion === "0",
    }));
  } catch {
    return [];
  }
}
