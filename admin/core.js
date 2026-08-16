/* ============================================================
 * 艾斯利个人网页 · 内容管理后台 — 核心层 (core.js)
 * 职责：配置默认值、令牌存取、GitHub REST API 封装、
 *       UTF-8 base64 编解码、toast 提示、统一错误拦截
 * 依赖：无（纯浏览器环境）
 * ============================================================ */
(function (global) {
  "use strict";

  /* ---------------- 常量与配置 ---------------- */
  var TOKEN_KEY = "as_cms_token";
  var TOKEN_STORE_KEY = "as_cms_token_store"; // localStorage | sessionStorage
  var CONFIG_KEY = "as_cms_config";

  var DEFAULT_CONFIG = {
    owner: "neryzhu1028",
    repo: "neryzhu1028.github.io",
    branch: "main",
    dataPath: "data/content.json",
    uploadsDir: "assets/uploads"
  };

  var API_BASE = "https://api.github.com";
  var API_VERSION = "2022-11-28";

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- UTF-8 base64 编解码 ----------------
   * contents API 返回 base64；content.json 含中文，
   * 裸 atob/btoa 会破坏 UTF-8 多字节字符，必须走 TextEncoder/TextDecoder。 */
  function b64ToText(b64) {
    var bytes = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    return new TextDecoder("utf-8").decode(bytes);
  }
  function textToB64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    // 分块处理，避免 String.fromCharCode.apply 在大数组上栈溢出
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /* ---------------- 令牌存取（base64 轻度混淆，防肩窥非加密） ---------------- */
  function getToken() {
    var raw = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    if (!raw) return "";
    try { return atob(raw); } catch (e) { return raw; }
  }
  function setToken(token, sessionOnly) {
    try {
      var encoded = btoa(token);
      if (sessionOnly) {
        sessionStorage.setItem(TOKEN_KEY, encoded);
        localStorage.removeItem(TOKEN_KEY);
      } else {
        localStorage.setItem(TOKEN_KEY, encoded);
        sessionStorage.removeItem(TOKEN_KEY);
      }
      localStorage.setItem(TOKEN_STORE_KEY, sessionOnly ? "session" : "local");
    } catch (e) {}
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_STORE_KEY);
  }

  /* ---------------- 配置读写 ---------------- */
  function getConfig() {
    try {
      var saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
      return Object.assign({}, DEFAULT_CONFIG, saved || {});
    } catch (e) {
      return deepClone(DEFAULT_CONFIG);
    }
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg, type, duration) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.innerHTML = msg;
    t.className = "toast show" + (type ? " " + type : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, duration || 2800);
  }

  /* ---------------- 自定义错误类型 ---------------- */
  function ApiError(message, status, body) {
    var e = new Error(message);
    e.name = "ApiError";
    e.status = status;
    e.body = body;
    return e;
  }

  /* ---------------- GitHub REST API 封装 ---------------- */
  function apiHeaders(token) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": API_VERSION
    };
  }

  // 统一 fetch 封装：解析响应、统一错误拦截
  async function request(path, options, token) {
    options = options || {};
    var headers = apiHeaders(token || getToken());
    if (options.body) headers["Content-Type"] = "application/json";
    var res;
    try {
      res = await fetch(API_BASE + path, {
        method: options.method || "GET",
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (netErr) {
      throw ApiError("网络错误：无法连接 GitHub API（请检查网络）", 0, null);
    }

    var body = null;
    try { body = await res.json(); } catch (e) {}

    // 限流优先于鉴权判断（403 也可能表示 secondary rate limit）
    var isRateLimit = res.status === 429 ||
      (res.status === 403 && body && /rate limit/i.test(body.message || ""));
    if (isRateLimit) {
      throw ApiError("请求过于频繁，已被 GitHub 限流，请稍后再试", res.status, body);
    }
    if (res.status === 401 || res.status === 403) {
      var msg = res.status === 401
        ? "令牌无效或已过期，请重新登录"
        : "无权限访问该资源（请确认令牌具备 Contents 读写权限）";
      var err = ApiError(msg, res.status, body);
      err.auth = true;
      throw err;
    }
    if (!res.ok) {
      var detail = (body && body.message) ? body.message : ("HTTP " + res.status);
      throw ApiError(detail, res.status, body);
    }
    return body;
  }

  /* ---------------- 高层 API ---------------- */

  // 验证仓库可访问且有写权限，返回仓库元信息
  async function verifyRepo(cfg, token) {
    var repoInfo = await request("/repos/" + cfg.owner + "/" + cfg.repo, {}, token);
    var perms = repoInfo.permissions || {};
    if (!perms.push) {
      throw ApiError("当前令牌对该仓库没有写入（push）权限", 403, repoInfo);
    }
    return repoInfo;
  }

  // 读取文件内容，返回 { text, sha, raw }
  async function getContent(path, cfg, token) {
    var cfg2 = cfg || getConfig();
    var body = await request(
      "/repos/" + cfg2.owner + "/" + cfg2.repo + "/contents/" + path +
      "?ref=" + encodeURIComponent(cfg2.branch), {}, token
    );
    return {
      text: b64ToText(body.content),
      sha: body.sha,
      raw: body
    };
  }

  // 写入文件（创建或更新），message 为 commit 信息
  async function putContent(path, text, sha, message, cfg, token) {
    var cfg2 = cfg || getConfig();
    var body = {
      message: message,
      content: textToB64(text),
      branch: cfg2.branch
    };
    if (sha) body.sha = sha;
    return request(
      "/repos/" + cfg2.owner + "/" + cfg2.repo + "/contents/" + path,
      { method: "PUT", body: body }, token
    );
  }

  // 检测文件是否存在（用于图片重名探测），返回布尔
  async function fileExists(path, cfg, token) {
    var cfg2 = cfg || getConfig();
    try {
      await request(
        "/repos/" + cfg2.owner + "/" + cfg2.repo + "/contents/" + path +
        "?ref=" + encodeURIComponent(cfg2.branch), {}, token
      );
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  }

  // 读取 data/content.json 并解析为对象，返回 { data, sha }
  async function loadContent(cfg, token) {
    var cfg2 = cfg || getConfig();
    var file = await getContent(cfg2.dataPath, cfg2, token);
    var data;
    try {
      data = JSON.parse(file.text);
    } catch (e) {
      throw ApiError("data/content.json 不是合法 JSON，无法解析", 500, null);
    }
    return { data: data, sha: file.sha };
  }

  // 保存 data/content.json，返回 API 响应（含新 sha）
  async function saveContent(data, sha, message, cfg, token) {
    var cfg2 = cfg || getConfig();
    var text = JSON.stringify(data, null, 2);
    var res = await putContent(cfg2.dataPath, text, sha, message, cfg2, token);
    return res;
  }

  // 上传图片（Blob -> base64），返回 API 响应
  async function uploadImage(fileName, blob, message, cfg, token) {
    var cfg2 = cfg || getConfig();
    var arrayBuf = await blob.arrayBuffer();
    var bytes = new Uint8Array(arrayBuf);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    var b64 = btoa(bin);
    var path = cfg2.uploadsDir + "/" + fileName;
    var body = {
      message: message || ("upload: " + fileName),
      content: b64,
      branch: cfg2.branch
    };
    return request(
      "/repos/" + cfg2.owner + "/" + cfg2.repo + "/contents/" + path,
      { method: "PUT", body: body }, token
    );
  }

  /* ---------------- 对外导出 ---------------- */
  global.CMS = {
    // 配置
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    getConfig: getConfig,
    saveConfig: saveConfig,
    // 令牌
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    // API
    request: request,
    verifyRepo: verifyRepo,
    getContent: getContent,
    putContent: putContent,
    fileExists: fileExists,
    loadContent: loadContent,
    saveContent: saveContent,
    uploadImage: uploadImage,
    // 工具
    esc: esc,
    deepClone: deepClone,
    b64ToText: b64ToText,
    textToB64: textToB64,
    toast: toast,
    ApiError: ApiError
  };

})(window);
