/* ============================================================
 * 艾斯利个人网页 · 内容管理后台 — 应用层 (app.js)
 * 职责：登录流程、面板路由、7 个编辑器 + 指南、
 *       图片压缩上传、草稿与实时预览、保存发布链路
 * 依赖：core.js（window.CMS）
 * ============================================================ */
(function () {
  "use strict";

  var CMS = window.CMS;
  var esc = CMS.esc;
  var deepClone = CMS.deepClone;
  var toast = CMS.toast;

  var DRAFT_KEY = "as_cms_draft"; // 与 js/main.js、js/pages.js 约定一致

  /* ================= 全局状态 ================= */
  var STATE = {
    data: null,      // 内存中的 content.json 对象
    sha: "",         // 线上 data/content.json 的 sha（乐观锁）
    dirty: false,    // 是否有未保存修改
    panel: "site",
    cfg: CMS.getConfig()
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ================= 路径工具 ================= */
  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, obj);
  }
  function setPath(obj, path, val) {
    var keys = path.split(".");
    var last = keys.pop();
    var o = obj;
    keys.forEach(function (k) {
      if (o[k] == null) o[k] = {};
      o = o[k];
    });
    o[last] = val;
  }

  /* ================= 草稿（实时预览数据源） ================= */
  var draftTimer = null;
  function markDirty() {
    STATE.dirty = true;
    $("dirty-badge").classList.remove("hidden");
    scheduleDraft();
  }
  function clearDirty() {
    STATE.dirty = false;
    $("dirty-badge").classList.add("hidden");
  }
  function scheduleDraft() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 500);
  }
  function writeDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        _draftSavedAt: Date.now(),
        data: STATE.data
      }));
    } catch (e) {}
    refreshPreview();
  }
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    refreshPreview();
  }

  /* ================= 登录流程 ================= */
  function showLogin() {
    $("login-view").classList.remove("hidden");
    $("app-view").classList.add("hidden");
  }
  function showApp() {
    $("login-view").classList.add("hidden");
    $("app-view").classList.remove("hidden");
    $("conn-text").textContent =
      STATE.cfg.owner + "/" + STATE.cfg.repo + " · " + STATE.cfg.branch;
  }

  function setLoginStatus(msg, cls) {
    var el = $("login-status");
    el.innerHTML = msg;
    el.className = "login-status" + (cls ? " " + cls : "");
  }

  async function doLogin(token, sessionOnly, quiet) {
    var btn = $("login-btn");
    btn.disabled = true;
    btn.classList.add("loading");
    if (!quiet) setLoginStatus("正在验证令牌与仓库权限…", "busy");
    try {
      var cfg = CMS.getConfig();
      await CMS.verifyRepo(cfg, token);              // 1. 仓库存在 + push 权限
      if (!quiet) setLoginStatus("权限正常，正在拉取网站内容…", "busy");
      var loaded = await CMS.loadContent(cfg, token); // 2. 读取 data/content.json
      CMS.setToken(token, sessionOnly);
      STATE.data = loaded.data;
      STATE.sha = loaded.sha;
      clearDirty();
      showApp();
      switchPanel(STATE.panel);
      restorePreviewState();
      if (!quiet) toast("✅ 登录成功，已加载线上内容", "ok");
      return true;
    } catch (e) {
      var msg = esc(e.message || String(e));
      if (e.status === 404) msg = "仓库不存在或令牌无权访问（请确认仓库名与令牌权限）";
      setLoginStatus("❌ 登录失败：" + msg, "err");
      if (quiet) toast("自动登录失败，请重新输入令牌", "err");
      return false;
    } finally {
      btn.disabled = false;
      btn.classList.remove("loading");
    }
  }

  function handleAuthError(e) {
    if (e && e.auth) {
      CMS.clearToken();
      showLogin();
      setLoginStatus("❌ " + esc(e.message), "err");
      return true;
    }
    return false;
  }

  /* ================= 保存发布链路 ================= */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // 保存前基础校验，返回错误信息或 ""
  function validateData(d) {
    var lists = ["projects.items", "unboxing.items", "videos.items"];
    for (var i = 0; i < lists.length; i++) {
      var arr = getPath(d, lists[i]) || [];
      for (var j = 0; j < arr.length; j++) {
        if (!String(arr[j].title || "").trim()) {
          return "「" + lists[i].split(".")[0] + "」第 " + (j + 1) + " 项缺少标题，请补充后再保存";
        }
      }
    }
    var keys = (d.videos.items || []).map(function (it) { return it.key; });
    var seen = {};
    for (var k = 0; k < keys.length; k++) {
      if (!keys[k]) return "视频列表存在空 key，请检查";
      if (seen[keys[k]]) return "视频 key 重复：" + keys[k];
      seen[keys[k]] = true;
    }
    return "";
  }

  async function saveAll(forceSha) {
    if (!STATE.data) { toast("内容尚未加载", "err"); return; }
    var err = validateData(STATE.data);
    if (err) { toast(err, "err", 4000); return; }

    var btn = $("btn-save");
    btn.disabled = true;
    btn.classList.add("loading");
    btn.innerHTML = "⏳ 保存中…";
    try {
      var message = "content: 更新站点内容（" + nowStamp() + "，来自管理后台）";
      var res = await CMS.saveContent(STATE.data, forceSha || STATE.sha, message, STATE.cfg, CMS.getToken());
      // 成功
      STATE.sha = (res.content && res.content.sha) || STATE.sha;
      clearDirty();
      clearDraft();
      toast('✅ 已保存并发布！网站将在 1~3 分钟内更新 · <a href="../index.html?t=' + Date.now() + '" target="_blank">打开网站首页</a>', "ok", 6000);
      refreshPreview();
    } catch (e) {
      if (handleAuthError(e)) return;
      if (e.status === 409) {
        showConflictModal();
      } else {
        toast("❌ 保存失败：" + esc(e.message), "err", 5000);
      }
    } finally {
      btn.disabled = false;
      btn.classList.remove("loading");
      btn.innerHTML = "💾 保存并发布";
    }
  }

  /* ---- 409 冲突弹窗 ---- */
  function showConflictModal() { $("conflict-modal").classList.remove("hidden"); }
  function hideConflictModal() { $("conflict-modal").classList.add("hidden"); }

  async function conflictOverwrite() {
    hideConflictModal();
    try {
      var latest = await CMS.getContent(STATE.cfg.dataPath, STATE.cfg, CMS.getToken());
      await saveAll(latest.sha); // 用最新 sha 重放保存
    } catch (e) {
      if (!handleAuthError(e)) toast("覆盖保存失败：" + esc(e.message), "err");
    }
  }
  async function conflictReload() {
    hideConflictModal();
    try {
      var loaded = await CMS.loadContent(STATE.cfg, CMS.getToken());
      STATE.data = loaded.data;
      STATE.sha = loaded.sha;
      clearDirty();
      clearDraft();
      switchPanel(STATE.panel);
      toast("已载入线上最新版本（你的修改已丢弃）", "ok");
    } catch (e) {
      if (!handleAuthError(e)) toast("载入失败：" + esc(e.message), "err");
    }
  }
  function conflictDownload() {
    hideConflictModal();
    var blob = new Blob([JSON.stringify(STATE.data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content-mine-" + Date.now() + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast("已下载你编辑的版本，可稍后人工合并", "ok");
  }

  /* ================= 重新加载 ================= */
  async function reloadContent() {
    if (STATE.dirty && !confirm("当前有未保存的修改，重新加载将丢弃它们。确定继续？")) return;
    try {
      var loaded = await CMS.loadContent(STATE.cfg, CMS.getToken());
      STATE.data = loaded.data;
      STATE.sha = loaded.sha;
      clearDirty();
      clearDraft();
      switchPanel(STATE.panel);
      toast("🔄 已重新加载线上最新内容", "ok");
    } catch (e) {
      if (!handleAuthError(e)) toast("加载失败：" + esc(e.message), "err");
    }
  }

  /* ================= 通用表单字段工厂 ================= */
  function field(opts) {
    opts = opts || {};
    var type = opts.type || "text";
    var d = document.createElement("div");
    d.className = "field";
    var labelHtml = opts.label
      ? "<label>" + esc(opts.label) +
        (opts.req ? " <span class='req'>*</span>" : "") +
        (opts.opt ? " <span class='opt'>" + esc(opts.opt) + "</span>" : "") +
        "</label>"
      : "";
    var inputHtml;
    if (type === "textarea") {
      inputHtml = "<textarea " + (opts.rows ? "rows='" + opts.rows + "'" : "") +
        " data-path='" + esc(opts.path) + "' placeholder='" + esc(opts.placeholder || "") + "'></textarea>";
    } else if (type === "select") {
      inputHtml = "<select data-path='" + esc(opts.path) + "'>" +
        (opts.options || []).map(function (o) {
          return "<option value='" + esc(o.v) + "'>" + esc(o.t) + "</option>";
        }).join("") + "</select>";
    } else {
      inputHtml = "<input type='" + esc(type) + "' data-path='" + esc(opts.path) +
        "' placeholder='" + esc(opts.placeholder || "") + "'>";
    }
    d.innerHTML = labelHtml + inputHtml;
    if (opts.hint) d.insertAdjacentHTML("beforeend", "<p class='spec'>" + esc(opts.hint) + "</p>");
    return d;
  }

  // 双向绑定：读取 CONTENT 值填充控件，输入时写回 + 标脏
  function bindForm(scope) {
    scope.querySelectorAll("[data-path]").forEach(function (el) {
      var v = getPath(STATE.data, el.dataset.path);
      el.value = v == null ? "" : v;
      el.addEventListener("input", function () {
        setPath(STATE.data, el.dataset.path, el.value);
        markDirty();
      });
    });
  }

  /* ================= 列表项编辑器（增删 + 上移/下移排序） ================= */
  function listEditor(opts) {
    var wrap = document.createElement("div");
    wrap.className = "list-editor";

    function renderList() {
      wrap.innerHTML = "";
      var items = getPath(STATE.data, opts.itemsPath) || [];
      items.forEach(function (item, i) {
        var box = document.createElement("div");
        box.className = "item";
        var head = document.createElement("div");
        head.className = "item-head";
        head.innerHTML = '<span class="idx">#' + (i + 1) + '</span><span class="ttl">' +
          esc(opts.titleOf(item)) + "</span>";
        var actions = document.createElement("span");
        actions.className = "item-actions";
        actions.innerHTML =
          '<button class="btn sm" type="button" data-act="up" title="上移">↑</button>' +
          '<button class="btn sm" type="button" data-act="down" title="下移">↓</button>' +
          '<button class="btn sm danger" type="button" data-act="del">删除</button>';
        head.appendChild(actions);
        box.appendChild(head);

        var body = document.createElement("div");
        opts.renderItem(body, item, opts.itemsPath + "." + i);
        box.appendChild(body);
        wrap.appendChild(box);

        actions.querySelector('[data-act="up"]').addEventListener("click", function () {
          if (i === 0) return;
          var arr = getPath(STATE.data, opts.itemsPath);
          var t = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = t;
          markDirty(); renderList();
        });
        actions.querySelector('[data-act="down"]').addEventListener("click", function () {
          var arr = getPath(STATE.data, opts.itemsPath);
          if (i >= arr.length - 1) return;
          var t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t;
          markDirty(); renderList();
        });
        actions.querySelector('[data-act="del"]').addEventListener("click", function () {
          var tip = opts.deleteConfirm ? opts.deleteConfirm(item) : "确定删除该项？删除后需点「保存并发布」才会生效。";
          if (!confirm(tip)) return;
          var arr = getPath(STATE.data, opts.itemsPath);
          arr.splice(i, 1);
          if (opts.onDelete) opts.onDelete(item);
          markDirty(); renderList();
        });
      });

      if (!items.length && opts.emptyHint) {
        var e = document.createElement("p");
        e.className = "spec";
        e.style.padding = "8px 2px";
        e.textContent = opts.emptyHint;
        wrap.appendChild(e);
      }

      var add = document.createElement("button");
      add.className = "add-btn";
      add.textContent = "＋ " + (opts.addText || "添加一项");
      add.addEventListener("click", function () {
        var arr = getPath(STATE.data, opts.itemsPath);
        var tpl = typeof opts.addDefaults === "function" ? opts.addDefaults() : deepClone(opts.addDefaults);
        arr.push(tpl);
        if (opts.onAdd) opts.onAdd(tpl);
        markDirty(); renderList();
        // 滚动定位到新项
        var items2 = wrap.querySelectorAll(".item");
        if (items2.length) items2[items2.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
      });
      wrap.appendChild(add);
    }

    renderList();
    return wrap;
  }

  /* ================= 封面渐变选择器 ================= */
  function coverPicker(currentCover, covers, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "cover-picker";
    covers.forEach(function (c) {
      var s = document.createElement("span");
      s.className = "cover-swatch swatch-" + c + (c === currentCover ? " selected" : "");
      s.dataset.cover = c;
      s.title = c;
      s.addEventListener("click", function () {
        wrap.querySelectorAll(".cover-swatch").forEach(function (el) {
          el.classList.toggle("selected", el.dataset.cover === c);
        });
        onChange(c);
        markDirty();
      });
      wrap.appendChild(s);
    });
    return wrap;
  }

  /* ================= 图片压缩与上传 ================= */
  function compressImage(file, maxLongSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxLongSide / Math.max(w, h));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        var done = function (blob, type) {
          if (blob) resolve({ blob: blob, type: type });
          else reject(new Error("图片压缩失败"));
        };
        canvas.toBlob(function (b) {
          if (b && b.size > 0) done(b, "webp");
          else canvas.toBlob(function (b2) { done(b2, "jpeg"); }, "image/jpeg", quality);
        }, "image/webp", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("图片无法读取")); };
      img.src = url;
    });
  }

  function makeFileName(prefix, ext) {
    var d = new Date();
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    var rand = Math.random().toString(36).slice(2, 6);
    return prefix + "-" + stamp + "-" + rand + "." + ext;
  }

  // 串行上传队列，避免触发 secondary rate limit
  var uploadQueue = Promise.resolve();
  function enqueueUpload(task) {
    uploadQueue = uploadQueue.then(task).catch(function (e) {
      toast("❌ 上传失败：" + esc(e.message || String(e)), "err", 5000);
    }).then(function () {
      return new Promise(function (r) { setTimeout(r, 300); });
    });
    return uploadQueue;
  }

  function makeUploader(dataPath, opts) {
    opts = opts || {};
    var maxLong = opts.maxLong || 1600;
    var quality = opts.quality == null ? 0.85 : opts.quality;
    var prefix = opts.prefix || "img";

    var uid = "up" + Math.floor(Math.random() * 1e9);
    var wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML =
      "<label>" + esc(opts.label || "封面图") + " <span class='opt'>（可选，不上传则用渐变封面）</span></label>" +
      '<div class="upload-row">' +
        '<span class="thumb" data-r="thumb">' + esc(opts.emoji || "🖼️") + "</span>" +
        '<input type="file" accept=".jpg,.jpeg,.png,.webp" data-r="file">' +
        '<span class="path" data-r="path"></span>' +
        '<button class="btn sm" type="button" data-r="clear">移除图片</button>' +
      "</div>" +
      '<p class="spec">JPG / PNG / WebP，自动压缩为 WebP（长边 ' + maxLong +
      'px）。上传后立即提交到仓库，需点「保存并发布」后才在网站上引用显示。</p>';

    var thumb = wrap.querySelector('[data-r="thumb"]');
    var fileInput = wrap.querySelector('[data-r="file"]');
    var pathEl = wrap.querySelector('[data-r="path"]');

    function refresh() {
      var v = getPath(STATE.data, dataPath) || "";
      pathEl.textContent = v || "（未上传，使用默认渐变封面）";
      thumb.innerHTML = v ? '<img src="' + esc(v) + '" alt="">' : esc(opts.emoji || "🖼️");
    }

    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (!/image\/(jpeg|png|webp)/.test(file.type)) {
        toast("仅支持 JPG / PNG / WebP 格式", "err");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast("图片超过 10MB，请先压缩", "err");
        return;
      }
      pathEl.textContent = "压缩中…";
      compressImage(file, maxLong, quality).then(function (out) {
        var ext = out.type === "webp" ? "webp" : "jpg";
        var fileName = makeFileName(prefix, ext);
        pathEl.textContent = "上传中：" + fileName + "…";
        return enqueueUpload(function () {
          return CMS.fileExists(STATE.cfg.uploadsDir + "/" + fileName, STATE.cfg, CMS.getToken())
            .then(function (exists) {
              if (exists) fileName = makeFileName(prefix, ext); // 极小概率重名，重新生成
              return CMS.uploadImage(fileName, out.blob, "upload: " + fileName, STATE.cfg, CMS.getToken());
            })
            .then(function () {
              setPath(STATE.data, dataPath, "/" + STATE.cfg.uploadsDir + "/" + fileName);
              markDirty();
              refresh();
              toast("✅ 图片已上传：" + fileName + "，记得点「保存并发布」", "ok", 4000);
            });
        });
      }).catch(function (e) {
        if (!handleAuthError(e)) toast("图片处理失败：" + esc(e.message || String(e)), "err");
        refresh();
      });
    });

    wrap.querySelector('[data-r="clear"]').addEventListener("click", function () {
      setPath(STATE.data, dataPath, "");
      markDirty();
      refresh();
    });

    refresh();
    return wrap;
  }

  /* ================= 字符串数组字段（一行一项） ================= */
  function stringArrayField(label, path, hint) {
    var d = document.createElement("div");
    d.className = "field";
    d.innerHTML = "<label>" + esc(label) + "</label>";
    var ta = document.createElement("textarea");
    ta.rows = 3;
    ta.value = (getPath(STATE.data, path) || []).join("\n");
    ta.placeholder = "一行一项";
    ta.addEventListener("input", function () {
      var arr = ta.value.split("\n").map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
      setPath(STATE.data, path, arr);
      markDirty();
    });
    d.appendChild(ta);
    if (hint) d.insertAdjacentHTML("beforeend", "<p class='spec'>" + esc(hint) + "</p>");
    return d;
  }

  /* ================= 面板区块工厂 ================= */
  function panelSection(title, hint) {
    var p = document.createElement("div");
    p.className = "panel";
    p.innerHTML = "<h2>" + esc(title) + "</h2>" + (hint ? "<p class='hint'>" + esc(hint) + "</p>" : "");
    return p;
  }
  function moduleHeaderFields(key, hasMore) {
    var frag = document.createDocumentFragment();
    var r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "模块标签", opt: "英文小标", path: key + ".tag" }));
    r.appendChild(field({ label: "模块标题", path: key + ".title" }));
    frag.appendChild(r);
    frag.appendChild(field({ label: "模块描述", type: "textarea", rows: 2, path: key + ".desc" }));
    if (hasMore) {
      var r2 = document.createElement("div");
      r2.className = "row";
      r2.appendChild(field({ label: "「查看全部」文字", path: key + ".moreText" }));
      r2.appendChild(field({ label: "「查看全部」链接", path: key + ".moreHref" }));
      frag.appendChild(r2);
    }
    return frag;
  }

  /* ================= 各面板渲染 ================= */

  function renderPanelSite() {
    var main = $("main");
    main.innerHTML = "";

    var p1 = panelSection("🌐 站点信息", "品牌、浏览器标题、SEO 描述与页脚文案，显示在导航、标签页与页脚。");
    var r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "品牌 Logo 字", opt: "1 个字", path: "site.brandMark" }));
    r.appendChild(field({ label: "品牌名称", path: "site.brandName" }));
    r.appendChild(field({ label: "品牌标语", opt: "导航副标", path: "site.brandTagline" }));
    r.appendChild(field({ label: "作者", path: "site.author" }));
    p1.appendChild(r);
    p1.appendChild(field({ label: "浏览器标题", opt: "显示在标签页", path: "site.pageTitle" }));
    p1.appendChild(field({ label: "站点描述", opt: "SEO 关键词", path: "site.description" }));
    p1.appendChild(field({ label: "分享描述", opt: "微信/头条分享卡片显示", path: "site.ogDescription" }));
    p1.appendChild(field({ label: "页脚主文字", path: "site.footerText" }));
    r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "页脚标语", path: "site.footerTag" }));
    r.appendChild(field({ label: "页脚底行", path: "site.footerBottom" }));
    p1.appendChild(r);
    bindForm(p1);
    main.appendChild(p1);

    var p2 = panelSection("🔗 页脚社交链接", "链接文字与地址，按顺序显示在页脚。地址填 # 表示暂不跳转。");
    p2.appendChild(listEditor({
      itemsPath: "site.socialLinks",
      titleOf: function (it) { return it.label || "（未命名）"; },
      addText: "添加社交链接",
      addDefaults: { label: "新链接", url: "#" },
      renderItem: function (body, item, path) {
        var sc = document.createElement("div");
        sc.className = "row";
        sc.appendChild(field({ label: "名称", path: path + ".label" }));
        sc.appendChild(field({ label: "地址", type: "url", path: path + ".url" }));
        body.appendChild(sc);
        bindForm(body);
      }
    }));
    main.appendChild(p2);
  }

  function renderPanelHero() {
    var main = $("main");
    main.innerHTML = "";
    var p = panelSection("🏠 Hero 首屏", "首页第一屏：大标题、简介、按钮与数据统计。注：三轴定位条与手写签名为页面固定内容，不在此处管理。");
    p.appendChild(field({ label: "顶部小标签", opt: "备用字段，当前页面暂未展示", path: "hero.eyebrow" }));
    var r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "大标题前缀", path: "hero.titlePrefix" }));
    r.appendChild(field({ label: "高亮名字", path: "hero.titleHighlight" }));
    p.appendChild(r);
    p.appendChild(field({ label: "副标题简介", type: "textarea", rows: 3, path: "hero.subtitle" }));
    r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "主按钮文字", path: "hero.primaryBtn.text" }));
    r.appendChild(field({ label: "主按钮跳转", path: "hero.primaryBtn.href", placeholder: "如 #projects" }));
    r.appendChild(field({ label: "副按钮文字", path: "hero.ghostBtn.text" }));
    r.appendChild(field({ label: "副按钮跳转", path: "hero.ghostBtn.href", placeholder: "如 #videos" }));
    p.appendChild(r);
    bindForm(p);
    main.appendChild(p);

    var p2 = panelSection("📊 数据统计", "首页首屏的数字统计条，建议 3~4 项。");
    p2.appendChild(listEditor({
      itemsPath: "hero.stats",
      titleOf: function (it) { return (it.num || "") + " " + (it.label || ""); },
      addText: "添加统计项",
      addDefaults: { num: "10+", label: "新内容" },
      renderItem: function (body, item, path) {
        var sc = document.createElement("div");
        sc.className = "row";
        sc.appendChild(field({ label: "数字", path: path + ".num" }));
        sc.appendChild(field({ label: "说明", path: path + ".label" }));
        body.appendChild(sc);
        bindForm(body);
      }
    }));
    main.appendChild(p2);
  }

  var CARD_COVERS = ["cover-1", "cover-2", "cover-3", "cover-4", "cover-5", "cover-6"];
  var VIDEO_COVERS = ["cover-v1", "cover-v2", "cover-v3", "cover-v4"];

  function cardItemFields(body, item, path) {
    body.appendChild(makeUploader(path + ".image", {
      label: "封面图", emoji: item.emoji || "🖼️", prefix: "cover"
    }));

    var cvField = document.createElement("div");
    cvField.className = "field";
    cvField.innerHTML = "<label>渐变封面 <span class='opt'>（未上传封面图时显示）</span></label>";
    cvField.appendChild(coverPicker(item.cover || "cover-1", CARD_COVERS, function (c) {
      setPath(STATE.data, path + ".cover", c);
    }));
    body.appendChild(cvField);

    var r3 = document.createElement("div");
    r3.className = "row3";
    r3.appendChild(field({ label: "图标 emoji", path: path + ".emoji", placeholder: "如 🌏" }));
    r3.appendChild(field({ label: "分类标签", path: path + ".category" }));
    r3.appendChild(field({ label: "底部标注", path: path + ".meta", placeholder: "如 2026-08 · 深度长文" }));
    body.appendChild(r3);
    body.appendChild(field({ label: "标题", req: true, path: path + ".title" }));
    body.appendChild(field({ label: "跳转链接", path: path + ".link", placeholder: "# 或 https://…" }));
    body.appendChild(field({ label: "简介", type: "textarea", rows: 2, path: path + ".text" }));
    bindForm(body);
  }

  function renderPanelCards(key, title, hint) {
    var main = $("main");
    main.innerHTML = "";
    var p = panelSection(title, hint);
    p.appendChild(moduleHeaderFields(key, true));
    bindForm(p);
    main.appendChild(p);

    var p2 = panelSection("🗂 卡片列表", "支持添加、删除、↑↓ 排序。改动后点右上「保存并发布」生效。");
    p2.appendChild(listEditor({
      itemsPath: key + ".items",
      titleOf: function (it) { return it.title || "（未命名）"; },
      addText: "添加一张卡片",
      addDefaults: {
        cover: "cover-1", image: "", emoji: "📌", category: "新分类",
        title: "新卡片标题", link: "#", text: "卡片简介……", meta: nowStamp().slice(0, 7)
      },
      renderItem: cardItemFields
    }));
    main.appendChild(p2);
  }

  function renderPanelCourses() {
    var main = $("main");
    main.innerHTML = "";
    var p = panelSection("📚 课程", "课程列表：图标、名称、简介、状态与详情链接。");
    p.appendChild(moduleHeaderFields("courses", false));
    bindForm(p);
    main.appendChild(p);

    var p2 = panelSection("🗂 课程列表", "支持添加、删除、↑↓ 排序。");
    p2.appendChild(listEditor({
      itemsPath: "courses.items",
      titleOf: function (it) { return it.title || "（未命名）"; },
      addText: "添加一门课程",
      addDefaults: { icon: "📘", title: "新课标题", text: "课程简介……", status: "规划中", statusClass: "planning", link: "#" },
      renderItem: function (body, item, path) {
        var r = document.createElement("div");
        r.className = "row3";
        r.appendChild(field({ label: "图标 emoji", path: path + ".icon", placeholder: "如 📖" }));
        r.appendChild(field({ label: "状态文字", path: path + ".status", placeholder: "如 即将上线" }));
        r.appendChild(field({
          label: "状态样式", type: "select",
          options: [
            { v: "soon", t: "即将上线（蓝）" },
            { v: "recording", t: "录制中（绿）" },
            { v: "planning", t: "规划中（灰）" }
          ],
          path: path + ".statusClass"
        }));
        body.appendChild(r);
        body.appendChild(field({ label: "课程名称", req: true, path: path + ".title" }));
        body.appendChild(field({ label: "课程简介", type: "textarea", rows: 2, path: path + ".text" }));
        body.appendChild(field({ label: "详情链接", path: path + ".link", placeholder: "# 或 https://…" }));
        bindForm(body);
      }
    }));
    main.appendChild(p2);
  }

  /* ---- videos：items 与 sources 合并编辑 ---- */
  function nextVideoKey() {
    var max = 0;
    (STATE.data.videos.items || []).forEach(function (it) {
      var m = /^video-(\d+)$/.exec(it.key || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return "video-" + (max + 1);
  }
  function videoKeyExists(key, exceptIndex) {
    var items = STATE.data.videos.items || [];
    for (var i = 0; i < items.length; i++) {
      if (i !== exceptIndex && items[i].key === key) return true;
    }
    return false;
  }

  function renderPanelVideos() {
    var main = $("main");
    main.innerHTML = "";
    var p = panelSection("🎬 旅拍视频", "视频卡片 + 播放地址一体编辑：新增自动分配 key，删除自动清理播放源。");
    p.appendChild(moduleHeaderFields("videos", true));
    bindForm(p);
    main.appendChild(p);

    var p2 = panelSection("🗂 视频列表", "播放地址二选一：B站/腾讯视频嵌入链接（推荐）或 mp4 直链。");
    p2.appendChild(listEditor({
      itemsPath: "videos.items",
      titleOf: function (it) { return (it.tag ? "[" + it.tag + "] " : "") + (it.title || "（未命名）"); },
      addText: "添加一个视频",
      addDefaults: function () {
        var key = nextVideoKey();
        STATE.data.videos.sources[key] = { src: "", type: "iframe" };
        return { key: key, cover: "cover-v1", image: "", title: "新视频", meta: "地点 · 拍摄方式", tag: "" };
      },
      deleteConfirm: function (item) {
        return "确定删除视频「" + (item.title || item.key) + "」？\n将同时删除它的播放源，保存后生效。";
      },
      onDelete: function (item) {
        if (STATE.data.videos.sources) delete STATE.data.videos.sources[item.key];
      },
      renderItem: function (body, item, path) {
        var idx = parseInt(path.split(".").pop(), 10);

        body.appendChild(makeUploader(path + ".image", {
          label: "视频封面图", emoji: "🎬", prefix: "cover"
        }));

        var cvField = document.createElement("div");
        cvField.className = "field";
        cvField.innerHTML = "<label>渐变封面 <span class='opt'>（未上传封面图时显示）</span></label>";
        cvField.appendChild(coverPicker(item.cover || "cover-v1", VIDEO_COVERS, function (c) {
          setPath(STATE.data, path + ".cover", c);
        }));
        body.appendChild(cvField);

        var r3 = document.createElement("div");
        r3.className = "row3";
        r3.appendChild(field({ label: "视频标题", req: true, path: path + ".title" }));
        r3.appendChild(field({ label: "副标注", path: path + ".meta", placeholder: "如 21 天 · 4200 公里" }));
        r3.appendChild(field({ label: "集数标签", path: path + ".tag", placeholder: "如 EP.05" }));
        body.appendChild(r3);

        // key（高级）
        var keyField = document.createElement("div");
        keyField.className = "field";
        keyField.innerHTML = "<label>视频 key <span class='opt'>（唯一标识，一般不用改）</span></label>";
        var keyInput = document.createElement("input");
        keyInput.type = "text";
        keyInput.value = item.key || "";
        keyInput.addEventListener("input", function () {
          var newKey = keyInput.value.trim();
          if (!newKey || newKey === item.key) return;
          if (videoKeyExists(newKey, idx)) {
            toast("key 已存在：" + esc(newKey), "err");
            keyInput.value = item.key;
            return;
          }
          var src = STATE.data.videos.sources[item.key];
          delete STATE.data.videos.sources[item.key];
          STATE.data.videos.sources[newKey] = src || { src: "", type: "iframe" };
          item.key = newKey;
          markDirty();
          toast("key 已更新为 " + esc(newKey) + "，播放源已同步迁移", "ok");
        });
        keyField.appendChild(keyInput);
        body.appendChild(keyField);

        // 播放源（内联编辑，直接读写 videos.sources[item.key]）
        var src = (STATE.data.videos.sources && STATE.data.videos.sources[item.key]) || { src: "", type: "iframe" };
        if (!STATE.data.videos.sources[item.key]) STATE.data.videos.sources[item.key] = src;

        var sp = document.createElement("div");
        sp.className = "field";
        sp.innerHTML = "<label>▶ 播放地址 <span class='req'>*</span></label>";
        var srcBox = document.createElement("div");
        srcBox.className = "row";
        srcBox.appendChild(field({
          label: "地址类型", type: "select",
          options: [
            { v: "iframe", t: "B站/腾讯视频嵌入链接（推荐）" },
            { v: "video", t: "mp4 直链" }
          ],
          path: "videos.sources." + item.key + ".type"
        }));
        srcBox.appendChild(field({
          label: "播放地址", type: "url",
          path: "videos.sources." + item.key + ".src",
          placeholder: "https://player.bilibili.com/player.html?bvid=…"
        }));
        sp.appendChild(srcBox);
        sp.insertAdjacentHTML("beforeend",
          "<p class='spec'>B站：视频页「分享 → 嵌入代码」，复制其中 https://player.bilibili.com/player.html?bvid=… 链接；" +
          "腾讯视频：https://v.qq.com/txp/iframe/player.html?vid=…；mp4 直链建议 ≤ 50MB。</p>");
        body.appendChild(sp);
        bindForm(body);
      }
    }));
    main.appendChild(p2);
  }

  /* ---- about：六组 + 基础字段 ---- */
  function renderPanelAbout() {
    var main = $("main");
    main.innerHTML = "";
    var key = "about";

    var p0 = panelSection("👤 关于我 · 基础信息", "关于我页面的横幅、头像与简介。");
    var r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "模块标签", opt: "英文小标", path: key + ".tag" }));
    r.appendChild(field({ label: "模块标题", path: key + ".title" }));
    p0.appendChild(r);
    p0.appendChild(field({ label: "页面描述", type: "textarea", rows: 2, path: key + ".desc" }));
    p0.appendChild(makeUploader(key + ".avatarImage", {
      label: "头像照片", emoji: "🧑", prefix: "avatar", maxLong: 600
    }));
    p0.appendChild(field({ label: "头像文字", opt: "未传照片时显示", path: key + ".avatar" }));
    p0.appendChild(field({ label: "简介（横幅下方短文）", type: "textarea", rows: 3, path: key + ".text" }));
    bindForm(p0);
    main.appendChild(p0);

    var p1 = panelSection("📝 我的故事", "多段正文，一段一行（空行自动忽略）。");
    p1.appendChild(stringArrayField("故事段落", key + ".story", "每段建议 50~120 字，当前共 " + ((STATE.data.about.story || []).length) + " 段"));
    main.appendChild(p1);

    var p2 = panelSection("🏷 标签", "关注领域标签与兴趣爱好，一行一项。");
    p2.appendChild(stringArrayField("关注领域标签", key + ".tags"));
    p2.appendChild(stringArrayField("兴趣爱好", key + ".hobbies"));
    main.appendChild(p2);

    var p3 = panelSection("📊 数据统计条", "关于我页面的数字统计，建议与首页 Hero 统计一致。");
    p3.appendChild(listEditor({
      itemsPath: key + ".stats",
      titleOf: function (it) { return (it.num || "") + " " + (it.label || ""); },
      addText: "添加统计项",
      addDefaults: { num: "10+", label: "新内容" },
      renderItem: function (body, item, path) {
        var sc = document.createElement("div");
        sc.className = "row";
        sc.appendChild(field({ label: "数字", path: path + ".num" }));
        sc.appendChild(field({ label: "说明", path: path + ".label" }));
        body.appendChild(sc);
        bindForm(body);
      }
    }));
    main.appendChild(p3);

    var p4 = panelSection("🧭 成长时间线", "按年份排列的经历节点。");
    p4.appendChild(listEditor({
      itemsPath: key + ".timeline",
      titleOf: function (it) { return (it.year || "") + " " + (it.title || ""); },
      addText: "添加时间节点",
      addDefaults: { year: "2026", title: "新节点", text: "节点描述……" },
      renderItem: function (body, item, path) {
        var sc = document.createElement("div");
        sc.className = "row3";
        sc.appendChild(field({ label: "年份", path: path + ".year" }));
        sc.appendChild(field({ label: "节点标题", path: path + ".title" }));
        body.appendChild(sc);
        body.appendChild(field({ label: "节点描述", type: "textarea", rows: 2, path: path + ".text" }));
        bindForm(body);
      }
    }));
    main.appendChild(p4);

    var p5 = panelSection("💡 我的原则", "三张价值观卡片。");
    p5.appendChild(listEditor({
      itemsPath: key + ".values",
      titleOf: function (it) { return it.title || "（未命名）"; },
      addText: "添加原则卡片",
      addDefaults: { icon: "✨", title: "新原则", text: "原则描述……" },
      renderItem: function (body, item, path) {
        var sc = document.createElement("div");
        sc.className = "row3";
        sc.appendChild(field({ label: "图标 emoji", path: path + ".icon" }));
        sc.appendChild(field({ label: "标题", path: path + ".title" }));
        body.appendChild(sc);
        body.appendChild(field({ label: "描述", type: "textarea", rows: 2, path: path + ".text" }));
        bindForm(body);
      }
    }));
    main.appendChild(p5);

    var p6 = panelSection("📮 联系 CTA", "页面底部「和我聊聊」区块与联系方式。");
    r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "CTA 标题", path: key + ".ctaTitle" }));
    r.appendChild(field({ label: "CTA 文案", path: key + ".ctaText" }));
    p6.appendChild(r);
    r = document.createElement("div");
    r.className = "row";
    r.appendChild(field({ label: "邮箱地址", type: "email", path: key + ".contact.email" }));
    r.appendChild(field({ label: "邮件按钮文字", path: key + ".contact.emailLabel" }));
    r.appendChild(field({ label: "社交按钮文字", path: key + ".contact.socialLabel" }));
    r.appendChild(field({ label: "社交链接", path: key + ".contact.socialHref" }));
    p6.appendChild(r);
    bindForm(p6);
    main.appendChild(p6);
  }

  /* ---- guide：素材规格 + 新发布流程 ---- */
  function renderPanelGuide() {
    var main = $("main");
    main.innerHTML = "";
    var p = panelSection("📖 素材规格要求", "上传到网站的所有素材请遵守以下规格，保证页面美观与加载速度。");
    p.insertAdjacentHTML("beforeend",
      '<table class="spec-table">' +
        "<tr><th>图片（封面/头像）</th><td>" +
          "格式：<code>JPG</code> / <code>PNG</code> / <code>WebP</code>，单张 <b>≤ 10MB</b>，推荐<b>横图 800×600 及以上</b>（卡片显示区域约 4:3）。" +
          "后台自动压缩为 WebP（封面长边 1600px / 头像 600px），无需手动处理。不上传图片时，卡片使用内置渐变封面 + emoji。</td></tr>" +
        "<tr><th>视频（旅拍/开箱）</th><td>" +
          "方式①（推荐）：B站 / 腾讯视频<b>嵌入链接</b>，如 <code>https://player.bilibili.com/player.html?bvid=…</code>（视频页「分享 → 嵌入代码」获取）。<br>" +
          "方式②：<code>mp4 直链</code>，要求 H.264 编码、1080p 以内、<b>单文件 ≤ 50MB</b>。长视频务必先上传平台再填嵌入链接。</td></tr>" +
        "<tr><th>文章链接</th><td>可填站内锚点（<code>#projects</code>）、外部 <code>https://…</code> 或 <code>#</code>（暂不跳转）。</td></tr>" +
        "<tr><th>文字</th><td>标题建议 ≤ 22 字；简介建议 ≤ 50 字；emoji 图标任选，勿留空格。</td></tr>" +
      "</table>");
    main.appendChild(p);

    var p2 = panelSection("🚀 保存与发布流程", "本后台直连 GitHub 仓库，保存即发布，无需其他操作。");
    p2.insertAdjacentHTML("beforeend",
      '<div class="steps">' +
        '<div class="step"><span class="num">1</span><div class="body"><b>编辑内容</b>左侧切换模块，增删改卡片、上传图片、填写视频地址。所有改动即时写入右侧预览草稿。</div></div>' +
        '<div class="step"><span class="num">2</span><div class="body"><b>实时预览</b>点顶栏「预览」，在抽屉中查看各页面效果（支持手机视口）。预览读取的是本地草稿，不影响线上。</div></div>' +
        '<div class="step"><span class="num">3</span><div class="body"><b>保存并发布</b>点顶栏「保存并发布」，内容提交到 GitHub 仓库，Actions 自动构建部署，<b>约 1~3 分钟后全网生效</b>。</div></div>' +
        '<div class="step"><span class="num">4</span><div class="body"><b>历史与回滚</b>每次保存都是一个 git commit。改错了可在 GitHub 仓库 data/content.json 的 History 中回退到任意旧版本。</div></div>' +
      "</div>" +
      '<p class="spec" style="margin-top:10px">⚠️ 注意：请勿同时在本地运行 deploy.sh 覆盖式部署，两条通道会互相冲突；内容更新统一走本后台。' +
      "令牌仅保存在本机浏览器（base64 混淆存储），请勿在公共设备使用；如怀疑泄露，立即到 GitHub 撤销该令牌。</p>");
    main.appendChild(p2);
  }

  /* ================= 面板切换 ================= */
  function switchPanel(name) {
    var map = {
      site: renderPanelSite,
      hero: renderPanelHero,
      projects: function () { renderPanelCards("projects", "📁 精选项目", "深度文章卡片：封面、分类、标题、简介与跳转链接。"); },
      courses: renderPanelCourses,
      videos: renderPanelVideos,
      unboxing: function () { renderPanelCards("unboxing", "📦 数码产品开箱", "开箱卡片：封面、分类、标题、简介与跳转链接。"); },
      about: renderPanelAbout,
      guide: renderPanelGuide
    };
    document.querySelectorAll(".sidebar button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.panel === name);
    });
    if (map[name]) {
      STATE.panel = name;
      map[name]();
    }
  }

  /* ================= 预览抽屉 ================= */
  var PREVIEW_STATE_KEY = "as_cms_preview";

  function savePreviewState() {
    try {
      localStorage.setItem(PREVIEW_STATE_KEY, JSON.stringify({
        open: !$("preview-drawer").classList.contains("hidden"),
        page: $("preview-page").value,
        mobile: $("preview-frame-wrap").classList.contains("mobile")
      }));
    } catch (e) {}
  }
  function restorePreviewState() {
    try {
      var s = JSON.parse(localStorage.getItem(PREVIEW_STATE_KEY) || "null");
      if (!s) return;
      if (s.page) $("preview-page").value = s.page;
      if (s.mobile) $("preview-frame-wrap").classList.add("mobile");
      if (s.open) openPreview();
    } catch (e) {}
  }
  function openPreview() {
    $("preview-drawer").classList.remove("hidden");
    loadPreviewFrame();
    savePreviewState();
  }
  function closePreview() {
    $("preview-drawer").classList.add("hidden");
    savePreviewState();
  }
  function loadPreviewFrame() {
    var page = $("preview-page").value;
    $("preview-frame").src = page + "?draft=1";
  }
  var previewReloadTimer = null;
  function refreshPreview() {
    if ($("preview-drawer").classList.contains("hidden")) return;
    if (previewReloadTimer) clearTimeout(previewReloadTimer);
    previewReloadTimer = setTimeout(loadPreviewFrame, 800);
  }

  /* ================= 事件绑定 ================= */
  function bindEvents() {
    // 登录
    $("login-btn").addEventListener("click", function () {
      var token = $("login-token").value.trim();
      if (!token) { setLoginStatus("请输入访问令牌", "err"); return; }
      doLogin(token, $("login-session-only").checked, false);
    });
    $("login-token").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("login-btn").click();
    });

    // 顶栏
    $("btn-save").addEventListener("click", function () { saveAll(); });
    $("btn-reload").addEventListener("click", reloadContent);
    $("btn-logout").addEventListener("click", function () {
      var tip = STATE.dirty
        ? "有未保存的修改（草稿仍保留在本机）。确定退出登录？"
        : "确定退出登录？";
      if (!confirm(tip)) return;
      CMS.clearToken();
      showLogin();
      setLoginStatus("", "");
    });

    // 预览
    $("btn-preview").addEventListener("click", function () {
      if ($("preview-drawer").classList.contains("hidden")) openPreview();
      else closePreview();
    });
    $("preview-close").addEventListener("click", closePreview);
    $("preview-page").addEventListener("change", function () {
      loadPreviewFrame(); savePreviewState();
    });
    $("preview-refresh").addEventListener("click", function () {
      writeDraft(); loadPreviewFrame();
    });
    $("preview-vp-desktop").addEventListener("click", function () {
      $("preview-frame-wrap").classList.remove("mobile"); savePreviewState();
    });
    $("preview-vp-mobile").addEventListener("click", function () {
      $("preview-frame-wrap").classList.add("mobile"); savePreviewState();
    });
    $("preview-clear-draft").addEventListener("click", function () {
      clearDraft();
      toast("草稿已清除，预览恢复为线上内容", "ok");
    });

    // sidebar
    $("sidebar").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-panel]");
      if (b && STATE.data) switchPanel(b.dataset.panel);
    });

    // 冲突弹窗
    $("conflict-overwrite").addEventListener("click", conflictOverwrite);
    $("conflict-reload").addEventListener("click", conflictReload);
    $("conflict-download").addEventListener("click", conflictDownload);
    $("conflict-cancel").addEventListener("click", hideConflictModal);

    // 离开保护
    window.addEventListener("beforeunload", function (e) {
      if (STATE.dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  /* ================= 启动 ================= */
  async function init() {
    bindEvents();
    var token = CMS.getToken();
    if (token) {
      showLogin();
      $("login-token").value = token;
      await doLogin(token, false, true); // 静默自动登录
    } else {
      showLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
