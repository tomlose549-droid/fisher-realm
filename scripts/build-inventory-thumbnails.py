"""Build or validate selected lossless thumbnails; originals stay intact."""
import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LIMIT = (512, 384)


def select_fish(records, selectors):
    if not selectors:
        return records
    missing = set(selectors) - {v for f in records for v in (f['id'], f['name'])}
    if missing:
        raise ValueError('Unknown fish: ' + ', '.join(sorted(missing)))
    return [f for f in records if f['id'] in selectors or f['name'] in selectors]


def asset_paths(root, name):
    assets = (root / 'fish-images').resolve()
    source = (assets / name).resolve()
    target = (assets / 'thumbnails' / Path(name).with_suffix('.webp')).resolve()
    if not source.is_relative_to(assets) or not target.is_relative_to(assets / 'thumbnails'):
        raise ValueError('Asset outside fish-images')
    return source, target


def inspect(image):
    alpha = image.getchannel('A')
    # Inspect alpha before treating bright, almost-transparent pixels as defects.
    return {'sourceSize': list(image.size), 'visibleBounds': alpha.point(
        lambda a: 255 if a >= 8 else 0).getbbox(), 'alphaRange': alpha.getextrema()}


def thumbnail(image, crop=False):
    if crop:
        bounds = inspect(image)['visibleBounds']
        if not bounds:
            raise ValueError('Source contains no visible fish')
        image = image.crop(bounds)
    else:
        image = image.copy()
    image.thumbnail(LIMIT, Image.Resampling.LANCZOS)
    return image


def check_thumbnail(source, target):
    with Image.open(target) as stored:
        stored.load()
        if stored.format != 'WEBP' or stored.width > LIMIT[0] or stored.height > LIMIT[1]:
            raise ValueError('Thumbnail must be WebP within 512x384')
        variants = [thumbnail(source), thumbnail(source, crop=True)]
        if not any(abs(stored.width - v.width) <= 1 and abs(stored.height - v.height) <= 1 for v in variants):
            raise ValueError('Thumbnail dimensions do not preserve source proportions')
        if source.getchannel('A').getextrema()[0] < 255:
            if stored.convert('RGBA').getchannel('A').getextrema()[0] == 255:
                raise ValueError('Thumbnail lost source transparency')
        return list(stored.size)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fish', action='append', help='Exact ID or name; repeat for multiple fish')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Validate existing thumbnails; write nothing')
    mode.add_argument('--inspect', action='store_true', help='Inspect source alpha/bounds; write nothing')
    parser.add_argument('--crop-transparent', action='store_true', help='Crop alpha<8 padding before resizing')
    args = parser.parse_args()
    try:
        records = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
            "import {FISH_DATA} from './fish-data.js';console.log(JSON.stringify(FISH_DATA))"],
            cwd=ROOT, text=True, encoding='utf-8'))
        selected = select_fish(records, args.fish)
        jobs = []
        for fish in selected:
            name = fish['inventory']['image']
            if not name:
                if args.fish:
                    raise ValueError(f"{fish['name']}: image not configured; assets are incomplete")
                print(json.dumps({'fish': fish['id'], 'skipped': 'no image'}, ensure_ascii=False))
                continue
            source, target = asset_paths(ROOT, name)
            if not source.is_file():
                raise ValueError(f'Missing source: {source}')
            jobs.append((fish, source, target))
        source_bytes = target_bytes = 0
        for fish, source, target in jobs:
            try:
                with Image.open(source) as opened:
                    image = opened.convert('RGBA')
                info = {'fish': fish['id'], 'name': fish['name'], **inspect(image)}
                if not args.inspect:
                    if not args.check:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        thumbnail(image, args.crop_transparent).save(target, 'WEBP', lossless=True, method=6, exact=True)
                    info.update(thumbnail=str(target.relative_to(ROOT)),
                                size=check_thumbnail(image, target), bytes=target.stat().st_size)
                    source_bytes += source.stat().st_size
                    target_bytes += target.stat().st_size
                print(json.dumps(info, ensure_ascii=False))
            except (OSError, ValueError) as error:
                raise ValueError(f"{fish['id']}: {error}") from error
        print(json.dumps({'count': len(jobs), 'mode': 'inspect' if args.inspect else
            'check' if args.check else 'build', 'sourceBytes': source_bytes, 'thumbnailBytes': target_bytes}))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
