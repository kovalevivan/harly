import "server-only";

import { ProxyAgent } from "undici";

export function createAiTransport(
  proxyUrl: string | undefined,
  request: typeof globalThis.fetch = globalThis.fetch,
) {
  let dispatcher: ProxyAgent | undefined;
  const uri = proxyUrl?.trim();
  if (uri) {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new Error("Некорректный адрес прокси ИИ.");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.pathname !== "/" || parsed.search || parsed.hash
    ) {
      throw new Error("Некорректный адрес прокси ИИ.");
    }
    dispatcher = new ProxyAgent(uri);
  }

  const fetch: typeof globalThis.fetch = (input, init) => {
    // A local dispatcher routes only this request. Never change the global
    // dispatcher, buffer streaming responses, or retry through a direct client.
    const options = dispatcher ? { ...init, dispatcher } : init;
    return request(input, options);
  };
  return { fetch, close: () => dispatcher?.close() ?? Promise.resolve() };
}

// Trusted instance configuration, server-only. One connection pool per process.
// Other integrations continue using their ordinary fetch / HTTP clients.
export const aiFetch = createAiTransport(process.env.HARLY_AI_PROXY_URL).fetch;
