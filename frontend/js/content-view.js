(() => {
  const production = "https://aceskills.cn";
  const mirror = "https://aceskills-2026-d4gpqs1bbda809728-1451609693.tcloudbaseapp.com";
  const readApi = "https://aceskills-2026-d4gpqs1bbda809728-1451609693.ap-shanghai.app.tcloudbase.com/site-api/v1/content";
  let readingPrimaryAssets = false;

  async function requestContent(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!data || !data.site || !data.hero) throw new Error("Invalid site content");
    return data;
  }

  async function loadContent(staticUrl) {
    if (location.origin === mirror && !new URLSearchParams(location.search).has("draft")) {
      try {
        const data = await requestContent(readApi, { signal: AbortSignal.timeout(4500) });
        readingPrimaryAssets = true;
        return data;
      } catch (_) {
        // Use the published snapshot when the gateway is unavailable.
      }
    }
    return requestContent(staticUrl, { cache: "no-store" });
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function emailAddress(value) {
    const address = String(value ?? "").trim();
    return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(address) &&
      !/@(?:example\.(?:com|net|org)|[^@]+\.example)$/i.test(address) ? address : "";
  }

  function link(value) {
    const url = String(value ?? "").trim();
    if (!url || url === "#" || /[\u0000-\u0020\u007f\\]/.test(url)) return "";
    if (/^mailto:/i.test(url)) return emailAddress(url.slice(7)) ? url : "";
    try {
      const resolved = new URL(url, document.baseURI);
      return /^(?:https?:)$/.test(resolved.protocol) ? url : "";
    } catch (_) {
      return "";
    }
  }

  function media(value) {
    const url = link(value);
    return url && !/^(?:mailto:|#|\?)/i.test(url) ? url : "";
  }

  function asset(value) {
    const url = media(value);
    if (!url) return "";
    const local = url.replace(/^\.\//, "");
    if (readingPrimaryAssets && /^\/?assets\/uploads\//.test(local)) {
      return new URL(local, production + "/").href;
    }
    if (document.body.hasAttribute("data-page") && /^assets\//.test(local)) return "../" + local;
    return url;
  }

  function action(value, caption, className = "", fallback = "链接待补") {
    const href = link(value);
    return href
      ? '<a class="' + escape(className) + '" href="' + escape(href) + '">' + escape(caption) + '</a>'
      : '<span class="content-pending">' + escape(fallback) + '</span>';
  }

  function cardTitle(item) {
    const href = link(item.link);
    return href ? action(href, item.title) : escape(item.title);
  }

  function socialLinks(links) {
    return (links || []).map((item) =>
      "<li>" + action(item.url, item.label, "", item.label + "待补") + "</li>"
    ).join("");
  }

  function contactDetails(contact) {
    const address = emailAddress(contact.email);
    return action(address && "mailto:" + address, contact.emailLabel || "联系我", "btn btn-primary", "联系邮箱待补") +
      action(contact.socialHref, contact.socialLabel || "公众号", "btn btn-ghost", (contact.socialLabel || "公众号") + "链接待补");
  }

  const demoFiles = new Set(["BigBuckBunny.mp4", "ElephantsDream.mp4", "ForBiggerBlazes.mp4", "ForBiggerEscapes.mp4"]);

  function videoSource(sources, item) {
    if (!item) return null;
    const saved = Object.hasOwn(sources, item.key) ? sources[item.key] : null;
    const record = saved?.src ? saved : { src: item.src, type: item.srcType };
    const src = asset(record.src);
    if (!src) return null;

    const parsed = new URL(src, document.baseURI);
    const prefix = "/gtv-videos-bucket/sample/";
    const example = (parsed.hostname === "commondatastorage.googleapis.com" || parsed.hostname === "storage.googleapis.com") &&
      parsed.pathname.startsWith(prefix) && demoFiles.has(parsed.pathname.slice(prefix.length));
    return { src, type: record.type, example };
  }

  function coverHtml(item, isVideo) {
    const base = isVideo ? "video-cover" : "card-cover";
    const image = asset(item.image);
    if (image) {
      return '<div class="' + base + ' cover-img" aria-hidden="true">' +
        '<img src="' + escape(image) + '" alt="" loading="lazy" decoding="async"></div>';
    }
    const mark = isVideo
      ? '<span class="video-play">▶</span>'
      : '<span class="card-emoji">' + escape(item.emoji || "📦") + '</span>';
    const cover = item.cover || (isVideo ? "cover-v1" : "cover-1");
    return '<div class="' + base + ' ' + escape(cover) + '" aria-hidden="true">' + mark + '</div>';
  }

  function cards(items) {
    return (items || []).map((item) => (
      '<article class="card reveal">' +
        coverHtml(item, false) +
        '<div class="card-body">' +
          '<span class="card-cat">' + escape(item.category) + '</span>' +
          '<h3 class="card-title">' + cardTitle(item) + '</h3>' +
          '<p class="card-text">' + escape(item.text) + '</p>' +
          '<span class="card-meta">' + escape(item.meta) + '</span>' +
          (link(item.link) ? '' : '<span class="content-pending">链接待补</span>') +
        '</div>' +
      '</article>'
    )).join("");
  }

  function courses(items) {
    return (items || []).map((item) => (
      '<article class="course reveal">' +
        '<div class="course-icon" aria-hidden="true">' + escape(item.icon || "📚") + '</div>' +
        '<div class="course-info">' +
          '<h3 class="course-title">' + escape(item.title) + '</h3>' +
          '<p class="course-text">' + escape(item.text) + '</p>' +
        '</div>' +
        '<div class="course-meta">' +
          '<span class="course-tag course-tag-' + escape(item.statusClass || "soon") + '">' + escape(item.status) + '</span>' +
          action(item.link, "了解详情", "btn btn-small btn-ghost") +
        '</div>' +
      '</article>'
    )).join("");
  }

  function videoCards(items, sources) {
    return (items || []).map((item) => {
      const source = videoSource(sources, item);
      const tag = source?.example ? "示例视频" : item.tag;
      const badge = tag ? ' data-tag="' + escape(tag) + '"' : "";
      const caption = '<div class="video-info">' +
        '<h3 class="video-title">' + escape(item.title) + '</h3>' +
        '<p class="video-meta">' + escape(item.meta) + '</p>' +
        (source ? "" : '<span class="content-pending">视频待补</span>') + '</div>';
      const inner = coverHtml(item, Boolean(source)) + caption;
      if (!source) return '<article class="video-card reveal"' + badge + '>' + inner + '</article>';

      return '<button class="video-card reveal" type="button" data-video="' + escape(item.key) + '"' +
        badge + ' aria-label="' + (source.example ? "播放示例视频 " : "播放视频 ") +
        escape(item.title) + '">' + inner + '</button>';
    }).join("");
  }

  function bindVideoDialog(getSource) {
    const dialog = document.getElementById("video-modal");
    if (!dialog) return;
    const mediaContainer = document.getElementById("modal-video");
    const notice = document.getElementById("video-notice");
    let trigger = null;

    document.addEventListener("click", (event) => {
      const card = event.target.closest("button[data-video]");
      if (!card || dialog.open) return;
      const source = getSource(card.dataset.video);
      if (!source) return;

      const element = document.createElement(source.type === "video" ? "video" : "iframe");
      element.src = source.src;
      if (element.tagName === "VIDEO") {
        element.controls = true;
        element.autoplay = true;
        element.playsInline = true;
        element.preload = "metadata";
        element.addEventListener("error", () => {
          notice.textContent = "视频暂时无法加载。";
          notice.hidden = false;
        });
      } else {
        element.title = source.example ? "示例视频" : "视频播放";
        element.allow = "autoplay; encrypted-media; picture-in-picture";
        element.allowFullscreen = true;
      }

      trigger = card;
      notice.textContent = source.example ? "当前播放为示例素材。" : "";
      notice.hidden = !source.example;
      mediaContainer.replaceChildren(element);
      dialog.showModal();
      document.body.classList.add("video-open");
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-modal-close]")) dialog.close();
    });

    dialog.addEventListener("close", () => {
      mediaContainer.replaceChildren();
      document.body.classList.remove("video-open");
      trigger?.focus();
      trigger = null;
    });
  }

  function bindMobileNav() {
    const button = document.getElementById("nav-toggle");
    const menu = document.getElementById("nav-menu");
    if (!button || !menu) return;

    function setOpen(open) {
      menu.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    }

    button.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
    menu.addEventListener("click", (event) => {
      if (event.target.closest(".nav-link")) setOpen(false);
    });
    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !menu.classList.contains("open")) return;
      setOpen(false);
      button.focus();
    });
  }

  window.SiteViews = { loadContent, escape, link, asset, socialLinks, contactDetails, videoSource, cards, courses, videoCards, bindVideoDialog, bindMobileNav };
})();
