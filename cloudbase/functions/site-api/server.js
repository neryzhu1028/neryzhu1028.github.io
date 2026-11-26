const http = require("node:http");

const defaultContentUrl = "https://aceskills.cn/data/content.json";
const siteOrigins = [
  "https://aceskills.cn",
  "https://www.aceskills.cn",
  "https://neryzhu1028.github.io",
  "https://aceskills-2026-d4gpqs1bbda809728-1451609693.tcloudbaseapp.com"
];
const contentKeys = ["site", "hero", "projects", "courses", "videos", "unboxing", "about"];
const contentLimit = 2 * 1024 * 1024;
const contentTTL = 30_000;

function createServer({ contentUrl = defaultContentUrl, fetchImpl = fetch, log = console } = {}) {
  const source = new URL(contentUrl);
  const local = source.protocol === "http:" && ["127.0.0.1", "localhost"].includes(source.hostname);
  if ((!local && source.protocol !== "https:") || source.username || source.password) {
    throw new Error("Invalid SITE_CONTENT_URL");
  }

  let snapshot;
  let expires = 0;
  let pending;

  async function readSource() {
    const upstream = await fetchImpl(source, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(2_500)
    });
    if (!upstream.ok || !upstream.body ||
        !/^application\/json(?:\s*;|$)/i.test(upstream.headers.get("content-type") || "")) {
      if (upstream.body) await upstream.body.cancel();
      throw new Error("Content source unavailable");
    }

    const reader = upstream.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > contentLimit) {
          await reader.cancel();
          throw new Error("Content exceeds size limit");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const data = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
    if (!data || !contentKeys.every((key) => data[key] && typeof data[key] === "object" && !Array.isArray(data[key]))) {
      throw new Error("Invalid content schema");
    }
    snapshot = data;
    expires = Date.now() + contentTTL;
    return snapshot;
  }

  function getContent() {
    if (Date.now() < expires) return Promise.resolve(snapshot);
    if (!pending) pending = readSource().finally(() => { pending = undefined; });
    return pending;
  }

  return http.createServer(async (request, response) => {
    const path = (request.url || "").split("?")[0].replace(/^\/site-api(?=\/|$)/, "").replace(/\/$/, "") || "/";
    const origin = request.headers.origin;
    const allowed = siteOrigins.includes(origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (allowed) response.setHeader("Access-Control-Allow-Origin", origin);

    function send(status, payload, cache = "no-store") {
      const body = JSON.stringify(payload);
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": cache
      });
      response.end(request.method === "HEAD" ? undefined : body);
    }

    if (!["/health", "/v1/content"].includes(path)) return send(404, { error: "not_found" });
    if (request.method === "OPTIONS") {
      if (!allowed) return send(403, { error: "origin_not_allowed" });
      response.writeHead(204, { "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS" });
      return response.end();
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD, OPTIONS");
      return send(405, { error: "method_not_allowed" });
    }
    if (path === "/health") return send(200, { ok: true, service: "site-api" });

    try {
      const content = await getContent();
      return send(200, content, "public, max-age=30");
    } catch (_) {
      log.error("site-api: content source check failed");
      return send(503, { error: "content_unavailable" });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || process.env.FUNCTIONS_CONCURRENCY_PORT || 9000);
  createServer({ contentUrl: process.env.SITE_CONTENT_URL || defaultContentUrl }).listen(port, "0.0.0.0", () => {
    console.log("site-api listening on " + port);
  });
}

module.exports = { createServer };
