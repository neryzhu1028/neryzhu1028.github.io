# 艾斯利个人网页

简洁现代风格的个人网站，展示项目、课程、旅拍视频、数码开箱等模块。
纯静态站点，内容由 **后台管理系统** 维护，无需修改代码即可更新全站。

## 🚀 快速开始（管理网站内容）

### 方式一：后台管理系统（推荐，可视化编辑）

1. **双击运行** `启动后台.command`（macOS），浏览器自动打开后台管理系统
   - 或用终端：`cd 个人网页目录 && python3 -m http.server 8000`，访问 `http://localhost:8000/admin/index.html`
2. 点右上角 **「连接网站文件夹」**，选择「个人网页」网站根目录（含 index.html 的文件夹）—— 推荐用 Chrome / Edge 浏览器
3. 左侧切换模块，**添加 / 修改 / 删除** 任意内容：站点信息、Hero 首屏、精选项目、课程、旅拍视频、产品开箱、关于我
4. 上传图片自动校验格式并压缩；视频填 B站/腾讯视频嵌入链接或 mp4 直链
5. 点 **「保存修改」** → 内容写入 `data/content.json`（旧版自动备份为 `content.backup.json`）
6. 打开 WorkBuddy 发送 **「部署网站」**，全站一键更新（GitHub Pages + CloudBase）

> 未连接文件夹时，保存会下载 `content.json`，手动放入 `data/` 目录即可。

### 方式二：终端一键部署

```bash
bash deploy.sh    # 推送到 GitHub Pages
```

## 📦 素材规格要求

| 素材 | 要求 |
|------|------|
| **图片**（封面/头像） | 格式 JPG / PNG / WebP；单张 ≤ 10MB；推荐横图 800×600 及以上（封面显示区约 4:3）。后台自动压缩为 WebP（长边 1600px、质量 85%）存入 `assets/uploads/` |
| **视频** | ① 推荐：B站 / 腾讯视频**嵌入链接**（`https://player.bilibili.com/player.html?bvid=…`，分享→嵌入代码中复制）② 或 mp4 直链：H.264、≤1080p、单文件 ≤50MB（GitHub 限 100MB）。长视频务必先传视频平台再填链接 |
| **文章链接** | 站内锚点（`#projects`）、外部 `https://…` 或 `#`（不跳转） |
| **文字** | 标题 ≤ 22 字；简介 ≤ 50 字 |

## 📁 文件结构

```
├── index.html            # 主页面（内容由 data/content.json 渲染）
├── css/style.css         # 样式
├── js/main.js            # 数据驱动渲染 + 交互逻辑
├── data/
│   ├── content.json      # ★ 全站内容（后台管理系统写入）
│   └── content.backup.json  # 保存时的自动备份
├── assets/uploads/       # 上传的图片素材
├── admin/index.html      # ★ 后台管理系统（本地打开）
├── 启动后台.command      # 一键启动后台（macOS 双击）
└── deploy.sh             # 一键部署脚本（推 GitHub Pages）
```

## 🌐 部署地址

- GitHub Pages：https://neryzhu1028.github.io/
- CloudBase：https://aceskills-2026-d4gpqs1bbda809728-1451609693.tcloudbaseapp.com/

## 🔄 修改代码级定制

如需调整样式（配色、布局）或功能（新增模块类型），在 WorkBuddy 中直接描述需求即可，AI 会同步更新前后端与数据模型。
