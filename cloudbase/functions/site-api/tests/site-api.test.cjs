const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const test = require("node:test");
const { createServer } = require("../server");
const content = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../../data/content.json"), "utf8"));

async function start(t, fetchImpl) {
  const errors = [];
  const server = createServer({ fetchImpl, log: { error: (message) => errors.push(message) } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { url: "http://127.0.0.1:" + server.address().port, errors };
}

test("health is local and content supports gateway and direct paths", async (t) => {
  let fetches = 0;
  const { url } = await start(t, (source) => {
    assert.equal(source.href, "https://aceskills.cn/data/content.json");
    fetches += 1;
    return Promise.resolve(Response.json(content));
  });
  const health = await fetch(url + "/site-api/health");
  assert.deepEqual(await health.json(), { ok: true, service: "site-api" });
  assert.equal(fetches, 0);
  const headsAndGets = await Promise.all([
    fetch(url + "/site-api/v1/content"),
    fetch(url + "/v1/content", { method: "HEAD" })
  ]);
  assert.equal(headsAndGets[0].headers.get("cache-control"), "public, max-age=30");
  assert.deepEqual(await headsAndGets[0].json(), content);
  assert.equal(headsAndGets[1].status, 200);
  assert.equal(await headsAndGets[1].text(), "");
  assert.equal(fetches, 1);
});

test("unknown routes and writes are rejected before reading data", async (t) => {
  const { url } = await start(t, () => assert.fail("unexpected upstream read"));
  assert.equal((await fetch(url + "/site-api/v1/other")).status, 404);
  const write = await fetch(url + "/site-api/v1/content", { method: "POST" });
  assert.equal(write.status, 405);
  assert.equal(write.headers.get("allow"), "GET, HEAD, OPTIONS");
});

test("CORS is limited to existing website origins", async (t) => {
  const { url } = await start(t, () => assert.fail("unexpected upstream read"));
  const origin = "https://aceskills.cn";
  const valid = await fetch(url + "/site-api/v1/content", { method: "OPTIONS", headers: { Origin: origin } });
  assert.equal(valid.status, 204);
  assert.equal(valid.headers.get("access-control-allow-origin"), origin);
  const invalid = await fetch(url + "/health", { method: "OPTIONS", headers: { Origin: "https://example.com" } });
  assert.equal(invalid.status, 403);
  assert.equal(invalid.headers.get("access-control-allow-origin"), null);
});

test("upstream failures are sanitized and subsequent requests can recover", async (t) => {
  const fixtures = [
    () => { throw new Error("sensitive upstream diagnostic"); },
    () => new Response("<html>", { headers: { "Content-Type": "text/html" } }),
    () => Response.json({ site: {} }),
    () => Response.json({ ...content, padded: " ".repeat(2 * 1024 * 1024) }),
    () => Response.json(content)
  ];
  const { url, errors } = await start(t, () => Promise.resolve(fixtures.shift()()));
  for (let i = 0; i < 4; i += 1) {
    const result = await fetch(url + "/v1/content");
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "content_unavailable" });
  }
  assert.equal((await fetch(url + "/v1/content")).status, 200);
  assert.deepEqual(errors, Array(4).fill("site-api: content source check failed"));
});
