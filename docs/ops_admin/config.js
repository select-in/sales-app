// ops_admin (대장 총괄판 전용) — 직원·관리자 계정은 이 주소로 로그인할 수 없습니다 (서버에서 막음).
window.HUB_CHANNEL = 'next';
// ops_admin 전용 서버(Apps Script 배포 「ops_admin 서버」). 서버 코드가 바뀌면 「OPS 자동배포」가 5분 안에 이 배포만 새 버전으로 올립니다.
// 직원용 ops_work 서버는 고정 — 대장이 확인 후 「반영」할 때만 같은 버전으로 올립니다. 데이터(시트)는 같이 씁니다.
window.HUB_API = 'https://script.google.com/macros/s/AKfycbyC7Bc-4VPDsVWxe-IoUEnHLzzDbhr5xsPn8_vUwnKeQdom_uxWhuojZkJtOo76QZOdrA/exec';
