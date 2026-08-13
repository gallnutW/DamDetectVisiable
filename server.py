"""Serve the Cesium viewer and the 3D Tiles datasets locally.

Usage:
    python server.py                 # http://127.0.0.1:8000
    python server.py --port 8080     # custom port
    python server.py --host 0.0.0.0  # allow LAN access
"""

from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class TilesetHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        # Keep the console readable; uncomment the next line for request logs.
        # super().log_message(format, *args)
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the DasVisable Cesium viewer")
    parser.add_argument("--host", default="127.0.0.1", help="bind address")
    parser.add_argument("--port", type=int, default=8000, help="bind port")
    args = parser.parse_args()

    handler = functools.partial(TilesetHandler)
    # Help browsers load binary glTF without guessing the MIME type.
    TilesetHandler.extensions_map[".glb"] = "model/gltf-binary"
    TilesetHandler.extensions_map[".gltf"] = "model/gltf+json"
    TilesetHandler.extensions_map[".b3dm"] = "application/octet-stream"
    TilesetHandler.extensions_map[".i3dm"] = "application/octet-stream"
    TilesetHandler.extensions_map[".pnts"] = "application/octet-stream"
    TilesetHandler.extensions_map[".cmpt"] = "application/octet-stream"
    TilesetHandler.extensions_map[".kml"] = "application/vnd.google-earth.kml+xml"

    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        url = f"http://{args.host}:{args.port}"
        print(f"Serving {ROOT}")
        print(f"Open {url} in your browser")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
