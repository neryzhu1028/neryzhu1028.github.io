# 部署与回滚

## 发布顺序

1. 核实 GitHub `origin/main` 最新提交，基于它提交发布分支。确认 `data/content.json` 和上传目录保留 CMS 最新内容。运行 `bash deploy.sh build` 并完成浏览器验收。
2. 用 `tcb login --flow web` 授权现有 CloudBase 环境。若 CLI 可执行文件位于自定义路径，设置 `CLOUDBASE_CLI`。先备份现有 HTTP 路由和副站内容，初次运行 `bash deploy.sh backend`，依次确认 HTTP 云函数和 `WEB_SCF` 路由。现有 `site-api` 后续更新可使用 `tcb fn code update site-api --dir cloudbase/functions/site-api`，保留已生效的路由和运行配置。
3. 运行 `bash deploy.sh mirror`，CLI 先上传资源再更新入口，发布脚本通过 HTTPS 核验版本和主要路径。如果需要同步 CMS 改稿后的备用快照，使用包含最新内容的提交重跑本步骤。
4. 运行 `bash deploy.sh primary`。命令先检查同一 Git 版本的副站和 API，再将当前提交快进主分支。等待对应的 Pages Actions 成功，运行 `bash deploy.sh verify`，检查控制台、健康检查、主要页面及静态资源。
5. 发布报告记录提交、站点 HTTPS 状态、CloudBase 函数运行状态和确认时间。

## 回滚

- GitHub Pages 在最新 `main` 上回退站点重构提交并重新发布。核对 `data/content.json` 和上传目录保留管理员在发布后提交的内容，不回退共享分支历史。
- CloudBase 静态副站可从发布前文件备份重新上传，先传资源，再传页面。CLI `--safe` 也会保存被覆盖对象，上传或校验失败时自动恢复。保持原域名和 HTTPS 配置。
- 回滚 API 代码前先备份当前代码。若初次部署失败，移除本次新增的 HTTP 路由即可。云函数、网关路由和托管部署状态在 CloudBase 控制台核查。
- 本次按用户要求退役录音卡公开路由。变更前的代码与路由备份放在私有备份目录。

[CloudBase 登录](https://docs.cloudbase.net/cli-v1/login) · [静态托管发布](https://docs.cloudbase.net/cli-v1/hosting/deploy) · [GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
