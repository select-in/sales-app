#!/usr/bin/env bash
# 대장 확인 후 ops_admin → ops_work 반영
#  1) 화면: docs/ops_admin/index.html → docs/ops_work/index.html (config.js·manifest는 각자 유지) → 커밋·푸시
#  2) 서버: Apps Script 「셀렉트인 OPS」 배포 관리 → 직원용 배포(AKfycbyCs6Q…, ops_work)를 「ops_admin 서버」 배포와 같은 버전으로 수정
#     (「OPS 자동배포」는 직원용 배포를 PINNED로 건너뛰므로 자동으로는 안 올라감)
set -euo pipefail
cd "$(dirname "$0")/.."
cp docs/ops_admin/index.html docs/ops_work/index.html
echo "화면 반영 준비 완료: ops_admin → ops_work. 커밋·푸시 후 서버 배포 버전도 맞추세요."
