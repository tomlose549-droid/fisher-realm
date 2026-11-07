"""Build or validate selected lossless thumbnails; originals stay intact."""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, __version__ as PILLOW_VERSION

ROOT = Path(__file__).resolve().parent.parent
LIMIT = (512, 384)


def checksum(data):
    return hashlib.sha256(data).hexdigest()


def settings(crop):
    return {'version': 1, 'limit': list(LIMIT), 'cropTransparent': crop,
            'alphaThreshold': 8, 'resampling': 'LANCZOS', 'format': 'WEBP',
            'lossless': True, 'method': 6, 'exact': True, 'pillow': PILLOW_VERSION}


def read_record(target):
    try:
        record = json.loads(target.with_suffix('.webp.meta.json').read_text(encoding='utf-8'))
        if (isinstance(record, dict) and isinstance(record.get('settings'), dict)
                and isinstance(record['settings'].get('cropTransparent'), bool)
                and isinstance(record.get('sourceSHA256'), str)
                and isinstance(record.get('thumbnailSHA256'), str)):
            return record
    except (OSError, ValueError):
        pass
    return None


def replace_file(target, writer):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.tmp', delete=False) as file:
            temporary = Path(file.name)
        writer(temporary)
        os.replace(temporary, target)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def same_pixels(first, second):
    return first.size == second.size and first.tobytes() == second.convert('RGBA').tobytes()


def update_thumbnail(source, target, image, crop=None, force=False, check=False):
    record = read_record(target)
    if check and record is None and target.with_suffix('.webp.meta.json').exists():
        raise ValueError('Invalid thumbnail record; run the builder for this fish')
    source_hash = checksum(source.read_bytes())
    valid = False
    try:
        size = check_thumbnail(image, target)
        valid = True
    except (OSError, ValueError):
        if check:
            raise
    # Preserve recorded crop settings unless explicitly changed. Infer legacy crop
    # from exact pixels, never just width/height or file modification timestamps.
    legacy_match = None
    if valid and not record:
        with Image.open(target) as existing:
            for candidate in (False, True) if crop is None else (crop,):
                if same_pixels(thumbnail(image, candidate), existing):
                    legacy_match = candidate
                    break
    if crop is None:
        crop = record['settings']['cropTransparent'] if record else bool(legacy_match)
    current_settings = settings(crop)
    target_hash = checksum(target.read_bytes()) if target.is_file() else None
    unchanged = (valid and record and record['sourceSHA256'] == source_hash
                 and record['thumbnailSHA256'] == target_hash and record['settings'] == current_settings)
    if check:
        if record and not unchanged:
            raise ValueError('Thumbnail record is stale; run the builder for this fish')
        # Check stays read-only, including for old thumbnails without records.
        return {'action': 'checked', 'recorded': bool(record), 'size': size}
    if unchanged and not force:
        return {'action': 'skipped', 'recorded': True, 'size': size}
    if valid and not record and legacy_match is not None and not force:
        action = 'adopted'
    else:
        action = 'rebuilt'
        built = thumbnail(image, crop)
        replace_file(target, lambda file: built.save(file, 'WEBP', lossless=True, method=6, exact=True))
        size = check_thumbnail(image, target)
    updated = {'sourceSHA256': source_hash, 'thumbnailSHA256': checksum(target.read_bytes()),
               'settings': current_settings, 'size': size}
    metadata = target.with_suffix('.webp.meta.json')
    replace_file(metadata, lambda file: file.write_text(
        json.dumps(updated, ensure_ascii=False, sort_keys=True, indent=2)+'\n', encoding='utf-8'))
    return {'action': action, 'recorded': True, 'size': size}


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
        matching = [v for v in variants if abs(stored.width - v.width) <= 1 and abs(stored.height - v.height) <= 1]
        if not matching:
            raise ValueError('Thumbnail dimensions do not preserve source proportions')
        # A tight crop may legitimately remove all transparent outer padding.
        if all(v.getchannel('A').getextrema()[0] < 255 for v in matching):
            if stored.convert('RGBA').getchannel('A').getextrema()[0] == 255:
                raise ValueError('Thumbnail lost source transparency')
        return list(stored.size)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fish', action='append', help='Exact ID or name; repeat for multiple fish')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Validate existing thumbnails; write nothing')
    mode.add_argument('--inspect', action='store_true', help='Inspect source alpha/bounds; write nothing')
    parser.add_argument('--crop-transparent', action=argparse.BooleanOptionalAction, default=None,
                        help='Crop alpha<8 padding; otherwise preserve recorded/legacy crop')
    parser.add_argument('--force', action='store_true', help='Rebuild even when source/settings are unchanged')
    args = parser.parse_args()
    if not args.fish and not (args.check or args.inspect):
        parser.error('Building requires --fish ID/name; existing fish must not be processed in bulk')
    if args.force and (args.check or args.inspect):
        parser.error('--force cannot be combined with a read-only mode')
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
                    info.update(update_thumbnail(source, target, image, args.crop_transparent, args.force, args.check))
                    info.update(thumbnail=str(target.relative_to(ROOT)),
                                bytes=target.stat().st_size)
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
