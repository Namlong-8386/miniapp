<?php
declare(strict_types=1);

// Cấu hình máy chủ gốc (ẩn hoàn toàn phía server, không lộ ra client)
define('UPSTREAM_API_BASE', 'http://103.249.117.228:46566');

// Hỗ trợ khi gọi qua CLI wrapper hoặc CGI
if (empty($_GET) && getenv('QUERY_STRING')) {
    parse_str((string)getenv('QUERY_STRING'), $_GET);
}

/**
 * Chuẩn hóa và kiểm tra tên game hợp lệ
 */
function resolve_game(): string {
    $raw = isset($_GET['game']) ? strtolower(trim((string)$_GET['game'])) : 'taixiu';
    if ($raw === 'taixiu-md5' || $raw === 'taixiumd5' || $raw === 'md5') {
        return 'taixiumd5';
    }
    return 'taixiu';
}

/**
 * Thiết lập header JSON chống cache
 */
function send_json_headers(int $status = 200): void {
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
}

/**
 * Gọi API gốc phía server và trả kết quả JSON về client
 */
function proxy_upstream(string $endpoint): void {
    $url = rtrim(UPSTREAM_API_BASE, '/') . '/' . ltrim($endpoint, '/');
    $body = false;
    $httpCode = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_USERAGENT      => 'LuminaAI-Server/2.0',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    }

    if ($body === false || $httpCode < 200 || $httpCode >= 300) {
        $ctx = stream_context_create([
            'http' => [
                'method'  => 'GET',
                'timeout' => 8,
                'header'  => "Accept: application/json\r\nUser-Agent: LuminaAI-Server/2.0\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body !== false) {
            $httpCode = 200;
        }
    }

    if ($body === false || $body === '') {
        send_json_headers(502);
        echo json_encode([
            'ok'    => false,
            'error' => 'Không thể kết nối máy chủ dữ liệu',
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    send_json_headers(200);
    echo $body;
}
