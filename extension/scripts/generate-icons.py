"""Toolbar icons: a cat-head silhouette (rounded head + two pointy ears), real alpha
transparency, Electric Blue RGBA PNG.

Safari renders WebExtension toolbar icons as monochrome template silhouettes — it uses the
alpha channel as a mask and paints it black/white to match the toolbar. The shape is a circle
(head) unioned with two triangles (ears) so the silhouette actually reads as a cat, not a plain
dot — MeowMentor's mark, not a placeholder. 3x3 supersampling per pixel for anti-aliased edges,
since the ear triangles have angled edges that look rough at 16px without it.
"""
import os
import struct
import zlib

ELECTRIC_BLUE = (14, 165, 233)
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 3

# Normalized (0..1) geometry, y-down. Head sits slightly low in the frame to leave headroom for
# the ears; ear bases overlap the head circle so there's no gap/notch in the union.
HEAD_CENTER = (0.5, 0.60)
HEAD_RADIUS = 0.32
LEFT_EAR = ((0.20, 0.50), (0.45, 0.30), (0.22, 0.08))
RIGHT_EAR = ((0.80, 0.50), (0.55, 0.30), (0.78, 0.08))


def in_circle(x: float, y: float) -> bool:
    dx, dy = x - HEAD_CENTER[0], y - HEAD_CENTER[1]
    return dx * dx + dy * dy <= HEAD_RADIUS * HEAD_RADIUS


def in_triangle(px: float, py: float, tri: tuple) -> bool:
    (ax, ay), (bx, by), (cx, cy) = tri
    d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
    d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
    d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def coverage(size: int, px: int, py: int) -> float:
    hits = 0
    for sy in range(SUPERSAMPLE):
        for sx in range(SUPERSAMPLE):
            x = (px + (sx + 0.5) / SUPERSAMPLE) / size
            y = (py + (sy + 0.5) / SUPERSAMPLE) / size
            if in_circle(x, y) or in_triangle(x, y, LEFT_EAR) or in_triangle(x, y, RIGHT_EAR):
                hits += 1
    return hits / (SUPERSAMPLE * SUPERSAMPLE)


def write_png(path: str, size: int, color: tuple[int, int, int]) -> None:
    r, g, b = color
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type: None
        for x in range(size):
            alpha = round(coverage(size, x, y) * 255)
            rows += bytes((r, g, b, alpha))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # color type 6 = RGBA
    idat = zlib.compress(bytes(rows), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


BACKGROUND = (19, 19, 19)  # matches --background in docs/index.html and the dashboard
SOFT_VIOLET = (248, 172, 255)


def write_logo_png(path: str, size: int) -> None:
    """docs/assets/icon.png — the site favicon and nav wordmark image, not a Safari template icon,
    so this one is fully colored: dark tile background, cat mark filled with the same
    electric-blue -> soft-violet vertical gradient as .text-gradient elsewhere on the page."""
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        t = y / max(1, size - 1)
        gr = round(ELECTRIC_BLUE[0] + (SOFT_VIOLET[0] - ELECTRIC_BLUE[0]) * t)
        gg = round(ELECTRIC_BLUE[1] + (SOFT_VIOLET[1] - ELECTRIC_BLUE[1]) * t)
        gb = round(ELECTRIC_BLUE[2] + (SOFT_VIOLET[2] - ELECTRIC_BLUE[2]) * t)
        for x in range(size):
            cover = coverage(size, x, y)
            r = round(BACKGROUND[0] * (1 - cover) + gr * cover)
            g = round(BACKGROUND[1] * (1 - cover) + gg * cover)
            b = round(BACKGROUND[2] * (1 - cover) + gb * cover)
            rows += bytes((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # color type 2 = RGB
    idat = zlib.compress(bytes(rows), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        write_png(os.path.join(out_dir, f"icon-{size}.png"), size, ELECTRIC_BLUE)
    print(f"generated {len(SIZES)} cat-head icons in {out_dir}")

    logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "assets", "icon.png")
    write_logo_png(logo_path, 128)
    print(f"generated colored logo at {logo_path}")
