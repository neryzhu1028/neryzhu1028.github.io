# 站点内容 API

代码位于 `cloudbase/functions/site-api`，使用 Node.js HTTP 服务。部署在 CloudBase 上海区 HTTP 云函数。`scf_bootstrap` 启动服务，容器端口由平台配置，默认 `9000`。公开请求经现有 CloudBase HTTPS 网关进入，无需单独配置 Nginx。

| 方法 | 路径 | 响应 |
| --- | --- | --- |
| GET、HEAD | `/site-api/health` | 进程正常时返回 200，GET 响应 `{"ok":true,"service":"site-api"}` |
| GET、HEAD | `/site-api/v1/content` | 返回主站公开内容 JSON。源站超时、内容格式异常或超过 2 MiB 时返回 503 |
| OPTIONS | 上述两个路径 | 已配置站点来源返回 204，其他来源返回 403 |

请求仅接受上述方法，其他方法返回 405，未知路由返回 404。只读接口提供主站已经发布的内容。内容缓存 30 秒，主站 CDN 可能另有缓存周期。日志只记录源站读取失败这一事件。

默认内容来源为 `https://aceskills.cn/data/content.json`。本地可设置 `SITE_CONTENT_URL=http://127.0.0.1:8000/data/content.json` 后运行 `npm --prefix cloudbase/functions/site-api start`。项目无需新数据库和 API 密钥。这次发布保留 GitHub 内容写入路径和上传目录。
