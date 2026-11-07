"""Tool regression checks; uses tiny temporary images, never game assets."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name('build-inventory-thumbnails.py')
spec = importlib.util.spec_from_file_location('thumbs', SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class ThumbnailTests(unittest.TestCase):
    def test_selection_rejects_typos_and_preserves_catalog_order(self):
        records = [{'id': 'A', 'name': '甲'}, {'id': 'B', 'name': '乙'}]
        self.assertEqual(tool.select_fish(records, ['乙', 'A', 'A']), records)
        with self.assertRaisesRegex(ValueError, 'Unknown fish'):
            tool.select_fish(records, ['TYPO'])

    def test_crop_ignores_near_transparent_padding_and_keeps_proportions(self):
        image = Image.new('RGBA', (1200, 400), (255, 0, 0, 1))
        image.paste((0, 80, 0, 255), (100, 100, 1100, 300))
        self.assertEqual(tool.inspect(image)['visibleBounds'], (100, 100, 1100, 300))
        self.assertEqual(tool.thumbnail(image, True).size, (512, 102))
        self.assertEqual(image.size, (1200, 400))

    def test_validation_rejects_stretching_and_lost_alpha(self):
        source = Image.new('RGBA', (100, 50), (0, 0, 0, 0))
        source.paste((10, 30, 80, 255), (10, 10, 90, 40))
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'test.webp'
            source.save(target, 'WEBP', lossless=True, exact=True)
            self.assertEqual(tool.check_thumbnail(source, target), [100, 50])
            source.resize((100, 100)).save(target, 'WEBP', lossless=True)
            with self.assertRaisesRegex(ValueError, 'proportions'):
                tool.check_thumbnail(source, target)
            source.convert('RGB').save(target, 'WEBP', lossless=True)
            with self.assertRaisesRegex(ValueError, 'transparency'):
                tool.check_thumbnail(source, target)

    def test_paths_cannot_escape_asset_directories(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                tool.asset_paths(Path(folder), '../outside.png')

    def test_legacy_crop_is_adopted_without_touching_thumbnail_then_skipped(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'source.png'
            target = Path(folder) / 'thumb.webp'
            image = Image.new('RGBA', (1000, 500), (0, 0, 0, 0))
            image.paste((20, 80, 140, 255), (100, 200, 900, 300))
            image.save(source)
            tool.thumbnail(image, True).save(target, 'WEBP', lossless=True, method=6, exact=True)
            before = (target.read_bytes(), target.stat().st_mtime_ns)
            checked = tool.update_thumbnail(source, target, image, check=True)
            self.assertFalse(checked['recorded'])
            self.assertFalse(target.with_suffix('.webp.meta.json').exists())
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'adopted')
            self.assertEqual((target.read_bytes(), target.stat().st_mtime_ns), before)
            self.assertTrue(tool.read_record(target)['settings']['cropTransparent'])
            metadata_time = target.with_suffix('.webp.meta.json').stat().st_mtime_ns
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'skipped')
            self.assertEqual(target.with_suffix('.webp.meta.json').stat().st_mtime_ns, metadata_time)

    def test_changed_source_settings_corruption_and_missing_file_rebuild_only_target(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'source.png'
            target = Path(folder) / 'thumb.webp'
            image = Image.new('RGBA', (1000, 500), (0, 0, 0, 0))
            image.paste((20, 80, 140, 255), (100, 200, 900, 300))
            image.save(source)
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'rebuilt')
            original_source = source.read_bytes()
            before = (target.read_bytes(), target.stat().st_mtime_ns)
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'skipped')
            self.assertEqual((target.read_bytes(), target.stat().st_mtime_ns), before)
            self.assertEqual(tool.update_thumbnail(source, target, image, crop=True)['action'], 'rebuilt')
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'skipped')
            self.assertEqual(source.read_bytes(), original_source)
            image.paste((80, 10, 30, 255), (400, 210, 500, 250))
            image.save(source)
            with self.assertRaisesRegex(ValueError, 'stale'):
                tool.update_thumbnail(source, target, image, check=True)
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'rebuilt')
            # Same valid shape, wrong content: the thumbnail hash must catch it.
            altered = tool.thumbnail(image, True)
            altered.putpixel((10, 10), (255, 0, 0, 255))
            altered.save(target, 'WEBP', lossless=True, exact=True)
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'rebuilt')
            target.write_bytes(b'broken webp')
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'rebuilt')
            target.unlink()
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'rebuilt')
            self.assertEqual(tool.update_thumbnail(source, target, image, force=True)['action'], 'rebuilt')
            metadata = target.with_suffix('.webp.meta.json')
            metadata.write_text('{broken json', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Invalid thumbnail record'):
                tool.update_thumbnail(source, target, image, check=True)
            self.assertEqual(tool.update_thumbnail(source, target, image)['action'], 'adopted')

    def test_cli_only_writes_selected_thumbnail_and_check_is_read_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            shutil.copyfile(SCRIPT, root / 'scripts' / SCRIPT.name)
            (root / 'package.json').write_text('{"type":"module"}', encoding='utf-8')
            records = [{'id': key, 'name': name, 'inventory': {'image': f'{key}.png'}}
                       for key, name in [('A', '甲'), ('B', '乙')]]
            (root / 'fish-data.js').write_text('export const FISH_DATA=' + json.dumps(records), encoding='utf-8')
            assets = root / 'fish-images'
            assets.mkdir()
            for key in ['A', 'B']:
                Image.new('RGBA', (100, 50), (10, 30, 80, 255)).save(assets / f'{key}.png')
            original = (assets / 'A.png').read_bytes()
            command = [sys.executable, str(root / 'scripts' / SCRIPT.name), '--fish', '甲']
            subprocess.run(command, check=True, capture_output=True)
            target = assets / 'thumbnails' / 'A.webp'
            self.assertTrue(target.exists())
            self.assertFalse((assets / 'thumbnails' / 'B.webp').exists())
            self.assertFalse((assets / 'thumbnails' / 'B.webp.meta.json').exists())
            bulk = subprocess.run([sys.executable, str(root / 'scripts' / SCRIPT.name)], capture_output=True)
            self.assertNotEqual(bulk.returncode, 0)
            self.assertFalse((assets / 'thumbnails' / 'B.webp').exists())
            before = (target.read_bytes(), target.stat().st_mtime_ns)
            subprocess.run(command + ['--check'], check=True, capture_output=True)
            self.assertEqual((target.read_bytes(), target.stat().st_mtime_ns), before)
            self.assertEqual((assets / 'A.png').read_bytes(), original)
            target.unlink()
            result = subprocess.run(command + ['--check'], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
