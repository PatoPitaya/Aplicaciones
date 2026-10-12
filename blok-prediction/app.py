"""Servidor local para previsualizar La Apuesta.

Uso:
    py app.py

Abre después http://127.0.0.1:8000
Estado del servidor: http://127.0.0.1:8000/health
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


PROJECT_DIRECTORY = Path(__file__).resolve().parent


class AppHandler(BaseHTTPRequestHandler):
    """Sirve la página y un pequeño endpoint de estado para desarrollo."""

    server_version = "BlokPrediction/1.0"

    def do_GET(self) -> None:  # noqa: N802
        request_path = urlparse(self.path).path

        if request_path == "/health":
            self.send_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "app": "La Apuesta",
                    "time": datetime.now(timezone.utc).isoformat(),
                },
            )
            return

        if request_path in {"/", "/index.html"}:
            self.send_file(PROJECT_DIRECTORY / "index.html")
            return

        relative_path = unquote(request_path).lstrip("/")
        candidate = (PROJECT_DIRECTORY / relative_path).resolve()
        if PROJECT_DIRECTORY not in candidate.parents or not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Archivo no encontrado")
            return

        self.send_file(candidate)

    def send_file(self, file_path: Path) -> None:
        content_type, _ = mimetypes.guess_type(file_path.name)
        if file_path.suffix in {".js", ".mjs"}:
            content_type = "application/javascript; charset=utf-8"
        elif file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix in {".html", ".htm"}:
            content_type = "text/html; charset=utf-8"
        content_type = content_type or "application/octet-stream"

        content = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status: HTTPStatus, body: dict[str, str]) -> None:
        content = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local de La Apuesta.")
    # En Render (Web Service) la variable PORT la define la plataforma y el host debe ser 0.0.0.0.
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"), help="Dirección donde escuchar.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")), help="Puerto local.")
    options = parser.parse_args()

    server = ThreadingHTTPServer((options.host, options.port), AppHandler)
    print(f"La Apuesta disponible en http://{options.host}:{options.port}")
    print(f"API en http://{options.host}:{options.port}/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
