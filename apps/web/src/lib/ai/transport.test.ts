import { createServer, type Server } from "node:http";
import { connect, type Socket } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAiTransport } from "./transport";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  return `http://127.0.0.1:${address.port}`;
}

describe("AI-only transport", () => {
  let origin: Server;
  let proxy: Server;
  let originUrl: string;
  let proxyUrl: string;
  let tunnels: number;
  let requests: { body: string; authorization: string | undefined }[];
  let proxyAuthorization: string | undefined;
  const sockets = new Set<Socket>();
  const transports: ReturnType<typeof createAiTransport>[] = [];

  beforeEach(async () => {
    tunnels = 0;
    requests = [];
    proxyAuthorization = undefined;
    origin = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      requests.push({ body, authorization: req.headers.authorization });
      if (req.url === "/stream") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write("first chunk");
        return; // Remains open so cancellation can be observed by the reader.
      }
      res.end("ok");
    });
    proxy = createServer();
    proxy.on("connect", (req, client, head) => {
      tunnels += 1;
      proxyAuthorization = req.headers.authorization;
      const target = new URL(`http://${req.url}`);
      const upstream = connect(Number(target.port), target.hostname, () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      sockets.add(upstream);
      upstream.on("close", () => sockets.delete(upstream));
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    });
    for (const server of [origin, proxy]) {
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });
    }
    originUrl = await listen(origin);
    proxyUrl = await listen(proxy);
  });

  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all(transports.splice(0).map((transport) => transport.close()));
    await Promise.all([origin, proxy].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  function transport(url = proxyUrl) {
    const result = createAiTransport(url);
    transports.push(result);
    return result;
  }

  it("tunnels AI requests without changing ordinary fetch or leaking the AI key into CONNECT", async () => {
    const response = await transport().fetch(originUrl, {
      method: "POST",
      headers: { Authorization: "Bearer test-model-key" },
      body: "model payload",
    });
    expect(await response.text()).toBe("ok");
    expect(tunnels).toBe(1);
    expect(requests[0]).toEqual({ body: "model payload", authorization: "Bearer test-model-key" });
    expect(proxyAuthorization).toBeUndefined();
    expect(await (await globalThis.fetch(originUrl)).text()).toBe("ok");
    expect(tunnels).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it("preserves streaming and cancellation", async () => {
    const controller = new AbortController();
    const response = await transport().fetch(`${originUrl}/stream`, { signal: controller.signal });
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe("first chunk");
    controller.abort();
    await expect(reader.read()).rejects.toMatchObject({ name: "AbortError" });
    expect(tunnels).toBe(1);
  });

  it("fails through an unavailable proxy without retrying directly", async () => {
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await expect(transport().fetch(originUrl)).rejects.toThrow();
    expect(requests).toHaveLength(0);
    expect(await (await globalThis.fetch(originUrl)).text()).toBe("ok");
    expect(requests).toHaveLength(1);
  });

  it("preserves direct fetch arguments when no proxy is configured", async () => {
    const request = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("ok"));
    const init = { method: "POST", body: "unchanged" };
    const direct = createAiTransport("  ", request);
    await direct.fetch(originUrl, init);
    expect(request).toHaveBeenCalledWith(originUrl, init);
  });

  it.each(["not a URL", "socks5://localhost:8888", "http://localhost/path", "http://localhost/?key=secret"])(
    "rejects invalid instance proxy configuration: %s", (url) => {
      expect(() => createAiTransport(url)).toThrow("Некорректный адрес прокси ИИ.");
    },
  );
});
