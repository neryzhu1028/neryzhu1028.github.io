/* ============================================================
   艾思力个人网页 · 子页面通用渲染脚本
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

  var views = window.SiteViews;
  var esc = views.escape;

  /* ---------- 渲染：站点信息（品牌 / 页脚） ---------- */
  function renderSite(site) {
    var title = CONTENT[PAGE]?.title || PAGE_CONF[PAGE]?.crumb;
    document.title = [title, site.brandName].filter(Boolean).join(" · ") || document.title;

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
    if (links) links.innerHTML = views.socialLinks(site.socialLinks);
  }

  /* ---------- 渲染：子页头部 ---------- */
  function renderPageHero(mod) {
    var title = document.getElementById("page-title");
    var tag = document.getElementById("page-tag");
    var description = document.getElementById("page-desc");
    if (tag && mod.tag) tag.textContent = mod.tag;
    if (title && mod.title) title.textContent = mod.title;
    if (description && mod.desc) description.textContent = mod.desc;

    var count = document.getElementById("page-count");
    var items = mod.items || [];
    if (count) count.textContent = "共 " + items.length + " 项内容";
  }

  function renderProjectPage(mod) {
    document.getElementById("page-grid").innerHTML = views.cards(mod.items);
  }

  function renderCoursePage(mod) {
    document.getElementById("page-list").innerHTML = views.courses(mod.items);
  }

  function renderVideoPage(mod) {
    document.getElementById("page-grid").innerHTML = views.videoCards(mod.items, VIDEOS);
  }

  function renderUnboxingPage(mod) {
    renderProjectPage(mod);
  }

  /* ---------- 关于我页：故事 + 时间线 + 价值观 + CTA ---------- */
  function renderAboutPage(mod) {
    // 头像
    var avatar = document.getElementById("about-avatar");
    if (avatar) {
      if (views.asset(mod.avatarImage)) {
        avatar.innerHTML = '<img src="' + esc(views.asset(mod.avatarImage)) + '" alt="艾思力的头像" loading="lazy">';
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
      actions.innerHTML = views.contactDetails(c);
    }
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
    views.loadContent("../data/content.json")
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
  views.bindMobileNav();
  views.bindVideoDialog(function (key) {
    var item = (CONTENT?.videos?.items || []).find(function (record) { return record.key === key; });
    return views.videoSource(VIDEOS, item);
  });
  loadContent();
})();
