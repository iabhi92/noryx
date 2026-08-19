"""Placeholder toolbar icons (solid Electric Blue squares). Swap for real artwork later."""
import os
import struct
import zlib

ELECTRIC_BLUE = (14, 165, 233)
SIZES = (16, 32, 48, 128)


def write_png(path: str, size: int, color: tuple[int, int, int]) -> None:
    r, g, b = color
    row = b"\x00" + bytes((r, g, b)) * size
    raw = row * size

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        write_png(os.path.join(out_dir, f"icon-{size}.png"), size, ELECTRIC_BLUE)
    print(f"generated {len(SIZES)} icons in {out_dir}")
