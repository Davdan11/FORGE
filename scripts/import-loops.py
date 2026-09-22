# Import animated exercise loops (GIF) into public/moves.
#
#   python scripts/import-loops.py <folder or .zip of GIFs>
#
# Each GIF becomes <slug>.loop.webp (animated, about a tenth of the GIF's
# size and without its 256-colour banding) plus <slug>.jpg, its first frame,
# used as the still in lists and under reduced motion. File names are mapped
# to exercise slugs by RENAME below; a name not listed is used as the slug.
# Then run `npm run moves` to rebuild the manifest.
import io, os, sys, zipfile
from PIL import Image, ImageSequence

RENAME = {
    "barbell-back-squat": "back-squat",
    "barbell-bench-press": "bench-press",
    "dumbbell-lateral-raise": "lateral-raise",
    "seated-row": "cable-row",
    "dumbbell-bicep-curl": "dumbbell-curl",
    "cable-bicep-curl": "cable-curl",
    "tricep-pushdown": "triceps-pushdown",
    "chest-press": "machine-chest-press",
}

def sources(path):
    if path.lower().endswith(".zip"):
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if n.lower().endswith(".gif"):
                    yield os.path.basename(n), z.read(n)
    else:
        for n in sorted(os.listdir(path)):
            if n.lower().endswith(".gif"):
                with open(os.path.join(path, n), "rb") as f:
                    yield n, f.read()

def main(src):
    out = os.path.join(os.path.dirname(__file__), "..", "public", "moves")
    total_in = total_out = 0
    for name, data in sources(src):
        stem = os.path.splitext(name)[0]
        slug = RENAME.get(stem, stem)
        im = Image.open(io.BytesIO(data))
        durations = [fr.info.get("duration", 100) for fr in ImageSequence.Iterator(im)]
        frames = [fr.convert("RGB") for fr in ImageSequence.Iterator(im)]
        loop = os.path.join(out, f"{slug}.loop.webp")
        frames[0].save(loop, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=80, method=6)
        frames[0].save(os.path.join(out, f"{slug}.jpg"), quality=82, optimize=True, progressive=True)
        total_in += len(data); total_out += os.path.getsize(loop)
        print(f"{name} -> {slug}")
    print(f"{total_in // 1024} KB of GIF -> {total_out // 1024} KB of WebP")

if __name__ == "__main__":
    main(sys.argv[1])
