async (page) => {
  const base = "http://127.0.0.1:18765";
  const output = "output/playwright/after";
  const errors = [];
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const visible = async (selector) => page.locator(selector).first().waitFor({ state: "visible" });
  const navigate = async (route) => {
    const response = await page.goto(base + route, { waitUntil: "domcontentloaded" });
    if (response?.status() !== 200) throw new Error("Route failed " + route);
  };

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) errors.push(response.url());
  });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [862, 870], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await navigate("/");
    await page.waitForFunction(() => document.querySelector(".hero-landscape img").naturalWidth > 0);
    await visible("#project-grid .card");
    await page.locator("#hero-title").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "on");
    await page.locator(".hero-copy").evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
    const layout = await page.evaluate(() => {
      const title = document.querySelector("#hero-title").getBoundingClientRect();
      const actions = document.querySelector("#hero-actions").getBoundingClientRect();
      const loaded = document.querySelector(".hero-landscape img").currentSrc;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        titleFits: title.left >= 0 && title.right <= innerWidth && title.top >= 60 && actions.bottom <= innerHeight,
        poster: loaded.includes(innerWidth <= 680 ? "aurora-mobile" : "aurora-desktop")
      };
    });
    assert(!layout.overflow && layout.titleFits && layout.poster, width + "×" + height + " layout and poster");
    const name = width === 1440 ? "home-desktop" : width === 390 ? "home-mobile" : "home-" + width;
    await page.screenshot({ path: output + "/" + name + ".png" });
  }

  const mobile = page.locator("#nav-toggle");
  await mobile.click();
  assert(await mobile.getAttribute("aria-expanded") === "true", "mobile menu opens");
  await page.screenshot({ path: output + "/mobile-menu.png" });
  await page.keyboard.press("Escape");
  assert(await mobile.getAttribute("aria-expanded") === "false" &&
    await mobile.evaluate((element) => element === document.activeElement), "mobile menu closes and restores focus");
  await page.getByRole("link", { name: "浏览我的项目" }).click();
  assert(new URL(page.url()).hash === "#projects", "project action keeps its anchor");
  await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "off");
  await navigate("/");
  await page.getByRole("link", { name: "观看旅拍视频" }).click();
  assert(new URL(page.url()).hash === "#videos", "travel action keeps its anchor");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await navigate("/");
  await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "off");
  assert(await page.locator("#hero-effects").isHidden(),
    "reduced motion renders a static hero");
  assert(await page.locator("a[href^='mailto:']").count() === 0 && await page.getByText("联系邮箱待补").count() === 1,
    "example address has a visible placeholder with no mail link");

  for (const [route, selector] of [["projects", ".card"], ["courses", ".course"], ["videos", "button[data-video]"],
    ["unboxing", ".card"], ["about", "#about-timeline .timeline-item"]]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigate("/" + route + "/");
    await visible(selector);
    await visible("[aria-current=page]");
    if (route !== "about") {
      const banner = page.locator(".page-hero-art");
      await banner.evaluate((image) => image.decode());
      assert(await banner.evaluate((image, slug) => image.naturalWidth > 0 &&
        new URL(image.currentSrc).pathname.includes("/" + slug + "-banner."), route), route + " topic banner");
    }
    await page.screenshot({ path: output + "/" + route + ".png" });
    await navigate("/" + route + "/index.html");
    await visible(selector);
    assert(await page.locator("main h1").count() === 1, route + " directory and legacy URL");
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + " mobile layout");
  }

  await page.route("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/**", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", path: "output/playwright/fixtures/video.mp4" }));
  await navigate("/videos/");
  const videoCard = page.getByRole("button", { name: /播放示例视频/ }).first();
  await videoCard.click();
  await visible("dialog[open]");
  await page.waitForFunction(() => document.querySelector("#modal-video video")?.readyState >= 1);
  assert((await page.locator("#video-notice").textContent()).includes("示例"), "example media is labeled and the player loads a local fixture");
  await page.screenshot({ path: output + "/video-dialog.png" });
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert(await videoCard.evaluate((element) => document.activeElement === element), "video dialog restores focus");
  assert(errors.length === 0, "public pages have no browser errors: " + errors.join(", "));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await navigate("/");
  await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "on");
  const effects = page.locator("#hero-effects");
  const sample = () => effects.evaluate((canvas) => {
    const small = document.createElement("canvas");
    small.width = 72;
    small.height = 48;
    const context = small.getContext("2d");
    context.drawImage(canvas, 0, 0, small.width, small.height);
    const data = context.getImageData(0, 0, small.width, small.height).data;
    return Array.from(data.filter((_, index) => index % 4 === 3));
  });
  const firstFrame = await sample();
  await page.screenshot({ path: output + "/motion-01.png" });
  await page.waitForFunction(() => document.querySelector("#home").getBoundingClientRect().top === 0);
  await page.waitForTimeout(1500);
  const secondFrame = await sample();
  const changed = secondFrame.filter((pixel, index) => Math.abs(pixel - firstFrame[index]) > 8).length;
  assert(changed > 60, "aurora and reflections change location without pointer input");
  await page.screenshot({ path: output + "/motion-02.png" });

  assert(await page.locator(".hero-motion-toggle").count() === 0, "hero has no motion button");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "off");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => document.querySelector(".hero-scene").dataset.motion === "on");
  assert(true, "motion responds to preference changes without a reload");

  const fixture = await (await page.request.get(base + "/data/content.json")).json();
  const testImage = await (await page.request.get(base + await page.locator(".hero-landscape img").evaluate((el) => new URL(el.src).pathname))).body();
  let updates = 0;
  let imagePath;
  const apiOrigin = "https://api.github.com";
  const repo = "/repos/neryzhu1028/neryzhu1028.github.io";
  await page.route(apiOrigin + "/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const httpMethod = request.method();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-github-api-version, content-type",
      "access-control-allow-methods": "GET, PUT, OPTIONS"
    };
    const reply = (status, json) => route.fulfill({ status, json, headers });
    if (httpMethod === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === repo) return reply(200, { permissions: { push: true } });
    if (path === repo + "/contents/data/content.json") {
      if (httpMethod === "GET") return reply(200, { content: Buffer.from(JSON.stringify(fixture)).toString("base64"), sha: "original" });
      const body = request.postDataJSON();
      const saved = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
      if (!saved.hero.titleHighlight.includes("验收")) throw new Error("Missing edited title");
      if (!saved.projects.items[0].image?.includes(imagePath)) throw new Error("Missing uploaded image");
      updates += 1;
      if (updates === 1 && body.sha !== "original") throw new Error("Missing existing GitHub SHA");
      return updates === 1 ? reply(200, { content: { sha: "saved" } }) : reply(409, { message: "conflict" });
    }
    if (path.startsWith(repo + "/contents/assets/uploads/")) {
      if (httpMethod === "GET") return reply(404, { message: "Not found" });
      imagePath = path.slice((repo + "/contents/").length);
      if (!request.postDataJSON().content) throw new Error("Empty upload");
      return reply(201, { content: { path: imagePath, sha: "image" } });
    }
    throw new Error("Unexpected GitHub path " + path);
  });
  await page.route(base + "/assets/uploads/*", (route) => route.fulfill({ status: 200, contentType: "image/webp", body: testImage }));

  await navigate("/admin/");
  await visible("#login-btn");
  assert(await page.getByText(/录音卡|AI 服务/).count() === 0, "retired panel absent");
  await page.locator("#login-token").fill("fixture-token");
  await page.locator("#login-btn").click();
  await visible("#btn-logout");
  await page.reload({ waitUntil: "domcontentloaded" });
  await visible("#btn-logout");
  assert(await page.evaluate(() => sessionStorage.getItem("as_cms_token") !== null &&
    localStorage.getItem("as_cms_token") === null), "CMS login respects session-only across reload");

  await page.locator("[data-panel=projects]").click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "fixture.webp", mimeType: "image/webp", buffer: testImage });
  await page.getByText(/图片已上传/).waitFor({ state: "visible" });
  assert(Boolean(imagePath), "CMS compresses and uploads the cover");
  await page.locator("[data-panel=hero]").click();
  const title = page.locator('[data-path="hero.titleHighlight"]');
  await title.fill("艾思力验收");
  await page.locator("#btn-preview").click();
  await page.frameLocator("#preview-frame").getByRole("heading", { name: /艾思力验收/ }).waitFor();
  assert(true, "CMS draft preview renders independently");
  await page.locator("#preview-close").click();
  await page.locator("#btn-save").click();
  await page.getByText(/已保存并发布/).waitFor({ state: "visible" });
  assert(updates === 1, "CMS publishes with the original SHA");
  await title.fill("艾思力验收冲突");
  await page.locator("#btn-save").click();
  await visible("#conflict-modal");
  assert(updates === 2, "CMS shows conflict dialog on 409");
  await page.locator("#conflict-cancel").click();
  const visitor = await page.context().newPage();
  try {
    await visitor.goto(base + "/", { waitUntil: "domcontentloaded" });
    await visitor.locator("#project-grid .card").first().waitFor();
    assert(!(await visitor.locator("#hero-title").textContent()).includes("验收"), "normal visit does not load local draft");
  } finally {
    await visitor.close();
  }
  console.log("PASSED " + checks.length + " checks: " + JSON.stringify(checks));
  return checks;
}
