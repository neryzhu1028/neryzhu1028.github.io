/* ============================================================
   艾斯利个人网页 · 子页面通用渲染脚本
   适用页面：projects/ courses/ videos/ unboxing/ about/
   内容来源：../data/content.json（由后台管理系统维护）
   ============================================================ */

(function () {
  "use strict";

  var CONTENT = null;
  var VIDEOS = {};
  var revealIO = null;

  var PAGE = document.body.getAttribute("data-page") || "";

  var PAGE_CONF = {
    projects: {
      module: "projects",
      crumb: "项目",
      homeNav: "projects",
      render: renderProjectPage
    },
    courses: {
      module: "courses",
      crumb: "课程",
      homeNav: "courses",
      render: renderCoursePage
    },
    videos: {
      module: "videos",
      crumb: "旅拍",
      homeNav: "videos",
      render: renderVideoPage
    },
    unboxing: {
      module: "unboxing",
      crumb: "开箱",
      homeNav: "unboxing",
      render: renderUnboxingPage
    },
    about: {
      module: "about",
      crumb: "关于我",
      homeNav: "about",
      noCount: true,
      render: renderAboutPage
    }
  };

  /* ---------- 工具：HTML 转义 ---------- */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 封面：有上传图用 <img>，否则渐变 + emoji/播放钮 ---------- */
  function coverHtml(item, isVideo) {
    var base = isVideo ? "video-cover" : "card-cover";
    if (item.image) {
      return '<div class="' + base + ' cover-img" aria-hidden="true">' +
               '<img src="' + esc(item.image) + '" alt="" loading="lazy">' +
             '</div>';
    }
    var inner = isVideo
      ? '<span class="video-play" aria-hidden="true">▶</span>'
      : '<span class="card-emoji">' + esc(item.emoji || "📦") + "</span>";
    var cover = item.cover || (isVideo ? "cover-v1" : "cover-1");
    return '<div class="' + base + " " + esc(cover) + '" aria-hidden="true">' + inner + "</div>";
  }

  /* ---------- 渲染：站点信息（品牌 / 页脚） ---------- */
  function renderSite(site) {
    var titleSuffix = PAGE_CONF[PAGE] ? PAGE_CONF[PAGE].crumb : "";
    document.title = (site.pageTitle || "") + " · " + titleSuffix;

    var brandMark = document.getElementById("brand-mark");
    var brandName = document.getElementById("brand-name");
    var brandTagline = document.getElementById("brand-tagline");
    if (brandMark) brandMark.textContent = site.brandMark || "艾";
    if (brandName) brandName.textContent = site.brandName || "";
    if (brandTagline) brandTagline.textContent = site.brandTagline || "TECH · TRAVEL · TRUTH";

    var footerTag = document.getElementById("footer-tag");
    if (footerTag) footerTag.textContent = site.footerTag || "TECH · TRAVEL · TRUTH";
    var footerText = document.getElementById("footer-text");
    if (footerText) footerText.textContent = site.footerText || "";

    var links = document.getElementById("footer-links");
    if (links) {
      links.innerHTML = (site.socialLinks || [])
        .map(function (l) {
          return '<li><a href="' + esc(l.url || "#") + '" aria-label="' + esc(l.label) + '">' + esc(l.label) + "</a></li>";
        })
        .join("");
    }
  }

  /* ---------- 渲染：子页头部 ---------- */
  function renderPageHero(mod) {
    document.getElementById("page-tag").textContent = mod.tag || "";
    document.getElementById("page-title").textContent = mod.title || "";
    document.getElementById("page-desc").textContent = mod.desc || "";

    var count = document.getElementById("page-count");
    var items = mod.items || [];
    if (count) count.textContent = "共 " + items.length + " 项内容";
  }

  /* ---------- 项目页：全量卡片 ---------- */
  function renderProjectPage(mod) {
    var grid = document.getElementById("page-grid");
    if (!grid) return;
    grid.innerHTML = (mod.items || [])
      .map(function (item) {
        return (
          '<article class="card reveal">' +
            coverHtml(item, false) +
            '<div class="card-body">' +
              '<span class="card-cat">' + esc(item.category) + "</span>" +
              '<h3 class="card-title"><a href="' + esc(item.link || "#") + '">' + esc(item.title) + "</a></h3>" +
              '<p class="card-text">' + esc(item.text) + "</p>" +
              '<span class="card-meta">' + esc(item.meta) + "</span>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ---------- 课程页：全量课程 ---------- */
  function renderCoursePage(mod) {
    var list = document.getElementById("page-list");
    if (!list) return;
    list.innerHTML = (mod.items || [])
      .map(function (item) {
        var cls = item.statusClass || "soon";
        return (
          '<article class="course reveal">' +
            '<div class="course-icon" aria-hidden="true">' + esc(item.icon || "📚") + "</div>" +
            '<div class="course-info">' +
              '<h3 class="course-title">' + esc(item.title) + "</h3>" +
              '<p class="course-text">' + esc(item.text) + "</p>" +
            "</div>" +
            '<div class="course-meta">' +
              '<span class="course-tag course-tag-' + esc(cls) + '">' + esc(item.status) + "</span>" +
              '<a class="btn btn-small btn-ghost" href="' + esc(item.link || "#") + '">了解详情</a>' +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ---------- 旅拍页：视频网格 ---------- */
  function renderVideoPage(mod) {
    var grid = document.getElementById("page-grid");
    if (!grid) return;
    grid.innerHTML = (mod.items || [])
      .map(function (item) {
        var tag = item.tag ? ' data-tag="' + esc(item.tag) + '"' : "";
        return (
          '<button class="video-card reveal" type="button" data-video="' + esc(item.key) + '"' + tag + ' aria-label="播放视频：' + esc(item.title) + '">' +
            coverHtml(item, true) +
            '<div class="video-info">' +
              '<h3 class="video-title">' + esc(item.title) + "</h3>" +
              '<p class="video-meta">' + esc(item.meta) + "</p>" +
            "</div>" +
          "</button>"
        );
      })
      .join("");
    bindVideoCards();
  }

  /* ---------- 开箱页：全量卡片 ---------- */
  function renderUnboxingPage(mod) {
    renderProjectPage(mod); // 卡片结构一致，直接复用
  }

  /* ---------- 关于我页：故事 + 时间线 + 价值观 + CTA ---------- */
  function renderAboutPage(mod) {
    // 头像
    var avatar = document.getElementById("about-avatar");
    if (avatar) {
      if (mod.avatarImage) {
        avatar.innerHTML = '<img src="' + esc(mod.avatarImage) + '" alt="艾斯利的头像" loading="lazy">';
        avatar.classList.add("avatar-img");
      } else {
        avatar.textContent = mod.avatar || "艾";
        avatar.classList.remove("avatar-img");
      }
    }

    // 故事段落
    var story = document.getElementById("about-story");
    if (story) {
      story.innerHTML = (mod.story || [mod.text || ""])
        .filter(function (s) { return s; })
        .map(function (p) { return "<p>" + esc(p) + "</p>"; })
        .join("");
    }

    // 关注领域标签
    var focusTags = document.getElementById("about-focus-tags");
    if (focusTags) {
      focusTags.innerHTML = (mod.tags || [])
        .map(function (t) { return "<li>" + esc(t) + "</li>"; })
        .join("");
    }

    // 兴趣爱好标签
    var hobbies = document.getElementById("about-hobbies");
    if (hobbies) {
      hobbies.innerHTML = (mod.hobbies || [])
        .map(function (t) { return "<li>" + esc(t) + "</li>"; })
        .join("");
    }

    // 数据统计条
    var stats = document.getElementById("about-stats");
    if (stats) {
      stats.innerHTML = (mod.stats || (CONTENT.hero && CONTENT.hero.stats) || [])
        .map(function (s) {
          return "<li><strong>" + esc(s.num) + "</strong><span>" + esc(s.label) + "</span></li>";
        })
        .join("");
    }

    // 时间线
    var timeline = document.getElementById("about-timeline");
    if (timeline) {
      timeline.innerHTML = (mod.timeline || [])
        .map(function (item) {
          return (
            '<li class="timeline-item reveal">' +
              '<span class="timeline-year">' + esc(item.year) + "</span>" +
              '<div class="timeline-card">' +
                '<h3 class="timeline-title">' + esc(item.title) + "</h3>" +
                '<p class="timeline-text">' + esc(item.text) + "</p>" +
              "</div>" +
            "</li>"
          );
        })
        .join("");
    }

    // 价值观卡片
    var values = document.getElementById("about-values");
    if (values) {
      values.innerHTML = (mod.values || [])
        .map(function (item) {
          return (
            '<article class="value-card reveal">' +
              '<div class="value-icon" aria-hidden="true">' + esc(item.icon || "✨") + "</div>" +
              '<h3 class="value-title">' + esc(item.title) + "</h3>" +
              '<p class="value-text">' + esc(item.text) + "</p>" +
            "</article>"
          );
        })
        .join("");
    }

    // 联系 CTA
    var ctaTitle = document.getElementById("about-cta-title");
    if (ctaTitle && mod.ctaTitle) ctaTitle.textContent = mod.ctaTitle;
    var ctaText = document.getElementById("about-cta-text");
    if (ctaText && mod.ctaText) ctaText.textContent = mod.ctaText;

    var actions = document.getElementById("about-cta-actions");
    if (actions) {
      var c = mod.contact || {};
      actions.innerHTML =
        '<a class="btn btn-primary" href="mailto:' + esc(c.email || "hello@example.com") + '">' + esc(c.emailLabel || "联系我") + "</a>" +
        '<a class="btn btn-ghost" href="' + esc(c.socialHref || "#") + '">' + esc(c.socialLabel || "公众号") + "</a>";
    }
  }

  /* ---------- 视频弹窗 ---------- */
  function videoSource(key, item) {
    if (VIDEOS[key] && VIDEOS[key].src) return VIDEOS[key];
    if (item && item.src) return { src: item.src, type: item.srcType || "iframe" };
    return null;
  }

  function findItemByKey(key) {
    var items = (CONTENT.videos && CONTENT.videos.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].key === key) return items[i];
    }
    return null;
  }

  function openModal(key) {
    var modal = document.getElementById("video-modal");
    var modalVideo = document.getElementById("modal-video");
    if (!modal || !modalVideo) return;

    var conf = videoSource(key, findItemByKey(key));
    if (!conf || !conf.src) return;

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
    var closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    var modal = document.getElementById("video-modal");
    var modalVideo = document.getElementById("modal-video");
    if (!modal || !modalVideo || modal.hidden) return;
    modal.hidden = true;
    modalVideo.innerHTML = "";
    document.body.style.overflow = "";
  }

  function bindVideoCards() {
    document.querySelectorAll(".video-card").forEach(function (card) {
      if (card.dataset.bound) return;
      card.dataset.bound = "1";
      card.addEventListener("click", function () {
        openModal(card.getAttribute("data-video"));
      });
    });
  }

  function initModal() {
    var modal = document.getElementById("video-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }

  /* ---------- 滚动显现动画 ---------- */
  function makeRevealObserver() {
    if (!("IntersectionObserver" in window)) return null;
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            if (revealIO) revealIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }

  function observeReveals(root) {
    if (!revealIO) revealIO = makeRevealObserver();
    var els = (root || document).querySelectorAll(".reveal:not(.visible)");
    els.forEach(function (el) {
      if (revealIO) {
        revealIO.observe(el);
      } else {
        el.classList.add("visible");
      }
    });
  }

  /* ---------- 顶部导航：滚动阴影 ---------- */
  function initHeaderScroll() {
    var header = document.getElementById("site-header");
    if (!header) return;
    function onScroll() {
      if (window.scrollY > 8) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 移动端汉堡菜单 ---------- */
  function initMobileNav() {
    var navToggle = document.getElementById("nav-toggle");
    var navMenu = document.getElementById("nav-menu");
    if (!navToggle || !navMenu) return;

    function closeMenu() {
      navMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }

    navToggle.addEventListener("click", function () {
      var isOpen = navMenu.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
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
  }

  /* ---------- 当前页导航高亮 ---------- */
  function initActiveNav() {
    var conf = PAGE_CONF[PAGE];
    if (!conf) return;
    document.querySelectorAll(".nav-link").forEach(function (link) {
      if (link.getAttribute("href") === "../index.html#" + conf.homeNav) {
        link.classList.add("active");
      }
    });
  }

  /* ---------- 占位链接拦截 ---------- */
  function initPlaceholderLinks() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href="#"]') : null;
      if (a) e.preventDefault();
    });
  }

  /* ---------- 主渲染入口 ---------- */
  function renderAll() {
    var conf = PAGE_CONF[PAGE];
    if (!conf) return;
    var mod = CONTENT[conf.module] || {};

    renderSite(CONTENT.site || {});
    renderPageHero(mod);
    conf.render(mod);
    observeReveals(document.getElementById("main"));
  }

  function loadContent() {
    if (location.protocol === "file:") {
      var main = document.getElementById("main");
      if (main) {
        main.innerHTML =
          '<div class="container" style="padding-top:140px;text-align:center;color:#6b7280;">' +
          "<p>⚠️ 子页面不支持 file:// 协议直接打开，请通过本地服务器或线上地址访问。</p></div>";
      }
      return;
    }
    // 管理后台预览模式：URL 带 ?draft=1 时读取本地草稿，不影响普通访客
    if (/[?&]draft=1/.test(location.search)) {
      try {
        var draftRaw = JSON.parse(localStorage.getItem("as_cms_draft") || "null");
        if (draftRaw && draftRaw.data && draftRaw.data.site) {
          CONTENT = draftRaw.data;
          VIDEOS = (CONTENT.videos && CONTENT.videos.sources) || {};
          renderAll();
          return;
        }
      } catch (e) { /* 草稿损坏则回落到正常 fetch */ }
    }
    fetch("../data/content.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        CONTENT = data;
        VIDEOS = (data.videos && data.videos.sources) || {};
        renderAll();
      })
      .catch(function (err) {
        var p = document.createElement("div");
        p.style.cssText =
          "position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:#fff;" +
          "padding:16px 20px;text-align:center;font-size:14px;font-family:system-ui,sans-serif;";
        p.textContent = "⚠️ 内容加载失败（data/content.json）：" + (err && err.message || err);
        document.body.prepend(p);
        console.error("Content load error:", err);
      });
  }

  /* ---------- 启动 ---------- */
  initHeaderScroll();
  initMobileNav();
  initActiveNav();
  initModal();
  initPlaceholderLinks();
  loadContent();
})();
