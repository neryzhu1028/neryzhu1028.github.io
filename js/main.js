/* ============================================================
   艾斯利个人网页 · 数据驱动渲染 + 交互逻辑
   内容来源：data/content.json（由后台管理系统维护）
   ============================================================ */

(function () {
  "use strict";

  var CONTENT = null;      // 全站内容数据
  var VIDEOS = {};         // 视频播放源（来自 content.json）
  var revealIO = null;     // 滚动显现动画观察器
  var spyIO = null;        // 导航高亮观察器

  /* ---------- 工具：HTML 转义（防止后台输入破坏页面结构） ---------- */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 图片：有上传图用 <img>，否则用渐变封面 + emoji ---------- */
  function coverHtml(item, isVideo) {
    var base = isVideo ? "video-cover" : "card-cover";
    if (item.image) {
      return '<div class="' + base + ' cover-img" aria-hidden="true">' +
               '<img src="' + esc(item.image) + '" alt="" loading="lazy">' +
             '</div>';
    }
    var emoji = isVideo
      ? '<span class="video-play" aria-hidden="true">▶</span>'
      : '<span class="card-emoji">' + esc(item.emoji || "📦") + "</span>";
    return '<div class="' + base + " " + esc(item.cover || "cover-1") + '" aria-hidden="true">' + emoji + "</div>";
  }

  /* ---------- 渲染：站点信息（标题 / 品牌 / 页脚） ---------- */
  function renderSite(site) {
    document.title = site.pageTitle || document.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", site.description || "");
    var metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) metaAuthor.setAttribute("content", site.author || "");
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", site.pageTitle || "");
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", site.ogDescription || "");

    document.getElementById("brand-mark").textContent = site.brandMark || "艾";
    document.getElementById("brand-name").textContent = site.brandName || "";
    document.getElementById("footer-text").textContent = site.footerText || "";

    var links = document.getElementById("footer-links");
    links.innerHTML = (site.socialLinks || [])
      .map(function (l) {
        return '<li><a href="' + esc(l.url || "#") + '" aria-label="' + esc(l.label) + '">' + esc(l.label) + "</a></li>";
      })
      .join("");
  }

  /* ---------- 渲染：Hero ---------- */
  function renderHero(hero) {
    document.getElementById("hero-eyebrow").textContent = hero.eyebrow || "";
    var title = document.getElementById("hero-title");
    title.innerHTML = esc(hero.titlePrefix || "") + '<span class="gradient-text">' + esc(hero.titleHighlight || "") + "</span>";
    document.getElementById("hero-subtitle").textContent = hero.subtitle || "";

    var actions = document.getElementById("hero-actions");
    actions.innerHTML =
      '<a class="btn btn-primary" href="' + esc(hero.primaryBtn.href || "#projects") + '">' + esc(hero.primaryBtn.text) + "</a>" +
      '<a class="btn btn-ghost" href="' + esc(hero.ghostBtn.href || "#videos") + '">' + esc(hero.ghostBtn.text) + "</a>";

    var stats = document.getElementById("hero-stats");
    stats.innerHTML = (hero.stats || [])
      .map(function (s) {
        return "<li><strong>" + esc(s.num) + "</strong><span>" + esc(s.label) + "</span></li>";
      })
      .join("");
  }

  /* ---------- 渲染：区块头部（tag / title / desc） ---------- */
  function renderSectionHead(sectionId, data) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    var tag = sec.querySelector(".section-tag");
    var title = sec.querySelector(".section-title");
    var desc = sec.querySelector(".section-desc");
    if (tag && data.tag != null) tag.textContent = data.tag;
    if (title && data.title != null) title.textContent = data.title;
    if (desc && data.desc != null) desc.textContent = data.desc;
    var more = sec.querySelector(".section-more");
    if (more) {
      var a = more.querySelector("a");
      if (a && data.moreText != null) a.textContent = data.moreText;
      if (a && data.moreHref != null) a.setAttribute("href", data.moreHref || "#");
    }
  }

  /* ---------- 渲染：项目 / 开箱卡片 ---------- */
  function renderCards(gridId, items) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = (items || [])
      .map(function (item, i) {
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

  /* ---------- 渲染：课程 ---------- */
  function renderCourses(listId, items) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = (items || [])
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
              '<a class="btn btn-small" href="' + esc(item.link || "#") + '">了解详情</a>' +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ---------- 渲染：旅拍视频 ---------- */
  function renderVideos(videos) {
    var grid = document.getElementById("video-grid");
    if (!grid) return;
    grid.innerHTML = (videos.items || [])
      .map(function (item) {
        return (
          '<button class="video-card reveal" type="button" data-video="' + esc(item.key) + '" aria-label="播放视频：' + esc(item.title) + '">' +
            coverHtml(item, true) +
            '<div class="video-info">' +
              '<h3 class="video-title">' + esc(item.title) + "</h3>" +
              '<p class="video-meta">' + esc(item.meta) + "</p>" +
            "</div>" +
          "</button>"
        );
      })
      .join("");
  }

  /* ---------- 渲染：关于我 ---------- */
  function renderAbout(about) {
    document.getElementById("about-tag").textContent = about.tag || "";
    document.getElementById("about-title").textContent = about.title || "";
    document.getElementById("about-text").textContent = about.text || "";

    var avatar = document.getElementById("about-avatar");
    if (about.avatarImage) {
      avatar.innerHTML = '<img src="' + esc(about.avatarImage) + '" alt="头像" loading="lazy">';
      avatar.classList.add("avatar-img");
    } else {
      avatar.textContent = about.avatar || "艾";
      avatar.classList.remove("avatar-img");
    }

    document.getElementById("about-tags").innerHTML = (about.tags || [])
      .map(function (t) { return "<li>" + esc(t) + "</li>"; })
      .join("");

    var contact = document.getElementById("about-contact");
    var c = about.contact || {};
    contact.innerHTML =
      '<a class="btn btn-primary" href="mailto:' + esc(c.email || "hello@example.com") + '">' + esc(c.emailLabel || "联系我") + "</a>" +
      '<a class="btn btn-ghost" href="' + esc(c.socialHref || "#") + '">' + esc(c.socialLabel || "公众号") + "</a>";
  }

  /* ---------- 主渲染入口 ---------- */
  function renderAll() {
    renderSite(CONTENT.site);
    renderHero(CONTENT.hero);
    renderSectionHead("projects", CONTENT.projects);
    renderCards("project-grid", CONTENT.projects.items);
    renderSectionHead("courses", CONTENT.courses);
    renderCourses("course-list", CONTENT.courses.items);
    renderSectionHead("videos", CONTENT.videos);
    renderVideos(CONTENT.videos);
    renderSectionHead("unboxing", CONTENT.unboxing);
    renderCards("unboxing-grid", CONTENT.unboxing.items);
    renderAbout(CONTENT.about);

    // 渲染完成后，为新内容重新挂载滚动显现动画与导航高亮
    observeReveals(document.getElementById("main"));
    bindVideoCards();
    initScrollSpy();
  }

  /* ---------- 加载内容 ---------- */
  function loadContent() {
    fetch("data/content.json", { cache: "no-store" })
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
        showLoadError(err);
      });
  }

  function showLoadError(err) {
    var p = document.createElement("p");
    p.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:#fff;" +
      "padding:12px 16px;text-align:center;font-size:14px;";
    p.textContent = "⚠️ 内容加载失败（data/content.json），当前显示的是备用内容。请检查文件是否已部署。";
    document.body.prepend(p);
    console.error("Content load error:", err);
  }

  /* ============================================================
     以下为页面交互（与内容数据无关）
     ============================================================ */

  /* ---------- 滚动显现动画 ---------- */
  function makeRevealObserver() {
    if (!("IntersectionObserver" in window)) return null;
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealIO.unobserve(entry.target);
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

  /* ---------- 视频播放弹窗 ---------- */
  var modal = document.getElementById("video-modal");
  var modalVideo = document.getElementById("modal-video");
  var lastFocused = null;

  function openModal(key) {
    var conf = VIDEOS[key];
    if (!conf || !conf.src) return;

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

  function bindVideoCards() {
    document.querySelectorAll(".video-card").forEach(function (card) {
      if (card.dataset.bound) return;
      card.dataset.bound = "1";
      card.addEventListener("click", function () {
        openModal(card.getAttribute("data-video"));
      });
    });
  }

  modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  /* ---------- 占位链接（href="#"）拦截：避免页面跳到顶部 ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href="#"]') : null;
    if (a) e.preventDefault();
  });

  /* ---------- 当前区块高亮（桌面端） ---------- */
  function initScrollSpy() {
    var sections = document.querySelectorAll("main section[id]");
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
    if (!sections.length || !("IntersectionObserver" in window)) return;

    if (spyIO) spyIO.disconnect();
    spyIO = new IntersectionObserver(
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
      spyIO.observe(s);
    });
  }

  /* ---------- 启动 ---------- */
  observeReveals(document);
  loadContent();
})();
