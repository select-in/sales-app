#!/usr/bin/env bash
# ops_work 화면을 직전 버전으로 되돌린다 (무중단 원칙: 문제 시 즉시 복귀)
# 사용: bash tools/rollback.sh [되돌릴 단계 수, 기본 1]
set -euo pipefail
N="${1:-1}"
F="docs/ops_work/index.html"
git pull --rebase --quiet
REV=$(git log --format=%H -n $((N+1)) -- "$F" | tail -1)
if [ -z "$REV" ]; then echo "되돌릴 이전 버전이 없습니다."; exit 1; fi
git checkout "$REV" -- "$F"
node tools/layout-check.mjs "$F" || { echo "이전 버전도 점검 실패 — 단계 수를 늘려 다시 실행: bash tools/rollback.sh $((N+1))"; git checkout HEAD -- "$F"; exit 1; }
git commit -m "ops_work 롤백: $(git log -1 --format=%s "$REV" | cut -c1-60)" -- "$F"
git push
echo "ops_work 화면을 ${REV:0:7} 버전으로 되돌렸습니다. (GitHub Pages 반영 1~2분)"
