# 보관: 데일리 매출 앱 (2026-10-27 사용 중지)

매출은 이제 **셀렉트인 OPS → 매출** 메뉴에서 봅니다 (https://select-in.github.io/sales-app/hub/#sales).
OPS 서버(허브.gs `hubSales_`)가 매출판 시트를 직접 읽으므로 이 앱을 거치지 않습니다.

- 여기 있는 `index.html`은 예전 앱 화면 원본(보관용)이며 웹에 공개되지 않습니다.
- 예전 주소(select-in.github.io/sales-app/)는 OPS 매출 화면으로 자동 이동합니다.
- Apps Script `일일매출` 프로젝트는 **지우지 마세요.** 매출판 시트를 채우는 자동화(Code.gs, 월말 메일.gs, 월말정산.gs 등)가
  들어 있고 OPS 매출이 그 시트를 읽습니다. `매출앱.gs`(예전 앱 서버)만 쓰이지 않는 상태입니다.
- 다시 쓰려면 이 폴더의 index.html을 docs/index.html로 되돌리면 됩니다.
