#!/usr/bin/env bash
# 대장 총괄판(docs/ops_admin) → 직원 OPS(docs/ops_work) 반영. config.js(채널·서버 주소)·manifest(앱 이름)는 각자 유지.
set -euo pipefail
cd "$(dirname "$0")/.."
cp docs/ops_admin/index.html docs/ops_work/index.html
echo "반영 완료: ops_admin → ops_work (index.html). 커밋·푸시하면 직원 화면은 「새 버전 적용」 또는 다시 열 때 바뀝니다."
