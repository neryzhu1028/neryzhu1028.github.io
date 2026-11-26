#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

cloudbase_cli="${CLOUDBASE_CLI:-tcb}"
cloud_env="aceskills-2026-d4gpqs1bbda809728"
region="ap-shanghai"
gateway="https://aceskills-2026-d4gpqs1bbda809728-1451609693.ap-shanghai.app.tcloudbase.com"
mirror="https://aceskills-2026-d4gpqs1bbda809728-1451609693.tcloudbaseapp.com"
primary="https://aceskills.cn"
cloud_options=(-e "$cloud_env" --region "$region")

function require_release_commit {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo '请先提交站点改动，再构建同一 Git 版本的发布产物。' >&2
    exit 1
  fi
}

function check_backend {
  curl -fsS --retry 3 --retry-all-errors --retry-delay 2 --max-time 12 "$gateway/site-api/health" | jq -e '.ok == true and .service == "site-api"' >/dev/null
  curl -fsS --retry 3 --retry-all-errors --retry-delay 2 --max-time 12 -H "Origin: $mirror" "$gateway/site-api/v1/content" | jq -e '.site.brandName and .hero and .about' >/dev/null
}

function check_site {
  local url="$1"
  local commit="$2"
  for route in / /index.html /projects/ /courses/ /videos/ /unboxing/ /about/ /admin/ /data/content.json /sitemap.xml; do
    curl -fsS --max-time 12 -o /dev/null "$url$route?v=$commit"
  done
  curl -fsS --max-time 12 "$url/release.json?v=$commit" | jq -e --arg commit "$commit" '.commit == $commit' >/dev/null
}

case "${1:-build}" in
  build)
    npm run build
    npm --prefix cloudbase/functions/site-api test
    ;;
  backend)
    require_release_commit
    bundle="$(mktemp -d)"
    trap 'rm -r -- "$bundle"' EXIT
    cp cloudbase/functions/site-api/{server.js,package.json,scf_bootstrap} "$bundle/"
    (cd "$bundle" && "$cloudbase_cli" fn deploy site-api --httpFn --path /site-api --runtime Nodejs20.19 --install-dependency false "${cloud_options[@]}")
    # CLI 3.8.1 creates the access path; HTTP functions require a WEB_SCF target.
    "$cloudbase_cli" routes edit --data '{"domain":"*","routes":[{"path":"/site-api","upstreamResourceType":"WEB_SCF","upstreamResourceName":"site-api","enable":true,"enableAuth":false,"enableSafeDomain":false,"enablePathTransmission":false}]}' "${cloud_options[@]}"
    check_backend
    ;;
  mirror)
    require_release_commit
    check_backend
    npm run build
    "$cloudbase_cli" hosting deploy dist "${cloud_options[@]}"
    check_site "$mirror" "$(git rev-parse HEAD)"
    ;;
  primary)
    require_release_commit
    check_backend
    check_site "$mirror" "$(git rev-parse HEAD)"
    git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin HEAD:refs/heads/main
    ;;
  verify)
    check_backend
    check_site "$mirror" "$(git rev-parse HEAD)"
    check_site "$primary" "$(git rev-parse HEAD)"
    ;;
  *)
    echo '用法：bash deploy.sh {build|backend|mirror|primary|verify}' >&2
    exit 2
    ;;
esac
