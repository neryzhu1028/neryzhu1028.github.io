#!/bin/bash
# ============================================================
# 艾斯利个人网页 · 启动管理后台
# 双击运行（macOS），或终端执行：bash 启动后台.command
# 作用：启动本地服务器并用浏览器打开后台管理系统
# ============================================================
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:${PORT}/admin/index.html"

# 若端口被占用则换一个
while lsof -i :${PORT} -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  URL="http://localhost:${PORT}/admin/index.html"
done

echo "📡 正在启动本地服务器：http://localhost:${PORT}"
nohup /usr/bin/python3 -m http.server "${PORT}" --bind 127.0.0.1 >/tmp/aijiali-web-server.log 2>&1 &
sleep 1

echo "🚀 正在打开管理后台：${URL}"
open "${URL}"
echo ""
echo "提示：修改内容后点「保存修改」，再到 WorkBuddy 发送「部署网站」即可一键发布。"
