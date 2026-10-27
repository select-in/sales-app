<?php
/**
 * 셀렉트인 OPS → 사방넷 API 중계 (카페24 웹호스팅, 고정 IP 222.122.39.21)
 *
 * 왜 필요한가: 사방넷 API는 등록된 IP에서만 호출 가능. 구글 Apps Script는 고정 IP가 없어서 이 서버를 거쳐 호출.
 * 이 파일에는 사방넷 키가 없음. 키는 Apps Script 스크립트 속성에만 있고, 요청할 때마다 HTTPS로 전달돼 사용 후 버림.
 *
 * 보안
 *  - 처음 호출한 앱이 보낸 중계키(relayKey)를 relay_key.php 에 저장, 이후엔 같은 키가 아니면 거부
 *  - 사방넷 호스트(api / sandbox)와 /oauth2/token, /v3/sb/ 경로만 허용 → 다른 사이트로는 못 보냄
 *
 * 액션 (POST JSON)
 *  {relayKey, action:'ip'}                                   → 이 서버의 실제 외부 IP 확인
 *  {relayKey, action:'token', mode, clientCd, secret}        → BCrypt 서명 후 토큰 발급
 *  {relayKey, action:'call', mode, token, svc, method, path, body} → API 호출 그대로 전달
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($a, $code = 200) { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok' => true, 'service' => 'selectin-ops-relay']);
$req = json_decode(file_get_contents('php://input'), true);
if (!is_array($req)) out(['error' => 'bad_json'], 400);

// ---- 중계키 확인 (처음 한 번 등록) ----
$keyFile = __DIR__ . '/relay_key.php';
$key = (string)($req['relayKey'] ?? '');
if (strlen($key) < 32) out(['error' => 'relay_key_required'], 401);
if (!file_exists($keyFile)) {
  file_put_contents($keyFile, "<?php exit; ?>\n" . hash('sha256', $key));
  @chmod($keyFile, 0600);
} else {
  $saved = trim(substr(file_get_contents($keyFile), strlen("<?php exit; ?>\n")));
  if (!hash_equals($saved, hash('sha256', $key))) out(['error' => 'relay_key_mismatch'], 403);
}

$host = (($req['mode'] ?? '') === 'SANDBOX') ? 'https://sandbox.sabangnet.co.kr' : 'https://api.sabangnet.co.kr';

function http($method, $url, $headers, $body) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => $headers, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_HEADER => true,
  ]);
  if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
  $res = curl_exec($ch);
  if ($res === false) { $e = curl_error($ch); curl_close($ch); return ['status' => 0, 'error' => $e]; }
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE); $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE); curl_close($ch);
  $rawH = substr($res, 0, $hs); $h = [];
  foreach (explode("\r\n", $rawH) as $line) if (preg_match('/^(x-ratelimit-[\w-]+|retry-after):\s*(.+)$/i', $line, $m)) $h[strtolower($m[1])] = trim($m[2]);
  return ['status' => $status, 'headers' => $h, 'body' => substr($res, $hs)];
}

switch ($req['action'] ?? '') {
  case 'ip':
    $r = http('GET', 'https://api.ipify.org?format=json', [], null);
    out(['ok' => true, 'ip' => json_decode($r['body'] ?? '{}', true)['ip'] ?? null, 'php' => PHP_VERSION]);

  case 'token':
    $cd = (string)($req['clientCd'] ?? ''); $secret = (string)($req['secret'] ?? '');
    if (!preg_match('/^[0-9a-f\-]{36}$/i', $cd) || $secret === '') out(['error' => 'clientCd_or_secret_missing'], 400);
    $ts = (string)round(microtime(true) * 1000);
    $hash = crypt($cd . '_' . $ts, $secret);               // BCrypt.hashpw(plain, secret)
    if (!$hash || strlen($hash) < 50) out(['error' => 'bcrypt_failed (시크릿 형식 확인)'], 400);
    $form = http_build_query([
      'grant_type' => 'client_credentials', 'clientType' => 'SB_APP', 'clientCd' => $cd,
      'timestamp' => $ts, 'secretSign' => base64_encode($hash), 'authMode' => ($req['mode'] ?? 'PRODUCTION') === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION',
    ]);
    $r = http('POST', $host . '/oauth2/token', ['Content-Type: application/x-www-form-urlencoded'], $form);
    out(['ok' => $r['status'] === 200, 'status' => $r['status'], 'body' => json_decode($r['body'] ?? 'null', true) ?? ($r['body'] ?? $r['error'] ?? '')]);

  case 'call':
    $path = (string)($req['path'] ?? '');
    if (!preg_match('#^/v3/sb/[A-Za-z0-9/_\-]+(\?[A-Za-z0-9_\-=&%.,:]*)?$#', $path)) out(['error' => 'path_not_allowed'], 400);
    $method = strtoupper((string)($req['method'] ?? 'POST'));
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) out(['error' => 'method_not_allowed'], 400);
    $headers = ['Authorization: Bearer ' . (string)($req['token'] ?? ''), 'X-Svc-Acnt-Id: ' . (string)($req['svc'] ?? ''), 'Content-Type: application/json'];
    $body = array_key_exists('body', $req) && $req['body'] !== null ? json_encode($req['body'], JSON_UNESCAPED_UNICODE) : null;
    $r = http($method, $host . $path, $headers, $body);
    out(['ok' => $r['status'] >= 200 && $r['status'] < 300, 'status' => $r['status'], 'headers' => $r['headers'] ?? [], 'body' => json_decode($r['body'] ?? 'null', true) ?? ($r['body'] ?? $r['error'] ?? '')]);

  default:
    out(['error' => 'unknown_action'], 400);
}
