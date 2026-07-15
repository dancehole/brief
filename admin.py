from __future__ import annotations

import argparse
import base64
import json
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from render import ROOT, available_names, render_resume


JSON_DIR = ROOT / "json"
UPLOAD_DIR = ROOT / "assets" / "img" / "uploads"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
NAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico"}


def is_safe_name(name: str) -> bool:
    return bool(NAME_RE.fullmatch(name))


def clean_filename(filename: str) -> str:
    basename = Path(filename).name.strip()
    return re.sub(r"[^0-9A-Za-z._\-\u4e00-\u9fff]", "_", basename)


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    body = handler.rfile.read(length)
    if not body:
        return {}
    return json.loads(body.decode("utf-8"))


class AdminHandler(SimpleHTTPRequestHandler):
    server_version = "BriefAdmin/1.0"

    def log_message(self, format: str, *args: object) -> None:
        try:
            super().log_message(format, *args)
        except OSError:
            pass

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed.path, parse_qs(parsed.query))
            return
        super().do_GET()

    def do_POST(self) -> None:
        self.handle_api_write()

    def do_PUT(self) -> None:
        self.handle_api_write()

    def handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        try:
            if path.rstrip("/") == "/api/resumes":
                self.send_json({"names": available_names()})
                return

            if path.startswith("/api/resumes/"):
                name = unquote(path.removeprefix("/api/resumes/")).strip("/")
                self.send_resume(name)
                return

            if path.rstrip("/") == "/api/render":
                name = (query.get("name") or [""])[0]
                self.render_name(name)
                return

            self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route.")
        except Exception as exc:  # noqa: BLE001 - return readable admin errors
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def handle_api_write(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path.startswith("/api/resumes/"):
                name = unquote(path.removeprefix("/api/resumes/")).strip("/")
                self.save_resume(name, read_json_body(self))
                return

            if path.rstrip("/") == "/api/render":
                payload = read_json_body(self)
                self.render_name(str(payload.get("name", "")))
                return

            if path.rstrip("/") == "/api/upload":
                self.save_upload(read_json_body(self))
                return

            self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route.")
        except json.JSONDecodeError:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Request body is not valid JSON.")
        except Exception as exc:  # noqa: BLE001 - return readable admin errors
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def send_resume(self, name: str) -> None:
        if not is_safe_name(name):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Resume name can only contain letters, numbers, - and _.")
            return

        json_path = JSON_DIR / f"{name}.json"
        if not json_path.exists():
            self.send_error_json(HTTPStatus.NOT_FOUND, f"{name}.json does not exist.")
            return

        with json_path.open("r", encoding="utf-8") as file:
            self.send_json(json.load(file))

    def save_resume(self, name: str, payload: dict) -> None:
        if not is_safe_name(name):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Resume name can only contain letters, numbers, - and _.")
            return
        if not isinstance(payload, dict):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Resume data must be a JSON object.")
            return

        json_path = JSON_DIR / f"{name}.json"
        tmp_path = JSON_DIR / f".{name}.json.tmp"
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        tmp_path.replace(json_path)
        self.send_json({"ok": True, "path": str(json_path.relative_to(ROOT)).replace("\\", "/")})

    def render_name(self, name: str) -> None:
        if not is_safe_name(name):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Choose a valid resume name before rendering.")
            return

        output_path = render_resume(name)
        rel_path = output_path.relative_to(ROOT)
        url = "/" + rel_path.parent.as_posix() + "/"
        self.send_json({"ok": True, "path": rel_path.as_posix(), "url": url})

    def save_upload(self, payload: dict) -> None:
        filename = clean_filename(str(payload.get("filename", "")))
        data_url = str(payload.get("dataUrl", ""))
        folder = str(payload.get("folder", "")).strip()
        folder = folder if is_safe_name(folder) else ""

        suffix = Path(filename).suffix.lower()
        if not filename or suffix not in IMAGE_EXTENSIONS:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Only image files are supported.")
            return
        if "," not in data_url:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Upload data is missing.")
            return

        encoded = data_url.split(",", 1)[1]
        file_bytes = base64.b64decode(encoded)
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Image is larger than 8 MB.")
            return

        target_dir = UPLOAD_DIR / folder if folder else UPLOAD_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / filename

        counter = 1
        while target_path.exists():
            stem = Path(filename).stem
            target_path = target_dir / f"{stem}-{counter}{suffix}"
            counter += 1

        target_path.write_bytes(file_bytes)
        rel_path = target_path.relative_to(ROOT).as_posix()
        self.send_json({"ok": True, "path": rel_path})

    def send_json(self, data: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_json({"ok": False, "error": message}, status)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the local Brief resume editor.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), lambda *handler_args: AdminHandler(*handler_args, directory=str(ROOT)))
    safe_print(f"Brief editor: http://{args.host}:{args.port}/edit.html")
    safe_print("Press Ctrl+C to stop.")
    server.serve_forever()


def safe_print(message: str) -> None:
    try:
        print(message, flush=True)
    except OSError:
        pass


if __name__ == "__main__":
    main()
