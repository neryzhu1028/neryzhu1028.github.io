#!/bin/bash
# ============================================================
# 艾思力个人网页 · 启动管理后台
# 双击运行（macOS），或终端执行：bash 启动后台.command
# 作用：打开线上内容管理后台（https://aceskills.cn/admin/）
# 说明：后台已部署到线上，浏览器直连 GitHub 仓库在线编辑，
#       无需本地服务器。保存即发布，1~3 分钟全网生效。
# ============================================================

ONLINE_ADMIN="https://aceskills.cn/admin/"

echo "🚀 正在打开线上内容管理后台：${ONLINE_ADMIN}"
open "${ONLINE_ADMIN}"

echo ""
echo "提示："
echo "  1. 首次使用需输入 GitHub 访问令牌（页面内有创建指引）"
echo "  2. 编辑后点「保存并发布」，约 1~3 分钟全网生效"
echo "  3. 如需本地调试后台页面，可在项目目录执行："
echo "     npm run dev  然后访问 http://localhost:8000/admin/"
echo ""

# 保持终端窗口打开（双击运行时不会一闪而过）
read -n 1 -s -r -p "（按任意键关闭此终端窗口）"
