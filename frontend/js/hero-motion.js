(() => {
  const hero = document.getElementById("home");
  const scene = hero?.querySelector(".hero-scene");
  const image = scene?.querySelector(".hero-landscape img");
  const canvas = document.getElementById("hero-effects");
  const button = hero?.querySelector(".hero-motion-toggle");
  const context = canvas?.getContext("2d");
  if (!scene || !image || !button || !context) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 680px)");
  const pointer = matchMedia("(pointer: fine)");
  const tau = 2 * Math.PI;

  // Positions are relative to the artwork, so the light follows the stairs on cropped displays.
  const desktopSteps = [
    [0.66, 0.87], [0.80, 0.83], [0.84, 0.78], [0.76, 0.735],
    [0.79, 0.68], [0.86, 0.64], [0.88, 0.61], [0.83, 0.56],
    [0.76, 0.51], [0.69, 0.47], [0.63, 0.43], [0.58, 0.395],
    [0.55, 0.36], [0.56, 0.335], [0.60, 0.31]
  ];
  const mobileSteps = [
    [0.54, 0.95], [0.63, 0.90], [0.72, 0.85], [0.79, 0.81],
    [0.85, 0.77], [0.90, 0.73], [0.87, 0.70], [0.81, 0.676], [0.71, 0.66]
  ];

  // Stretch a single soft, tapered brush into upright rays instead of blurring hundreds of paths per frame.
  function makeRay() {
    const ray = document.createElement("canvas");
    ray.width = 32;
    ray.height = 128;
    const ctx = ray.getContext("2d");
    const height = ctx.createLinearGradient(0, 0, 0, ray.height);
    height.addColorStop(0, "rgba(40,176,148,0)");
    height.addColorStop(0.32, "rgba(49,205,158,.11)");
    height.addColorStop(0.7, "rgba(89,226,151,.39)");
    height.addColorStop(0.86, "rgba(140,249,144,.63)");
    height.addColorStop(0.94, "rgba(205,255,168,.78)");
    height.addColorStop(1, "rgba(144,247,142,0)");
    ctx.fillStyle = height;
    ctx.fillRect(0, 0, ray.width, ray.height);
    ctx.globalCompositeOperation = "destination-in";
    const width = ctx.createLinearGradient(0, 0, ray.width, 0);
    width.addColorStop(0, "transparent");
    width.addColorStop(0.5, "black");
    width.addColorStop(1, "transparent");
    ctx.fillStyle = width;
    ctx.fillRect(0, 0, ray.width, ray.height);
    return ray;
  }

  function makeGlow(color) {
    const glow = document.createElement("canvas");
    glow.width = glow.height = 48;
    const ctx = glow.getContext("2d");
    const fading = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    fading.addColorStop(0, `rgba(${color},1)`);
    fading.addColorStop(0.28, `rgba(${color},.55)`);
    fading.addColorStop(1, "transparent");
    ctx.fillStyle = fading;
    ctx.fillRect(0, 0, 48, 48);
    return glow;
  }

  const ray = makeRay();
  const gold = makeGlow("255,202,117");
  const green = makeGlow("136,247,172");
  let seed = 37842;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({ length: 88 }, () => [random(), random(), random(), random() * tau]);
  const sparks = Array.from({ length: 28 }, () => [random(), random(), random(), random()]);
  const ripples = Array.from({ length: 42 }, () => [random(), random(), random(), random() * tau]);

  let viewportWidth = 0;
  let viewportHeight = 0;
  let artWidth = 0;
  let artHeight = 0;
  let offsetX = 0;
  let offsetY = 0;
  let inView = false;
  let paused = false;
  let frame = 0;
  let renderedAt = 0;
  let elapsed = 0;

  function resize() {
    if (!image.naturalWidth || !canvas.clientWidth || !canvas.clientHeight) return;
    viewportWidth = canvas.clientWidth;
    viewportHeight = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.45, 1440 / viewportWidth, 960 / viewportHeight);
    canvas.width = Math.round(viewportWidth * ratio);
    canvas.height = Math.round(viewportHeight * ratio);

    const cover = Math.max(viewportWidth / image.naturalWidth, viewportHeight / image.naturalHeight);
    const [left, top] = getComputedStyle(image).objectPosition.split(/\s+/).map(parseFloat);
    artWidth = image.naturalWidth * cover;
    artHeight = image.naturalHeight * cover;
    offsetX = (viewportWidth - artWidth) * left / 100;
    offsetY = (viewportHeight - artHeight) * top / 100;
    context.setTransform(canvas.width / viewportWidth, 0, 0, canvas.height / viewportHeight, 0, 0);
    if (!reduce.matches) paint(elapsed);
  }

  function drawGlow(sprite, x, y, width, height, opacity) {
    context.globalAlpha = Math.min(1, Math.max(0, opacity));
    context.drawImage(sprite, offsetX + x * artWidth - width / 2, offsetY + y * artHeight - height / 2, width, height);
  }

  function drawCurtain(time, foreground) {
    const portrait = mobile.matches;
    const start = foreground ? 0.49 : 0.54;
    const span = portrait ? (foreground ? 0.57 : 0.5) : (foreground ? 0.52 : 0.54);
    const samples = foreground ? 180 : 88;
    const phase = foreground ? time * 0.77 : time * 0.57 + 2.3;
    const strength = foreground ? 0.66 : 0.28;

    for (let i = 0; i < samples; i += 1) {
      const u = i / (samples - 1);
      const drift = Math.sin(phase * 0.46) * (portrait ? 0.036 : 0.053);
      const fold = Math.sin(u * 12 - phase) + 0.3 * Math.sin(u * 28 + phase * 0.66);
      const x = start + u * span + drift + fold * (foreground ? 0.041 : 0.024);
      const fall = portrait ? 0.47 : 0.55;
      const y = (portrait ? 0.69 : 0.59) - u * fall
        + 0.057 * Math.sin(u * 11 - phase + (foreground ? 0.6 : 1.4))
        + 0.017 * Math.sin(u * 26 + phase);
      const envelope = Math.min(1, u * 8, (1 - u) * 8);
      const rayLength = artHeight * (0.14 + 0.19 * u + 0.072 * fold);
      const texture = 0.51 + 0.28 * Math.sin(i * 2.399) + 0.15 * Math.sin(i * 1.083 + phase * 2.4);
      const beam = Math.pow(0.5 + 0.5 * Math.sin(u * 12 - phase * 1.85), 2);
      const base = (portrait ? 0.96 : 1.26) * artWidth / samples;
      if (foreground && i % 12 === 0) {
        drawGlow(green, x, y - rayLength / artHeight * 0.34,
          artWidth * 0.1, rayLength * 1.42, envelope * (0.02 + 0.08 * beam));
      }
      context.globalAlpha = strength * envelope * texture * (0.26 + 0.74 * beam);
      context.drawImage(ray, offsetX + x * artWidth - base / 2, offsetY + y * artHeight - rayLength,
        base * (0.76 + 0.58 * texture), rayLength);
    }
  }

  function drawStars(time) {
    context.fillStyle = "#defff2";
    for (const [x, y, size, phase] of stars) {
      const alpha = 0.13 + 0.29 * Math.pow(0.5 + 0.5 * Math.sin(time * (0.8 + size) + phase), 3);
      context.globalAlpha = alpha;
      const r = 0.42 + size * 0.58;
      context.fillRect(offsetX + (0.34 + x * 0.65) * artWidth, offsetY + y * 0.57 * artHeight, r, r);
    }
  }

  function drawStairs(time) {
    const route = mobile.matches ? mobileSteps : desktopSteps;
    const lightPosition = time * 3;
    for (let i = 0; i < route.length; i += 1) {
      const [x, y] = route[i];
      const pulse = Math.pow(0.5 + 0.5 * Math.cos(i * 0.65 - lightPosition), 8);
      const profile = 1 - 0.63 * i / route.length;
      drawGlow(gold, x, y, artWidth * 0.095 * profile, artHeight * 0.018 * profile, 0.08 + 0.43 * pulse);
    }

    for (const [start, speed, lateral, size] of sparks) {
      const progress = (start + time * (0.06 + speed * 0.075)) % 1;
      const index = progress * (route.length - 1);
      const lower = Math.floor(index);
      const mix = index - lower;
      const [x0, y0] = route[lower];
      const [x1, y1] = route[Math.min(lower + 1, route.length - 1)];
      const x = x0 + (x1 - x0) * mix + (lateral - 0.5) * 0.105 + Math.sin(time + start * tau) * 0.012;
      const y = y0 + (y1 - y0) * mix - 0.013 - lateral * 0.075;
      const flicker = 0.32 + 0.68 * Math.pow(0.5 + 0.5 * Math.sin(time * (2 + speed * 2) + start * 19), 2);
      const radius = (2 + size * 4) * (1 - 0.54 * progress);
      drawGlow(gold, x, y, radius * 2, radius * 2, flicker * Math.sin(progress * Math.PI));
    }
  }

  function drawWater(time) {
    const portrait = mobile.matches;
    for (const [x, depth, length, phase] of ripples) {
      const wave = Math.pow(0.5 + 0.5 * Math.sin(time * (1.55 + depth) + phase), 2);
      const center = portrait ? 0.29 : 0.47;
      const spread = (portrait ? 0.53 : 0.49) * (0.42 + depth * 0.58);
      drawGlow(depth > 0.56 ? green : gold, center + (x - 0.5) * spread + Math.sin(time * 0.9 + phase) * 0.027,
        (portrait ? 0.735 : 0.719) + depth * 0.26,
        artWidth * (0.015 + length * (0.035 + depth * 0.027)), 2 + depth * 5, 0.06 + 0.36 * wave);
    }
  }

  function paint(time) {
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.globalCompositeOperation = "lighter";
    drawStars(time);
    drawCurtain(time, false);
    drawCurtain(time, true);
    drawStairs(time);
    drawWater(time);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    // Keep the effect smooth at 30 fps and cap active time so hidden tabs never cause jumps.
    if (!renderedAt) renderedAt = now - 34;
    if (now - renderedAt < 31) return;
    elapsed += Math.min(now - renderedAt, 60) / 1000;
    renderedAt = now;
    paint(elapsed);
  }

  function syncMotion() {
    const active = inView && !document.hidden && !reduce.matches && !paused && !!viewportWidth;
    scene.dataset.motion = active ? "on" : "off";
    button.hidden = reduce.matches || !viewportWidth;
    if (active && !frame) frame = requestAnimationFrame(tick);
    if (!active && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      renderedAt = 0;
    }
    if (!active) resetPointer();
    if (reduce.matches) context.clearRect(0, 0, viewportWidth, viewportHeight);
  }

  function resetPointer() {
    scene.style.removeProperty("--scene-x");
    scene.style.removeProperty("--scene-y");
  }

  function refresh() {
    resize();
    syncMotion();
  }

  button.addEventListener("click", () => {
    paused = !paused;
    button.toggleAttribute("data-paused", paused);
    button.setAttribute("aria-label", paused ? "播放动效" : "暂停动效");
    syncMotion();
  });
  hero.addEventListener("pointermove", (event) => {
    if (!pointer.matches || scene.dataset.motion !== "on") return;
    const rect = hero.getBoundingClientRect();
    scene.style.setProperty("--scene-x", ((event.clientX - rect.left) / rect.width - 0.5) * 10 + "px");
    scene.style.setProperty("--scene-y", ((event.clientY - rect.top) / rect.height - 0.5) * 6 + "px");
  }, { passive: true });
  hero.addEventListener("pointerleave", resetPointer);
  image.addEventListener("load", refresh);
  document.addEventListener("visibilitychange", syncMotion);
  reduce.addEventListener("change", refresh);
  window.addEventListener("resize", refresh, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncMotion();
    }, { threshold: 0 }).observe(hero);
  } else {
    inView = true;
  }
  refresh();
})();
