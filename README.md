# 艾思力个人网站

[线上主站](https://aceskills.cn/) · [内容管理](https://aceskills.cn/admin/)

网站包括首页、项目、课程、旅拍、开箱和关于页。访问者可通过目录地址或原有 `index.html` 地址打开各栏目。首页的两项行动仍指向项目和旅拍锚点。

## 本地运行

使用 Node.js 22 或更新版本和 Python 3。在项目根目录运行 `npm run dev`，打开 [本地首页](http://127.0.0.1:8000/) 或 [本地后台](http://127.0.0.1:8000/admin/)。`npm run build` 生成 `dist/`，该目录可作为静态站独立部署。

通过线上后台编辑 `data/content.json` 并上传封面。后台使用限定到站点仓库的 GitHub 令牌。登录默认仅记住当前浏览器会话。编辑和冲突处理方式沿用原流程。后台保存后由 GitHub Actions 发布，站点内容可能受 CDN 缓存影响。

## 工程说明

- `frontend/` 存放页面、管理后台、公共渲染、样式和夜景素材。构建时生成带内容哈希的静态资源和搜索引擎元数据。
- 根目录的 `data/content.json` 与 `assets/uploads/` 是 CMS 的固定地址。发布产物保留原路径。
- `cloudbase/functions/site-api/` 是独立只读 API。主站和本地读取同源 JSON。已配置的 CloudBase 副站优先读 API，失败时使用发布时的副站快照。
- `deploy.sh` 提供构建、API 发布、副站发布、主站发布和检查命令。参考 [部署与回滚](docs/deployment.md) 和 [API](docs/api.md)。

桌面和移动端封面使用内置 ImageGen 分别生成。构图及完整提示见 [视觉素材说明](docs/visuals.md)。
