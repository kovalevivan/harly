# ArtDent demo AI-only forward proxy

Harly uses the existing shared Tinyproxy only for server-side AI requests:
all five AI SDK providers, OpenAI embeddings and the OpenRouter model catalog.
This includes the AI chat, manager briefing, job description generation,
resume analysis and other features built on `getModel`. Both the web process and
scheduler use the same transport. No additional VM is needed.

`apps/web/src/lib/ai/transport.ts` supplies a local Undici `ProxyAgent` dispatcher
through the AI SDK's custom `fetch`. It never changes the global dispatcher.
Normal fetch/HTTP clients for authentication, mail, HeadHunter, webhooks,
DocuSeal and other integrations remain direct. Streaming, cancellation and TLS
certificate verification are preserved. An unavailable configured proxy fails
the AI request; it never retries directly. Without the setting, AI requests keep
the original direct behavior.

Install `deploy/artdent/compose.override.yaml` as `/opt/harly/compose.override.yaml`
next to the generated base Compose file. Add this operator setting to the private
`/opt/harly/.env`:

```dotenv
HARLY_AI_PROXY_URL=http://72.56.87.18:8888
```

The override explicitly disables global Node proxy routing. Remove the previous
instance-wide `HTTPS_PROXY` and `NO_PROXY` entries when migrating this demo.
Keep the existing `AI_ENCRYPTION_KEY` and encrypted provider settings unchanged;
the OpenRouter API key is still configured through the Russian AI settings UI.
The proxy address is trusted instance configuration, not tenant-controlled data.
Only HTTP(S) proxy origins are accepted; paths, query strings and fragments are
rejected. A private proxy requiring Basic authentication can use URL credentials,
which must be kept in the private environment file.

Tinyproxy's allowlist and firewall must permit the Harly server's source IPv4
(`129.101.115.162`) on TCP port 8888 while retaining existing authorized clients.
HTTPS goes through a CONNECT tunnel; API authorization remains inside TLS.

```sh
cd /opt/harly
docker compose -p artdent-harly --profile proxy config --quiet
docker compose -p artdent-harly --profile proxy up -d app scheduler
```

The Compose `proxy` profile refers to the site's Caddy reverse proxy, a separate
component from the outbound Tinyproxy. With explicit `-f` arguments, include both
the base and override files; otherwise Compose automatically loads the override.

Verification should cover the public model catalog through the app, correlate
CONNECT requests with Tinyproxy logs, and compare AI and ordinary fetch egress.
Local HTTP tests cover proxy isolation, no direct fallback, request payloads,
streaming/cancellation and transport wiring for each SDK provider. Never print
API keys or candidate data while diagnosing the connection.

References: [AI SDK custom fetch](https://ai-sdk.dev/cookbook/node/intercept-fetch-requests),
[Undici ProxyAgent](https://github.com/nodejs/undici/blob/main/docs/docs/api/ProxyAgent.md)
and [Docker Compose overrides](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).
