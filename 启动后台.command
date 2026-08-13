#!/bin/bash
# ============================================================
# 艾斯利个人网页 · 启动管理后台
# 双击运行（macOS），或终端执行：bash 启动后台.command
# 作用：启动本地服务器并等待就绪后，用浏览器打开后台管理系统
# ============================================================
cd "$(dirname "$0")"

PORT=8000

# 若端口被占用则换一个（最多试 20 个）
i=0
while lsof -i :${PORT} -sTCP:LISTEN >/dev/null 2>&1; do
  i=$((i + 1))
  if [ $i -gt 20 ]; then
    echo "⚠️ 8000-8020 端口都被占用，请关闭其他本地服务器后重试。"
    read -n 1 -s -r -p "按任意键退出..."
    exit 1
  fi
  PORT=$((PORT + 1))
done

URL="http://localhost:${PORT}/admin/index.html"
SERVER_LOG="/tmp/aijiali-web-server.log"

echo "📡 正在启动本地服务器：http://localhost:${PORT}"
# 优先用系统 python3，兜底用 managed python
PYTHON_BIN="/usr/bin/python3"
[ -x "$PYTHON_BIN" ] || PYTHON_BIN="$(command -v python3)"
nohup "$PYTHON_BIN" -m http.server "${PORT}" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# 轮询等待服务器真正就绪（最多等 8 秒），避免浏览器提前打开遇到 404
ready=0
for t in $(seq 1 40); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/admin/index.html" --max-time 1 2>/dev/null | grep -q 200; then
    ready=1
    break
  fi
  sleep 0.2
done

if [ "$ready" = "1" ]; then
  echo "✅ 服务器就绪，正在打开管理后台：${URL}"
  open "${URL}"
  echo ""
  echo "提示：修改内容后点「保存修改」，再到 WorkBuddy 发送「部署网站」即可一键发布。"
  echo "（此终端窗口可关闭，服务器在后台运行；如需停止服务器，关闭后重启电脑或执行：kill $SERVER_PID）"
else
  echo "⚠️ 服务器启动失败，请查看日志：cat $SERVER_LOG"
  echo "或手动执行：cd \"$(pwd)\" && python3 -m http.server ${PORT}"
fi

# 保持终端窗口打开（双击运行时不会一闪而过）
read -n 1 -s -r -p "（按任意键关闭此终端窗口）"
