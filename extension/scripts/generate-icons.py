"""Toolbar icons: a filled circle with real alpha transparency (Electric Blue, RGBA PNG).

Safari renders WebExtension toolbar icons as monochrome template silhouettes — it uses the
alpha channel as a mask and paints it black/white to match the toolbar. A full-bleed opaque
square (no transparent margin) renders as a jarring solid block; a circle with transparent
padding renders as a clean dot, which is what browsers actually expect for these icons.
"""
import os
import struct
import zlib

ELECTRIC_BLUE = (14, 165, 233)
SIZES = (16, 32, 48, 128)
PADDING_FRACTION = 0.12  # transparent margin so the silhouette doesn't touch the canvas edge


def write_png(path: str, size: int, color: tuple[int, int, int]) -> None:
    r, g, b = color
    radius = size * (0.5 - PADDING_FRACTION)
    center = size / 2

    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type: None
        for x in range(size):
            dx = x + 0.5 - center
            dy = y + 0.5 - center
            inside = (dx * dx + dy * dy) <= radius * radius
            alpha = 255 if inside else 0
            rows += bytes((r, g, b, alpha))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # color type 6 = RGBA
    idat = zlib.compress(bytes(rows), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        write_png(os.path.join(out_dir, f"icon-{size}.png"), size, ELECTRIC_BLUE)
    print(f"generated {len(SIZES)} icons in {out_dir}")
