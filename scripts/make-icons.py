"""Generate PNG app icons (192, 512, apple 180) without external deps."""
import struct, zlib, os

def png(size, path):
    W = H = size
    bg = (10, 10, 10); fg = (212, 255, 58)
    # F glyph geometry (fractions of size)
    x0, x1 = int(W*0.25), int(W*0.75)
    y0 = int(H*0.19); bar = int(H*0.125)
    stem = int(W*0.155)
    rows = []
    for y in range(H):
        row = bytearray([0])
        for x in range(W):
            inF = (x0 <= x < x1 and y0 <= y < y0+bar) \
               or (x0 <= x < x0+stem and y0 <= y < int(H*0.81)) \
               or (x0 <= x < int(W*0.69) and int(H*0.47) <= y < int(H*0.47)+bar)
            row += bytes(fg if inF else bg)
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t+d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)

root = os.path.join(os.path.dirname(__file__), "..", "public")
png(192, os.path.join(root, "icon-192.png"))
png(512, os.path.join(root, "icon-512.png"))
png(180, os.path.join(root, "apple-icon.png"))
print("icons written")
