"""
TFE Local Server
================
Serves today.json to the TFE Chrome extension at http://localhost:7329

Run this after tfe_morning_scraper.py has finished:
    python tfe_server.py

Keep it running in the background while you use the extension.
You can minimise the terminal window — it runs silently.

The server automatically reloads today.json if the file changes,
so you can re-run the scraper during the day to pick up late additions.
"""

import http.server
import json
import os
from pathlib import Path
from datetime import date

PORT      = 7329
DATA_DIR  = Path(__file__).parent.parent / "tfe-data"
DATA_FILE = DATA_DIR / "today.json"


class TFEHandler(http.server.BaseHTTPRequestHandler):

    def do_GET(self):
        if self.path == "/today.json":
            self._serve_file(DATA_FILE)
        elif self.path.startswith("/results_") and self.path.endswith(".json"):
            self._serve_file(DATA_DIR / self.path.lstrip("/"))
        elif self.path == "/health":
            self._ok("TFE server running")
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        # CORS preflight — extension needs this
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _ok(self, text):
        body = text.encode()
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type",   "text/plain")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, path):
        path = Path(path)
        if not path.exists():
            body = json.dumps({"error": f"{path.name} not found"}).encode()
            self.send_response(503)
            self._cors_headers()
            self.send_header("Content-Type",   "application/json")
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)
            return
        body = path.read_bytes()
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type",   "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Cache-Control",  "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Suppress per-request noise — only print warnings
        if "WARNING" in fmt or "ERROR" in fmt:
            super().log_message(fmt, *args)


def main():
    DATA_DIR.mkdir(exist_ok=True)

    if DATA_FILE.exists():
        size_kb = DATA_FILE.stat().st_size / 1024
        print(f"  today.json found ({size_kb:.0f} KB)")
    else:
        print("  today.json not found — run tfe_morning_scraper.py first")
        print("  Starting server anyway (extension will get a 503 until data is ready)")

    server = http.server.HTTPServer(("localhost", PORT), TFEHandler)
    print(f"\nTFE server running at http://localhost:{PORT}")
    print(f"Extension reads:     http://localhost:{PORT}/today.json")
    print(f"Health check:        http://localhost:{PORT}/health")
    print("\nKeep this window open while using the extension.")
    print("Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
