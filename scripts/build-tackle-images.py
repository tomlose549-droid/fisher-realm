"""Prepare only the four explicitly selected tackle images; never open an old fish asset."""
import argparse
import hashlib
import json
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILES = {'line-1': '1级鱼线.png', 'lure-1': '假饵1.png', 'lure-2': '假饵2.png', 'reel-1': '渔轮1.png'}


def prepare(source, name):
    image = Image.open(source).convert('RGBA')
    # Inspect alpha first. Preserve supplied transparency; otherwise remove only near-white
    # background connected to the canvas edge, keeping enclosed metallic highlights intact.
    if image.getchannel('A').getextrema()[0] == 255:
        pixels = image.load()
        width, height = image.size
        seen = bytearray(width * height)
        queue = deque()

        def visit(x, y):
            index = y * width + x
            if seen[index]:
                return
            seen[index] = 1
            r, g, b, a = pixels[x, y]
            threshold = 200 if name in ('line-1', 'reel-1') else 242
            if min(r, g, b) >= threshold and max(r, g, b) - min(r, g, b) <= 16:
                if min(r, g, b) >= 242:
                    pixels[x, y] = (r, g, b, 0)
                else:
                    # Remove the white photographic matte from edge-connected grey shadows.
                    # Opaque grey/black subject cores and enclosed metallic highlights stay untouched.
                    alpha = (255 - min(r, g, b)) / 175
                    rgb = tuple(max(0, min(255, round((v - 255 * (1 - alpha)) / alpha))) for v in (r, g, b))
                    pixels[x, y] = (*rgb, round(alpha * 255))
                queue.append((x, y))

        for x in range(width):
            visit(x, 0)
            visit(x, height - 1)
        for y in range(height):
            visit(0, y)
            visit(width - 1, y)
        hole = {'line-1': (.55, .5), 'reel-1': (.29, .35), 'lure-1': (.073, .52), 'lure-2': (.073, .52)}[name]
        visit(int(width * hole[0]), int(height * hole[1]))
        while queue:
            x, y = queue.popleft()
            if x:
                visit(x - 1, y)
            if x + 1 < width:
                visit(x + 1, y)
            if y:
                visit(x, y - 1)
            if y + 1 < height:
                visit(x, y + 1)
    bounds = image.getchannel('A').getbbox()
    if not bounds:
        raise ValueError('Empty image: ' + str(source))
    image = image.crop(bounds)
    full = ROOT / 'fish-images' / 'tackle' / (name + '.png')
    thumb = ROOT / 'fish-images' / 'thumbnails' / 'tackle' / (name + '.webp')
    full.parent.mkdir(parents=True, exist_ok=True)
    thumb.parent.mkdir(parents=True, exist_ok=True)
    full_temp = full.with_suffix('.png.tmp')
    image.save(full_temp, 'PNG', optimize=True)
    full_temp.replace(full)
    image.thumbnail((512, 384), Image.Resampling.LANCZOS)
    thumb_temp = thumb.with_suffix('.webp.tmp')
    image.save(thumb_temp, 'WEBP', lossless=True, method=6, exact=True)
    thumb_temp.replace(thumb)
    record = {'sourceName': source.name, 'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'fullSHA256': hashlib.sha256(full.read_bytes()).hexdigest(), 'thumbnailSHA256': hashlib.sha256(thumb.read_bytes()).hexdigest(),
              'size': list(image.size), 'limit': [512, 384], 'format': 'WEBP', 'lossless': True, 'background': 'edge-connected near-white and selected hollow center; metallic highlights preserved'}
    thumb.with_suffix('.webp.meta.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'name': name, 'thumbnailBytes': thumb.stat().st_size, 'size': list(image.size)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--items', nargs='+', choices=FILES, required=True)
    args = parser.parse_args()
    print(json.dumps([prepare(args.source_dir / FILES[name], name) for name in args.items]))
