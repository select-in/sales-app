#!/usr/bin/env bash
# Claude Code가 ops_admin 화면을 고치면 바로 PC/MO 점검. 실패하면 Claude에게 결과를 돌려줘 스스로 고치게 한다.
F=$(cat | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.file_path||"")}catch{console.log("")}})')
case "$F" in
  *docs/ops_admin/*.html|*docs/ops_admin/*.css|*docs/ops_admin/*.js) ;;
  *) exit 0 ;;
esac
OUT=$(node tools/layout-check.mjs docs/ops_admin/index.html 2>&1) && exit 0
echo "$OUT" >&2
echo "PC/MO 레이아웃 점검 실패 — 위 항목을 고친 뒤 계속하세요." >&2
exit 2
