#!/usr/bin/env bash
# 총괄 작업판(docs/hub-next) → 직원 OPS(docs/hub) 반영. config.js(채널·서버 주소)는 각자 유지.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in index.html manifest.webmanifest; do cp "docs/hub-next/$f" "docs/hub/$f"; done
echo "반영 완료: docs/hub-next → docs/hub (config.js 제외). 커밋·푸시하면 직원 화면은 탭을 닫았다 열거나 「새 버전 적용」을 누를 때 바뀝니다."
