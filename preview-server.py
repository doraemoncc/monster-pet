#!/usr/bin/env python3
"""
本地预览服务器：强制禁用一切缓存（no-store），根治"改完代码看不到最新版"。
配合 js/app.js 里本地禁用 Service Worker 的逻辑，双保险。

用法： python3 preview-server.py [端口]
默认端口 8099。启动后访问 http://localhost:8099/index.html
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 静默日志，减少干扰
        pass


if __name__ == '__main__':
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('0.0.0.0', PORT), NoCacheHandler)
    print(f'Preview server running at http://localhost:{PORT}/  (cache disabled)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
        server.shutdown()
