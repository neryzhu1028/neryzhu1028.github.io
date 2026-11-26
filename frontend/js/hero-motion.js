(() => {
  const scene = document.querySelector(".hero-scene");
  const canvas = document.getElementById("hero-particles");
  if (!scene || !canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const precisePointer = matchMedia("(pointer: fine)");
  const hero = scene.closest(".hero");
  const particles = Array.from({ length: 42 }, (_, i) => ({
    x: (Math.sin(i * 71.91) + 1) / 2,
    y: (Math.sin(i * 52.73) + 1) / 2,
    phase: i * 2.19,
    size: 0.35 + (i % 4) * 0.22
  }));

  let visible = false;
  let width = 0;
  let height = 0;
  let animation = 0;
  let lastFrame = 0;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(now) {
    animation = requestAnimationFrame(draw);
    if (now - lastFrame < 32) return;
    lastFrame = now;
    const time = now / 1000;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const ember = particle.y > 0.61;
      const x = width * (0.42 + particle.x * 0.56) + Math.sin(time * 0.45 + particle.phase) * 5;
      const y = height * (0.03 + particle.y * 0.86) + Math.cos(time * 0.42 + particle.phase) * 5;
      context.globalAlpha = 0.1 + (Math.sin(time * 0.8 + particle.phase) + 1) * (ember ? 0.22 : 0.12);
      context.fillStyle = ember ? "#ffd99e" : "#bff0e1";
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function syncMotion() {
    const active = visible && !document.hidden && !reduce.matches;
    scene.dataset.motion = active ? "on" : "off";
    if (active && !animation) {
      resize();
      animation = requestAnimationFrame(draw);
    }
    if (!active && animation) {
      cancelAnimationFrame(animation);
      animation = 0;
      context.clearRect(0, 0, width, height);
    }
    if (!active) resetPointer();
  }

  function resetPointer() {
    scene.style.removeProperty("--scene-x");
    scene.style.removeProperty("--scene-y");
  }

  hero.addEventListener("pointermove", (event) => {
    if (!precisePointer.matches || scene.dataset.motion !== "on") return;
    const rect = hero.getBoundingClientRect();
    scene.style.setProperty("--scene-x", ((event.clientX - rect.left) / rect.width - 0.5) * 12 + "px");
    scene.style.setProperty("--scene-y", ((event.clientY - rect.top) / rect.height - 0.5) * 8 + "px");
  }, { passive: true });
  hero.addEventListener("pointerleave", resetPointer);
  document.addEventListener("visibilitychange", syncMotion);
  reduce.addEventListener("change", syncMotion);
  window.addEventListener("resize", () => {
    if (animation) resize();
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncMotion();
    }, { threshold: 0.05 }).observe(hero);
  } else {
    visible = true;
    syncMotion();
  }
})();
