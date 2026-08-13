#!/bin/bash
# ============================================================
# 艾斯利个人网页 · 一键部署脚本
# 作用：把最新内容（含 data/content.json 与 assets/uploads 图片）
#       推送到 GitHub Pages（neryzhu1028.github.io）
# 用法：终端执行  bash deploy.sh
# 注意：CloudBase 同步请在 WorkBuddy 中发送「部署网站」，由 AI 完成
# ============================================================
set -e
cd "$(dirname "$0")"

REPO_DIR="/tmp/aijiali-site"
REPO_URL="https://github.com/neryzhu1028/neryzhu1028.github.io.git"

echo "== 1/3 准备部署目录 =="
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "  首次部署，克隆仓库…"
  gh repo clone neryzhu1028/neryzhu1028.github.io "$REPO_DIR" 2>/dev/null || git clone "$REPO_URL" "$REPO_DIR"
fi

echo "== 2/3 同步网站文件 =="
rm -rf "$REPO_DIR"/*
cp -R index.html css js data assets "$REPO_DIR"/
# 不部署后台管理页与开发文档
ls "$REPO_DIR"

echo "== 3/3 提交并推送 =="
cd "$REPO_DIR"
git config user.name "neryzhu1028"
git config user.email "neryzhu1028@users.noreply.github.com"
git add -A
git commit -m "网站内容更新 $(date '+%Y-%m-%d %H:%M')" || { echo "没有新改动，跳过推送"; exit 0; }
git push origin main

echo ""
echo "✅ GitHub Pages 已更新：https://neryzhu1028.github.io/"
echo "   同步 CloudBase 请到 WorkBuddy 发送「部署网站」"
