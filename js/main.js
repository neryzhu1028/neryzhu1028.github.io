/* ============================================================
   东超哥个人网页 · 交互逻辑
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 视频配置：把占位地址替换成你的真实视频 ----------
     支持两种地址：
     1. 站内/外部 mp4：{ src: "https://xxx/video.mp4", type: "video" }
     2. 视频平台嵌入：{ src: "https://player.bilibili.com/player.html?bvid=xxx", type: "iframe" }
     例如腾讯视频：{ src: "https://v.qq.com/txp/iframe/player.html?vid=xxxx", type: "iframe" }
   ------------------------------------------------------------ */
  var VIDEOS = {
    "video-1": { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", type: "video" },
    "video-2": { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", type: "video" },
    "video-3": { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", type: "video" },
    "video-4": { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", type: "video" }
  };

  /* ---------- 顶部导航：滚动阴影 ---------- */
  var header = document.getElementById("site-header");

  function onScroll() {
    if (window.scrollY > 8) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 移动端汉堡菜单 ---------- */
  var navToggle = document.getElementById("nav-toggle");
  var navMenu = document.getElementById("nav-menu");

  function closeMenu() {
    navMenu.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "打开菜单");
  }

  navToggle.addEventListener("click", function () {
    var isOpen = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "关闭菜单" : "打开菜单");
  });

  navMenu.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", function (e) {
    if (
      navMenu.classList.contains("open") &&
      !navMenu.contains(e.target) &&
      !navToggle.contains(e.target)
    ) {
      closeMenu();
    }
  });

  /* ---------- 滚动显现动画 ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    // 降级：不支持时直接显示
    revealEls.forEach(function (el) {
      el.classList.add("visible");
    });
  }

  /* ---------- 视频播放弹窗 ---------- */
  var modal = document.getElementById("video-modal");
  var modalVideo = document.getElementById("modal-video");
  var lastFocused = null;

  function openModal(key) {
    var conf = VIDEOS[key];
    if (!conf) return;

    // 记录焦点来源，关闭后还原（无障碍）
    lastFocused = document.activeElement;

    modalVideo.innerHTML = "";
    if (conf.type === "video") {
      var video = document.createElement("video");
      video.src = conf.src;
      video.controls = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "metadata");
      modalVideo.appendChild(video);
    } else {
      var iframe = document.createElement("iframe");
      iframe.src = conf.src;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      iframe.title = "视频播放";
      modalVideo.appendChild(iframe);
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".modal-close").focus();
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modalVideo.innerHTML = "";
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  document.querySelectorAll(".video-card").forEach(function (card) {
    card.addEventListener("click", function () {
      openModal(card.getAttribute("data-video"));
    });
  });

  modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  /* ---------- 占位链接（href="#"）拦截：避免页面跳到顶部 ---------- */
  document.querySelectorAll('a[href="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
    });
  });

  /* ---------- 当前区块高亮（桌面端） ---------- */
  var sections = document.querySelectorAll("main section[id]");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));

  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              var isCurrent = link.getAttribute("href") === "#" + entry.target.id;
              link.style.color = isCurrent ? "var(--color-primary)" : "";
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }
})();
