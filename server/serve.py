"""Serve the DasVisable Cesium viewer locally.

Serves the frontend from ``web/`` and maps ``/data/*`` URLs to the sibling
``data/`` directory, so the web app can load 3D Tiles and KML files without
exposing the rest of the repository.
"""

from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


BASE_DIR = Path(__file__).resolve().parent.parent
WEB_ROOT = BASE_DIR / "web"
DATA_ROOT = BASE_DIR / "data"


def _resolve_within(root: Path, relative: str) -> str:
    """Resolve ``relative`` inside ``root`` and keep it inside ``root``."""
    target = (root / relative).resolve()
    if target == root or root in target.parents:
        return str(target)
    return str(root)


class TilesetHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        path = path.split("?", 1)[0]
        path = path.split("#", 1)[0]
        path = unquote(path)

        if path == "/data" or path.startswith("/data/"):
            relative = path[len("/data/"):]
            return _resolve_within(DATA_ROOT, relative)

        return super().translate_path(path)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        # Keep the console readable; remove this line to see request logs.
        return


def _register_mime_types() -> None:
    TilesetHandler.extensions_map[".glb"] = "model/gltf-binary"
    TilesetHandler.extensions_map[".gltf"] = "model/gltf+json"
    TilesetHandler.extensions_map[".b3dm"] = "application/octet-stream"
    TilesetHandler.extensions_map[".i3dm"] = "application/octet-stream"
    TilesetHandler.extensions_map[".pnts"] = "application/octet-stream"
    TilesetHandler.extensions_map[".cmpt"] = "application/octet-stream"
    TilesetHandler.extensions_map[".kml"] = "application/vnd.google-earth.kml+xml"
    TilesetHandler.extensions_map[".wasm"] = "application/wasm"
    TilesetHandler.extensions_map[".js"] = "text/javascript"
    TilesetHandler.extensions_map[".mjs"] = "text/javascript"


def create_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    _register_mime_types()
    handler = functools.partial(TilesetHandler)
    return ThreadingHTTPServer((host, port), handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the DasVisable Cesium viewer")
    parser.add_argument("--host", default="127.0.0.1", help="bind address")
    parser.add_argument("--port", type=int, default=8000, help="bind port")
    args = parser.parse_args()

    with create_server(args.host, args.port) as httpd:
        url = f"http://{args.host}:{args.port}"
        print(f"Serving {WEB_ROOT}")
        print(f"Open {url} in your browser")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
