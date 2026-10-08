# 셀렉트인 매출 앱

셀렉트인 내부용 데일리 매출 앱 (홈 화면에 설치하는 웹앱).

```
폰 앱 (public/)  ──로그인──▶  Cloudflare Pages Functions (functions/)  ──키──▶  Apps Script (apps-script/)  ──▶  데일리 매출판 시트
```

- **public/** — 앱 화면. 기간 설정·계산은 폰에서 처리, 직전 데이터는 폰에 저장해 즉시 표시
- **functions/** — 로그인(비밀번호 → 90일 유지 쿠키)과 데이터 중계. 시트 API 키는 여기에만 있음
- **apps-script/매출앱.gs** — 시트를 읽어 JSON으로 내려주는 데이터 API. Apps Script `일일매출` 프로젝트의 `매출앱.gs` 파일에만 붙여넣는 원본
  - 같은 프로젝트의 Code.gs·월말 메일.gs·월말정산.gs·과거채우기.gs(기존 자동화)는 건드리지 않음
  - 모든 이름에 `dr` 접두어 사용. 이 프로젝트에서 `doGet`은 매출앱.gs에만 있어야 함

## 처음 설정 (1회)

### 1. Apps Script (구글)
1. Apps Script `일일매출` 프로젝트에서 **`매출앱.gs`만** `apps-script/매출앱.gs` 내용으로 교체, `SalesApp.html` 삭제 (Code.gs 등 다른 파일은 그대로)
2. `drSetupApiKey` 실행 → 실행 로그의 `API_KEY = …` 값 복사
3. `drInstallWarmTrigger` 1회 실행 (10분마다 캐시 미리 채움)
4. 배포 → 새 배포 → 웹 앱 / 실행: 나 / 액세스: **모든 사용자** → 웹 앱 URL(`…/exec`) 복사
   - 키 없는 요청에는 `unauthorized`만 응답합니다.

### 2. Cloudflare Pages
1. Workers & Pages → Create → Pages → Connect to Git → `select-in/sales-app`
2. Build command: 비움 / Build output directory: `public`
3. Settings → Variables and Secrets (Production)에 **Secret**으로 추가

| 이름 | 값 |
|---|---|
| `APP_PASSWORD` | 앱 로그인 비밀번호 |
| `SESSION_SECRET` | 아무 긴 무작위 문자열 |
| `GAS_URL` | 1-4의 웹 앱 URL |
| `GAS_KEY` | 1-2의 API_KEY |

4. Deployments → 최신 배포 **Retry deployment** (변수 반영)

### 3. 폰에 설치
- iPhone: Safari로 접속 → 공유 → **홈 화면에 추가**
- Android: Chrome으로 접속 → ⋮ → **앱 설치 / 홈 화면에 추가**

## 운영
- **수정**: main 브랜치에 push하면 1분 내 자동 배포, 앱은 다시 열면 반영
- **비밀번호 변경**: `APP_PASSWORD` 변경 후 재배포 → 기존 로그인 전부 해제
- **데이터 갱신 주기**: 시트 캐시 15분 + 서버 캐시 2분. 앱의 ↻ 버튼은 시트를 즉시 다시 읽음
