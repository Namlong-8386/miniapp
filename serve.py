import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(ROOT_DIR, 'api')
UPSTREAM_API_BASE = 'http://103.249.117.228:46566'
BOT_TOKEN = '9080540135:AAGVJ72MWpPH98XJXqwpJnkSxHe321jCbZQ'
CHAT_ID = -1002673757567

PHP_BIN = shutil.which('php') or shutil.which('/usr/bin/php')


class PHPAndStaticHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        clean_path = os.path.normpath(parsed.path.lstrip('/')).replace('\\', '/')

        # Block direct access to config.php or any non-public PHP file
        if clean_path == 'api/config.php' or (clean_path.endswith('.php') and not clean_path.startswith('api/')):
            self.send_response(403)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"Forbidden"}')
            return

        # Check channel membership via Telegram Bot API
        if clean_path == 'api/checkmember':
            qs = urllib.parse.parse_qs(parsed.query or '')
            uid = qs.get('user_id', [''])[0]
            try:
                url = f"https://api.telegram.org/bot{TOKEN}/getChatMember?chat_id={CHAT_ID}&user_id={uid}"
                with urllib.request.urlopen(url, timeout=10) as resp:
                    body = resp.read()
            except Exception as e:
                body = b'{"ok":false,"error":"check failed"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
            return

        # Execute PHP endpoints inside /api/
        if clean_path in ('api/dudoan.php', 'api/history.php'):
            script_file = os.path.join(ROOT_DIR, clean_path)
            self._handle_api(script_file, parsed.query, endpoint=clean_path)
            return

        # Legacy route compatibility (/api/<game>/<endpoint> -> PHP script)
        if clean_path.startswith('api/'):
            parts = clean_path.split('/')
            if len(parts) == 3 and parts[2] in ('dudoan', 'history'):
                script_file = os.path.join(API_DIR, f'{parts[2]}.php')
                query = f'game={urllib.parse.quote(parts[1])}'
                if parsed.query:
                    query = f'{query}&{parsed.query}'
                self._handle_api(script_file, query, endpoint=f'api/{parts[2]}.php')
                return

        super().do_GET()

    def _resolve_game(self, query_string: str) -> str:
        qs = urllib.parse.parse_qs(query_string or '')
        raw = qs.get('game', ['taixiu'])[0].lower().strip()
        if raw in ('taixiu-md5', 'taixiumd5', 'md5'):
            return 'taixiumd5'
        return 'taixiu'

    def _proxy_python(self, query_string: str, endpoint: str):
        game = self._resolve_game(query_string)
        action = 'history' if 'history' in endpoint else 'dudoan'
        upstream_url = f'{UPSTREAM_API_BASE}/{game}/{action}'

        req = urllib.request.Request(
            upstream_url,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'LuminaAI-Server/2.0'
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                body = res.read()
                status = res.status
        except urllib.error.HTTPError as e:
            body = e.read()
            status = e.code
        except Exception as e:
            body = json.dumps({'ok': False, 'error': f'Không thể kết nối máy chủ dữ liệu: {e}'}, ensure_ascii=False).encode('utf-8')
            status = 502

        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _handle_api(self, script_file: str, query_string: str, endpoint: str):
        if PHP_BIN:
            self._run_php(script_file, query_string)
        else:
            self._proxy_python(query_string, endpoint)

    def _run_php(self, script_file: str, query_string: str):
        if not os.path.isfile(script_file):
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"Not found"}')
            return

        env = os.environ.copy()
        env['QUERY_STRING'] = query_string or ''
        env['REQUEST_METHOD'] = 'GET'

        try:
            proc = subprocess.run(
                [PHP_BIN, script_file],
                env=env,
                cwd=API_DIR,
                capture_output=True,
                timeout=10,
            )
            body = proc.stdout
            status = 200 if (proc.returncode == 0 and body) else 502
            if not body:
                body = b'{"ok":false,"error":"Empty response from PHP API"}'
        except Exception:
            status = 502
            body = b'{"ok":false,"error":"PHP execution error"}'

        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(ROOT_DIR)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    print(f'Server running at: http://localhost:{port}')
    print(f'Serving directory: {ROOT_DIR}')
    print(f'PHP Mode: {"CLI (" + PHP_BIN + ")" if PHP_BIN else "Python Proxy Fallback"}')
    sys.stdout.flush()
    with socketserver.ThreadingTCPServer(('0.0.0.0', port), PHPAndStaticHandler) as httpd:
        httpd.serve_forever()
